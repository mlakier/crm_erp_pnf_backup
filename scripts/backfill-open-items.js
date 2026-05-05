const { PrismaClient, Prisma } = require('@prisma/client')

const prisma = new PrismaClient()

const MONEY_TOLERANCE = 0.005
const OPEN_ITEM_NUMBER_PREFIX = 'OI-'
const OPEN_ITEM_APPLICATION_NUMBER_PREFIX = 'OIA-'
const CLEARING_DOCUMENT_NUMBER_PREFIX = 'CLR-'

function roundMoney(value) {
  return Math.round(Number(value ?? 0) * 100) / 100
}

function toDecimal(value) {
  return new Prisma.Decimal(roundMoney(value ?? 0))
}

async function generateSequentialIdentifier(tx, model, field, prefix) {
  const records =
    model === 'openItem'
      ? await tx.openItem.findMany({
          where: { [field]: { startsWith: prefix } },
          select: { [field]: true },
          orderBy: { [field]: 'desc' },
          take: 200,
        })
      : model === 'openItemApplication'
        ? await tx.openItemApplication.findMany({
            where: { [field]: { startsWith: prefix } },
            select: { [field]: true },
            orderBy: { [field]: 'desc' },
            take: 200,
          })
        : await tx.clearingDocumentHeader.findMany({
            where: { [field]: { startsWith: prefix } },
            select: { [field]: true },
            orderBy: { [field]: 'desc' },
            take: 200,
          })

  let maxSequence = 0
  for (const record of records) {
    const rawValue = record[field]
    if (!rawValue?.startsWith(prefix)) continue
    const match = rawValue.match(/(\d+)$/)
    if (!match) continue
    const parsed = Number.parseInt(match[1], 10)
    if (Number.isFinite(parsed)) maxSequence = Math.max(maxSequence, parsed)
  }

  return `${prefix}${String(maxSequence + 1).padStart(6, '0')}`
}

async function getNextEntryNumber(tx, openItemId) {
  const latest = await tx.openItemEntry.findFirst({
    where: { openItemId },
    orderBy: { entryNumber: 'desc' },
    select: { entryNumber: true },
  })
  return (latest?.entryNumber ?? 0) + 1
}

async function getRemainingAmount(tx, openItemId) {
  const aggregate = await tx.openItemEntry.aggregate({
    where: { openItemId },
    _sum: {
      transactionAmount: true,
      localAmount: true,
      functionalAmount: true,
    },
  })

  return {
    transactionAmount: roundMoney(aggregate._sum.transactionAmount),
    localAmount: aggregate._sum.localAmount == null ? null : roundMoney(aggregate._sum.localAmount),
    functionalAmount:
      aggregate._sum.functionalAmount == null ? null : roundMoney(aggregate._sum.functionalAmount),
  }
}

async function syncOpenItemStatus(tx, openItemId) {
  const remaining = await getRemainingAmount(tx, openItemId)
  const isOpen = Math.abs(remaining.transactionAmount) > MONEY_TOLERANCE
  await tx.openItem.update({
    where: { id: openItemId },
    data: {
      status: isOpen ? 'open' : 'closed',
      isOpen,
      closedAt: isOpen ? null : new Date(),
    },
  })
}

async function findOpenItemBySource(tx, sourceTransactionType, sourceTransactionId) {
  return tx.openItem.findFirst({
    where: {
      sourceTransactionType,
      sourceTransactionId,
    },
    orderBy: { createdAt: 'asc' },
  })
}

async function ensureOpenItem(tx, input) {
  const existing = await findOpenItemBySource(tx, input.sourceTransactionType, input.sourceTransactionId)
  if (existing) return existing

  const openItem = await tx.openItem.create({
    data: {
      openItemNumber: await generateSequentialIdentifier(tx, 'openItem', 'openItemNumber', OPEN_ITEM_NUMBER_PREFIX),
      openItemType: input.openItemType,
      status: 'open',
      accountType: input.accountType,
      subsidiaryId: input.subsidiaryId ?? null,
      transactionCurrencyId: input.currencyId ?? null,
      localCurrencyId: input.currencyId ?? null,
      functionalCurrencyId: input.currencyId ?? null,
      sourceTransactionType: input.sourceTransactionType,
      sourceTransactionId: input.sourceTransactionId,
      sourceNumber: input.sourceNumber ?? null,
      counterpartyType: input.counterpartyType,
      counterpartyId: input.counterpartyId,
      documentDate: input.documentDate ?? null,
      postingDate: input.postingDate ?? null,
      dueDate: input.dueDate ?? null,
      originalTransactionAmount: toDecimal(input.amount),
      originalLocalAmount: toDecimal(input.amount),
      originalFunctionalAmount: toDecimal(input.amount),
      memo: input.memo ?? null,
      isOpen: true,
    },
  })

  await tx.openItemEntry.create({
    data: {
      openItemId: openItem.id,
      entryNumber: 1,
      entryType: 'opening_balance',
      effectiveDate: input.documentDate ?? new Date(),
      postingDate: input.postingDate ?? null,
      transactionAmount: toDecimal(input.amount),
      localAmount: toDecimal(input.amount),
      functionalAmount: toDecimal(input.amount),
      sourceTransactionType: input.sourceTransactionType,
      sourceTransactionId: input.sourceTransactionId,
      memo: input.memo ?? null,
    },
  })

  return openItem
}

async function findExistingApplication(tx, fromOpenItemId, toOpenItemId, settlementTransactionType, settlementTransactionId) {
  return tx.openItemApplication.findFirst({
    where: {
      fromOpenItemId,
      toOpenItemId: toOpenItemId ?? null,
      settlementTransactionType,
      settlementTransactionId,
    },
    orderBy: { createdAt: 'asc' },
  })
}

async function applyItems(tx, input) {
  const existing = await findExistingApplication(
    tx,
    input.fromOpenItemId,
    input.toOpenItemId ?? null,
    input.settlementTransactionType,
    input.settlementTransactionId,
  )
  if (existing) return existing

  const application = await tx.openItemApplication.create({
    data: {
      applicationNumber: await generateSequentialIdentifier(
        tx,
        'openItemApplication',
        'applicationNumber',
        OPEN_ITEM_APPLICATION_NUMBER_PREFIX,
      ),
      applicationType: input.applicationType,
      status: 'posted',
      fromOpenItemId: input.fromOpenItemId,
      toOpenItemId: input.toOpenItemId ?? null,
      settlementTransactionType: input.settlementTransactionType,
      settlementTransactionId: input.settlementTransactionId,
      applicationDate: input.applicationDate,
      postingDate: input.postingDate ?? null,
      transactionAmount: toDecimal(input.amount),
      localAmount: toDecimal(input.amount),
      functionalAmount: toDecimal(input.amount),
      memo: input.memo ?? null,
    },
  })

  await tx.openItemEntry.create({
    data: {
      openItemId: input.fromOpenItemId,
      entryNumber: await getNextEntryNumber(tx, input.fromOpenItemId),
      entryType: 'application',
      effectiveDate: input.applicationDate,
      postingDate: input.postingDate ?? null,
      transactionAmount: toDecimal(-input.amount),
      localAmount: toDecimal(-input.amount),
      functionalAmount: toDecimal(-input.amount),
      sourceApplicationId: application.id,
      sourceTransactionType: input.settlementTransactionType,
      sourceTransactionId: input.settlementTransactionId,
      memo: input.memo ?? null,
    },
  })

  if (input.toOpenItemId) {
    await tx.openItemEntry.create({
      data: {
        openItemId: input.toOpenItemId,
        entryNumber: await getNextEntryNumber(tx, input.toOpenItemId),
        entryType: 'application',
        effectiveDate: input.applicationDate,
        postingDate: input.postingDate ?? null,
        transactionAmount: toDecimal(-input.amount),
        localAmount: toDecimal(-input.amount),
        functionalAmount: toDecimal(-input.amount),
        sourceApplicationId: application.id,
        sourceTransactionType: input.settlementTransactionType,
        sourceTransactionId: input.settlementTransactionId,
        memo: input.memo ?? null,
      },
    })
  }

  await tx.clearingDocumentHeader.create({
    data: {
      clearingNumber: await generateSequentialIdentifier(
        tx,
        'clearingDocumentHeader',
        'clearingNumber',
        CLEARING_DOCUMENT_NUMBER_PREFIX,
      ),
      clearingType: input.clearingType,
      status: 'posted',
      subsidiaryId: input.subsidiaryId ?? null,
      transactionCurrencyId: input.currencyId ?? null,
      localCurrencyId: input.currencyId ?? null,
      functionalCurrencyId: input.currencyId ?? null,
      clearingDate: input.applicationDate,
      postingDate: input.postingDate ?? null,
      sourceTransactionType: input.settlementTransactionType,
      sourceTransactionId: input.settlementTransactionId,
      counterpartyType: input.counterpartyType ?? null,
      counterpartyId: input.counterpartyId ?? null,
      transactionAmount: toDecimal(input.amount),
      localAmount: toDecimal(input.amount),
      functionalAmount: toDecimal(input.amount),
      autoGenerated: true,
      automationSource: 'open-item-backfill',
      memo: input.memo ?? null,
      lines: {
        create: [
          {
            lineNumber: 1,
            lineRole: 'source',
            fromOpenItemId: input.fromOpenItemId,
            settlementTransactionType: input.settlementTransactionType,
            settlementTransactionId: input.settlementTransactionId,
            transactionAmount: toDecimal(input.amount),
            localAmount: toDecimal(input.amount),
            functionalAmount: toDecimal(input.amount),
            openItemApplicationId: application.id,
            memo: input.memo ?? null,
          },
          ...(input.toOpenItemId
            ? [
                {
                  lineNumber: 2,
                  lineRole: 'target',
                  toOpenItemId: input.toOpenItemId,
                  settlementTransactionType: input.settlementTransactionType,
                  settlementTransactionId: input.settlementTransactionId,
                  transactionAmount: toDecimal(input.amount),
                  localAmount: toDecimal(input.amount),
                  functionalAmount: toDecimal(input.amount),
                  openItemApplicationId: application.id,
                  memo: input.memo ?? null,
                },
              ]
            : []),
        ],
      },
    },
  })

  await syncOpenItemStatus(tx, input.fromOpenItemId)
  if (input.toOpenItemId) await syncOpenItemStatus(tx, input.toOpenItemId)

  return application
}

async function backfillInvoices() {
  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { status: { in: ['approved', 'posted', 'paid'] } },
        { cashReceipts: { some: {} } },
      ],
    },
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true,
      number: true,
      total: true,
      dueDate: true,
      customerId: true,
      userId: true,
      subsidiaryId: true,
      currencyId: true,
      createdAt: true,
    },
  })

  let created = 0
  for (const invoice of invoices) {
    await prisma.$transaction(async (tx) => {
      const existing = await findOpenItemBySource(tx, 'invoice', invoice.id)
      if (existing) return
      await ensureOpenItem(tx, {
        openItemType: 'accounts_receivable',
        accountType: 'Asset',
        subsidiaryId: invoice.subsidiaryId,
        currencyId: invoice.currencyId,
        sourceTransactionType: 'invoice',
        sourceTransactionId: invoice.id,
        sourceNumber: invoice.number,
        counterpartyType: 'customer',
        counterpartyId: invoice.customerId,
        documentDate: invoice.createdAt,
        postingDate: invoice.createdAt,
        dueDate: invoice.dueDate,
        amount: invoice.total,
      })
      created += 1
    })
  }

  return created
}

async function backfillBills() {
  const bills = await prisma.bill.findMany({
    where: {
      OR: [
        { status: { in: ['approved', 'received', 'paid'] } },
        { billPayments: { some: {} } },
      ],
    },
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true,
      number: true,
      total: true,
      date: true,
      dueDate: true,
      vendorId: true,
      userId: true,
      subsidiaryId: true,
      currencyId: true,
    },
  })

  let created = 0
  for (const bill of bills) {
    await prisma.$transaction(async (tx) => {
      const existing = await findOpenItemBySource(tx, 'bill', bill.id)
      if (existing) return
      await ensureOpenItem(tx, {
        openItemType: 'accounts_payable',
        accountType: 'Liability',
        subsidiaryId: bill.subsidiaryId,
        currencyId: bill.currencyId,
        sourceTransactionType: 'bill',
        sourceTransactionId: bill.id,
        sourceNumber: bill.number,
        counterpartyType: 'vendor',
        counterpartyId: bill.vendorId,
        documentDate: bill.date,
        postingDate: bill.date,
        dueDate: bill.dueDate,
        amount: bill.total,
      })
      created += 1
    })
  }

  return created
}

async function backfillInvoiceReceipts() {
  const receipts = await prisma.cashReceipt.findMany({
    where: { status: 'posted' },
    include: {
      invoice: true,
      applications: { include: { invoice: true } },
    },
    orderBy: [{ createdAt: 'asc' }],
  })

  let openItemsCreated = 0
  let applicationsCreated = 0

  for (const receipt of receipts) {
    await prisma.$transaction(async (tx) => {
      const receiptOpenItem = await ensureOpenItem(tx, {
        openItemType: 'customer_receipt',
        accountType: 'Asset',
        subsidiaryId: receipt.invoice.subsidiaryId,
        currencyId: receipt.invoice.currencyId,
        sourceTransactionType: 'invoice-receipt',
        sourceTransactionId: receipt.id,
        sourceNumber: receipt.number ?? receipt.id,
        counterpartyType: 'customer',
        counterpartyId: receipt.invoice.customerId,
        documentDate: receipt.date,
        postingDate: receipt.date,
        amount: receipt.amount,
      })
      if (receiptOpenItem.createdAt.getTime() === receiptOpenItem.updatedAt.getTime()) {
        openItemsCreated += 1
      }

      const applications = receipt.applications.length
        ? receipt.applications.map((application) => ({
            invoice: application.invoice,
            amount: Number(application.appliedAmount),
          }))
        : [{ invoice: receipt.invoice, amount: Number(receipt.amount) }]

      for (const application of applications) {
        const invoiceOpenItem = await ensureOpenItem(tx, {
          openItemType: 'accounts_receivable',
          accountType: 'Asset',
          subsidiaryId: application.invoice.subsidiaryId,
          currencyId: application.invoice.currencyId,
          sourceTransactionType: 'invoice',
          sourceTransactionId: application.invoice.id,
          sourceNumber: application.invoice.number,
          counterpartyType: 'customer',
          counterpartyId: application.invoice.customerId,
          documentDate: application.invoice.createdAt,
          postingDate: application.invoice.createdAt,
          dueDate: application.invoice.dueDate,
          amount: application.invoice.total,
        })

        const existing = await findExistingApplication(
          tx,
          receiptOpenItem.id,
          invoiceOpenItem.id,
          'invoice-receipt',
          receipt.id,
        )
        if (existing) continue

        await applyItems(tx, {
          fromOpenItemId: receiptOpenItem.id,
          toOpenItemId: invoiceOpenItem.id,
          applicationType: 'invoice_receipt_application',
          settlementTransactionType: 'invoice-receipt',
          settlementTransactionId: receipt.id,
          applicationDate: receipt.date,
          postingDate: receipt.date,
          amount: application.amount,
          clearingType: 'invoice_receipt_application',
          currencyId: application.invoice.currencyId,
          subsidiaryId: application.invoice.subsidiaryId,
          counterpartyType: 'customer',
          counterpartyId: application.invoice.customerId,
          memo: receipt.reference ?? null,
        })
        applicationsCreated += 1
      }
    })
  }

  return { openItemsCreated, applicationsCreated }
}

async function backfillBillPayments() {
  const payments = await prisma.billPayment.findMany({
    where: { status: { in: ['processed', 'cleared'] } },
    include: {
      bill: true,
      applications: { include: { bill: true } },
    },
    orderBy: [{ createdAt: 'asc' }],
  })

  let openItemsCreated = 0
  let applicationsCreated = 0

  for (const payment of payments) {
    await prisma.$transaction(async (tx) => {
      const firstBill = payment.applications[0]?.bill ?? payment.bill
      if (!firstBill) return

      const appliedAmount = payment.applications.length
        ? payment.applications.reduce((sum, application) => sum + Number(application.appliedAmount), 0)
        : Number(payment.amount)

      const paymentOpenItem = await ensureOpenItem(tx, {
        openItemType: 'vendor_payment',
        accountType: 'Liability',
        subsidiaryId: firstBill.subsidiaryId,
        currencyId: firstBill.currencyId,
        sourceTransactionType: 'bill-payment',
        sourceTransactionId: payment.id,
        sourceNumber: payment.number,
        counterpartyType: 'vendor',
        counterpartyId: payment.vendorId ?? firstBill.vendorId,
        documentDate: payment.date,
        postingDate: payment.date,
        amount: appliedAmount,
      })
      if (paymentOpenItem.createdAt.getTime() === paymentOpenItem.updatedAt.getTime()) {
        openItemsCreated += 1
      }

      const applications = payment.applications.length
        ? payment.applications.map((application) => ({
            bill: application.bill,
            amount: Number(application.appliedAmount),
          }))
        : payment.bill
          ? [{ bill: payment.bill, amount: Number(payment.amount) }]
          : []

      for (const application of applications) {
        const billOpenItem = await ensureOpenItem(tx, {
          openItemType: 'accounts_payable',
          accountType: 'Liability',
          subsidiaryId: application.bill.subsidiaryId,
          currencyId: application.bill.currencyId,
          sourceTransactionType: 'bill',
          sourceTransactionId: application.bill.id,
          sourceNumber: application.bill.number,
          counterpartyType: 'vendor',
          counterpartyId: application.bill.vendorId,
          documentDate: application.bill.date,
          postingDate: application.bill.date,
          dueDate: application.bill.dueDate,
          amount: application.bill.total,
        })

        const existing = await findExistingApplication(
          tx,
          paymentOpenItem.id,
          billOpenItem.id,
          'bill-payment',
          payment.id,
        )
        if (existing) continue

        await applyItems(tx, {
          fromOpenItemId: paymentOpenItem.id,
          toOpenItemId: billOpenItem.id,
          applicationType: 'bill_payment_application',
          settlementTransactionType: 'bill-payment',
          settlementTransactionId: payment.id,
          applicationDate: payment.date,
          postingDate: payment.date,
          amount: application.amount,
          clearingType: 'bill_payment_application',
          currencyId: application.bill.currencyId,
          subsidiaryId: application.bill.subsidiaryId,
          counterpartyType: 'vendor',
          counterpartyId: application.bill.vendorId,
          memo: payment.reference ?? payment.notes ?? null,
        })
        applicationsCreated += 1
      }
    })
  }

  return { openItemsCreated, applicationsCreated }
}

async function backfillCustomerRefunds() {
  const refunds = await prisma.customerRefund.findMany({
    where: { status: 'processed', cashReceiptId: { not: null } },
    include: {
      cashReceipt: {
        include: {
          invoice: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  })

  let applicationsCreated = 0

  for (const refund of refunds) {
    if (!refund.cashReceipt?.invoice) continue

    await prisma.$transaction(async (tx) => {
      const receiptOpenItem = await ensureOpenItem(tx, {
        openItemType: 'customer_receipt',
        accountType: 'Asset',
        subsidiaryId: refund.cashReceipt.invoice.subsidiaryId,
        currencyId: refund.cashReceipt.invoice.currencyId,
        sourceTransactionType: 'invoice-receipt',
        sourceTransactionId: refund.cashReceipt.id,
        sourceNumber: refund.cashReceipt.number ?? refund.cashReceipt.id,
        counterpartyType: 'customer',
        counterpartyId: refund.customerId,
        documentDate: refund.cashReceipt.date,
        postingDate: refund.cashReceipt.date,
        amount: refund.cashReceipt.amount,
      })

      const existing = await findExistingApplication(
        tx,
        receiptOpenItem.id,
        null,
        'customer-refund',
        refund.id,
      )
      if (existing) return

      await applyItems(tx, {
        fromOpenItemId: receiptOpenItem.id,
        applicationType: 'customer_refund_application',
        settlementTransactionType: 'customer-refund',
        settlementTransactionId: refund.id,
        applicationDate: refund.date,
        postingDate: refund.date,
        amount: refund.amount,
        clearingType: 'customer_refund_application',
        currencyId: refund.currencyId ?? refund.cashReceipt.invoice.currencyId,
        subsidiaryId: refund.subsidiaryId ?? refund.cashReceipt.invoice.subsidiaryId,
        counterpartyType: 'customer',
        counterpartyId: refund.customerId,
        memo: refund.reference ?? refund.notes ?? null,
      })
      applicationsCreated += 1
    })
  }

  return applicationsCreated
}

async function main() {
  const invoiceOpenItems = await backfillInvoices()
  const billOpenItems = await backfillBills()
  const invoiceReceiptResult = await backfillInvoiceReceipts()
  const billPaymentResult = await backfillBillPayments()
  const customerRefundApplications = await backfillCustomerRefunds()

  const totals = {
    openItems: await prisma.openItem.count(),
    entries: await prisma.openItemEntry.count(),
    applications: await prisma.openItemApplication.count(),
    clearingDocuments: await prisma.clearingDocumentHeader.count(),
  }

  console.log('Open item backfill complete:')
  console.log(`- Invoice open items created: ${invoiceOpenItems}`)
  console.log(`- Bill open items created: ${billOpenItems}`)
  console.log(`- Receipt open items created: ${invoiceReceiptResult.openItemsCreated}`)
  console.log(`- Receipt applications created: ${invoiceReceiptResult.applicationsCreated}`)
  console.log(`- Payment open items created: ${billPaymentResult.openItemsCreated}`)
  console.log(`- Payment applications created: ${billPaymentResult.applicationsCreated}`)
  console.log(`- Customer refund applications created: ${customerRefundApplications}`)
  console.log(`- Total open items: ${totals.openItems}`)
  console.log(`- Total open item entries: ${totals.entries}`)
  console.log(`- Total open item applications: ${totals.applications}`)
  console.log(`- Total clearing documents: ${totals.clearingDocuments}`)
}

main()
  .catch((error) => {
    console.error('Open item backfill failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
