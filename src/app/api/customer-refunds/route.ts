import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseMoneyValue } from '@/lib/money'
import { loadListValues } from '@/lib/load-list-values'
import { generateCustomerRefundNumber } from '@/lib/customer-refund-number'
import { loadCompanySetupSettings } from '@/lib/company-setup-settings-store'
import { loadConfiguredRealizedFxPostingAccounts } from '@/lib/company-setup-account-resolver'
import { deriveOpenItemCurrencyContext } from '@/lib/open-item-currency-context'
import { generateNextJournalNumber } from '@/lib/journal-number'
import { logActivity, logCommunicationActivity } from '@/lib/activity'
import {
  buildRealizedFxJournalLines,
  computeRealizedFxLayerAmount,
  deriveCarriedSettlementAmount,
} from '@/lib/settlement-fx-journal'
import {
  applyOpenItems,
  ensureOpenItemForSource,
  findExistingOpenItemApplication,
  syncOpenItemStatus,
} from '@/lib/open-item-service'
import { loadCashBankPostingAccounts } from '@/lib/posting-account-options'

const CUSTOMER_REFUND_POSTING_STATUSES = new Set(['processed'])

async function loadCustomerRefundStatusValues() {
  const values = await loadListValues('CUSTOMER-REFUND-STATUS')
  return values.map((value) => value.toLowerCase())
}

function normalizeCustomerRefundStatus(value: unknown, allowedStatuses: string[], fallback: string) {
  const normalized = typeof value === 'string' ? value.toLowerCase() : fallback
  return allowedStatuses.includes(normalized) ? normalized : fallback
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

async function computeReceiptOverpayment(receiptId: string, excludingRefundId?: string) {
  const receipt = await prisma.cashReceipt.findUnique({
    where: { id: receiptId },
    include: {
      invoice: {
        include: {
          customer: true,
        },
      },
      applications: true,
      customerRefunds: {
        select: { id: true, amount: true, status: true },
      },
    },
  })
  if (!receipt) {
    throw new Error('Selected invoice receipt could not be found')
  }

  const appliedAmount = roundMoney(receipt.applications.reduce((sum, application) => sum + Number(application.appliedAmount), 0))
  const refundedAmount = roundMoney(
    receipt.customerRefunds.reduce((sum, refund) => {
      if (excludingRefundId && refund.id === excludingRefundId) return sum
      if ((refund.status ?? '').toLowerCase() === 'void') return sum
      return sum + Number(refund.amount)
    }, 0),
  )
  const availableAmount = roundMoney(Number(receipt.amount) - appliedAmount - refundedAmount)

  return {
    receipt,
    availableAmount,
  }
}

async function findCustomerRefundPostingAccounts(bankAccountId: string | null | undefined) {
  const companySettings = await loadCompanySetupSettings()

  const arAccount =
    (companySettings.defaultArAccountId
      ? await prisma.chartOfAccounts.findFirst({
          where: {
            id: companySettings.defaultArAccountId,
            active: true,
            isPosting: true,
            accountType: 'Asset',
          },
          select: { id: true },
        })
      : null)
    ?? await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Asset',
        OR: [
          { name: { contains: 'Accounts Receivable', mode: 'insensitive' } },
          { accountId: '1100' },
        ],
      },
      select: { id: true },
    })

  const bankAccount =
    (bankAccountId
      ? await prisma.chartOfAccounts.findFirst({
          where: {
            id: bankAccountId,
            active: true,
            isPosting: true,
            accountType: 'Asset',
          },
          select: { id: true },
        })
      : null)
    ?? (await loadCashBankPostingAccounts())[0]

  return {
    arAccountId: arAccount?.id ?? null,
    bankAccountId: bankAccount?.id ?? null,
  }
}

async function postCustomerRefundJournal(refundId: string) {
  const existingJournal = await prisma.journalEntry.findFirst({
    where: { sourceType: 'customer-refund', sourceId: refundId },
    select: { id: true },
  })
  if (existingJournal) return

  const refund = await prisma.customerRefund.findUnique({
    where: { id: refundId },
    include: {
      customer: true,
      cashReceipt: {
        include: {
          invoice: true,
        },
      },
    },
  })
  if (!refund || !CUSTOMER_REFUND_POSTING_STATUSES.has(refund.status.toLowerCase())) return

  const amount = Number(refund.amount)
  if (!Number.isFinite(amount) || amount <= 0) return

  const { arAccountId, bankAccountId } = await findCustomerRefundPostingAccounts(refund.bankAccountId)
  const realizedFxAccounts = await loadConfiguredRealizedFxPostingAccounts()

  if (refund.cashReceipt?.invoice) {
    const receiptCurrencyContext = await deriveOpenItemCurrencyContext({
      subsidiaryId: refund.cashReceipt.invoice.subsidiaryId ?? null,
      transactionCurrencyId: refund.cashReceipt.invoice.currencyId ?? null,
      transactionAmount: refund.cashReceipt.amount,
    })

    const receiptOpenItem = await ensureOpenItemForSource({
      openItemType: 'customer_receipt',
      accountType: 'Asset',
      accountId: bankAccountId,
      subsidiaryId: refund.cashReceipt.invoice.subsidiaryId ?? null,
      transactionCurrencyId: receiptCurrencyContext.transactionCurrencyId,
      localCurrencyId: receiptCurrencyContext.localCurrencyId,
      functionalCurrencyId: receiptCurrencyContext.functionalCurrencyId,
      groupCurrencyId: receiptCurrencyContext.groupCurrencyId,
      sourceTransactionType: 'invoice-receipt',
      sourceTransactionId: refund.cashReceipt.id,
      sourceNumber: refund.cashReceipt.number ?? refund.cashReceipt.id,
      counterpartyType: 'customer',
      counterpartyId: refund.customerId,
      documentDate: refund.cashReceipt.date,
      postingDate: refund.cashReceipt.date,
      originalTransactionAmount: refund.cashReceipt.amount,
      originalLocalAmount: receiptCurrencyContext.originalLocalAmount,
      originalFunctionalAmount: receiptCurrencyContext.originalFunctionalAmount,
      originalGroupAmount: receiptCurrencyContext.originalGroupAmount,
      memo: refund.cashReceipt.reference ?? null,
      createdById: refund.userId ?? null,
    })

    const refundCurrencyContext = await deriveOpenItemCurrencyContext({
      subsidiaryId: refund.subsidiaryId ?? refund.cashReceipt.invoice.subsidiaryId ?? null,
      transactionCurrencyId: refund.currencyId ?? refund.cashReceipt.invoice.currencyId ?? null,
      transactionAmount: amount,
      effectiveDate: refund.date,
      rateType: 'spot',
    })

    const refundOpenItem = await ensureOpenItemForSource({
      openItemType: 'customer_refund',
      accountType: 'Asset',
      accountId: bankAccountId,
      subsidiaryId: refund.subsidiaryId ?? refund.cashReceipt.invoice.subsidiaryId ?? null,
      transactionCurrencyId: refundCurrencyContext.transactionCurrencyId,
      localCurrencyId: refundCurrencyContext.localCurrencyId,
      functionalCurrencyId: refundCurrencyContext.functionalCurrencyId,
      groupCurrencyId: refundCurrencyContext.groupCurrencyId,
      sourceTransactionType: 'customer-refund',
      sourceTransactionId: refund.id,
      sourceNumber: refund.number,
      counterpartyType: 'customer',
      counterpartyId: refund.customerId,
      documentDate: refund.date,
      postingDate: refund.date,
      dueDate: refund.date,
      originalTransactionAmount: amount,
      originalLocalAmount: refundCurrencyContext.originalLocalAmount,
      originalFunctionalAmount: refundCurrencyContext.originalFunctionalAmount,
      originalGroupAmount: refundCurrencyContext.originalGroupAmount,
      memo: refund.reference ?? refund.notes ?? null,
      createdById: refund.userId ?? null,
    })

    const existingApplication = await findExistingOpenItemApplication({
      fromOpenItemId: refundOpenItem.id,
      toOpenItemId: receiptOpenItem.id,
      settlementTransactionType: 'customer-refund',
      settlementTransactionId: refund.id,
    })

    const postedApplication = existingApplication ?? (
      await applyOpenItems({
        fromOpenItemId: refundOpenItem.id,
        toOpenItemId: receiptOpenItem.id,
        applicationType: 'customer_refund_application',
        settlementTransactionType: 'customer-refund',
        settlementTransactionId: refund.id,
        applicationDate: refund.date,
        postingDate: refund.date,
        transactionAmount: amount,
        localAmount: refundCurrencyContext.originalLocalAmount,
        functionalAmount: refundCurrencyContext.originalFunctionalAmount,
        groupAmount: refundCurrencyContext.originalGroupAmount,
        memo: refund.reference ?? refund.notes ?? null,
        createdById: refund.userId ?? null,
        clearingType: 'customer_refund_application',
        automationSource: 'customer-refund-posting',
      })
    ).application

    if (existingJournal) return

    if (!arAccountId || !bankAccountId) return

    const localAmount = postedApplication.localAmount == null ? null : Number(postedApplication.localAmount)
    const functionalAmount =
      postedApplication.functionalAmount == null ? null : Number(postedApplication.functionalAmount)
    const groupAmount = postedApplication.groupAmount == null ? null : Number(postedApplication.groupAmount)
    const realizedFxLocalAmount =
      postedApplication.realizedFxLocalAmount == null ? null : Number(postedApplication.realizedFxLocalAmount)
    const realizedFxFunctionalAmount =
      postedApplication.realizedFxFunctionalAmount == null ? null : Number(postedApplication.realizedFxFunctionalAmount)
    const realizedFxGroupAmount = computeRealizedFxLayerAmount({
      originalTransactionAmount:
        receiptOpenItem.originalTransactionAmount == null ? null : Number(receiptOpenItem.originalTransactionAmount),
      originalTranslatedAmount:
        receiptOpenItem.originalGroupAmount == null ? null : Number(receiptOpenItem.originalGroupAmount),
      settledTransactionAmount: amount,
      settledTranslatedAmount:
        refundCurrencyContext.originalGroupAmount == null ? null : Number(refundCurrencyContext.originalGroupAmount),
    })

    const arLocalDebit = deriveCarriedSettlementAmount(localAmount, realizedFxLocalAmount)
    const arFunctionalDebit = deriveCarriedSettlementAmount(functionalAmount, realizedFxFunctionalAmount)
    const arGroupDebit = deriveCarriedSettlementAmount(groupAmount, realizedFxGroupAmount)

    const fxLines = buildRealizedFxJournalLines({
      description: `${refund.number} realized FX`,
      memo: refund.reference ?? refund.notes ?? null,
      subsidiaryId: refund.subsidiaryId ?? refund.cashReceipt.invoice.subsidiaryId ?? null,
      customerId: refund.customerId,
      realizedFxGainAccountId: realizedFxAccounts.realizedFxGainAccountId,
      realizedFxLossAccountId: realizedFxAccounts.realizedFxLossAccountId,
      orientation: 'asset',
      localAmount: realizedFxLocalAmount,
      functionalAmount: realizedFxFunctionalAmount,
      groupAmount: realizedFxGroupAmount,
      startingDisplayOrder: 2,
    })

    const journalNumber = await generateNextJournalNumber()
    await prisma.journalEntry.create({
      data: {
        number: journalNumber,
        date: refund.date,
        description: `Customer refund ${refund.number}`,
        journalType: 'standard',
        status: 'approved',
        total: amount,
        sourceType: 'customer-refund',
        sourceId: refund.id,
        subsidiaryId: refund.subsidiaryId,
        currencyId: refund.currencyId,
        userId: refund.userId,
        lineItems: {
          create: [
            {
              displayOrder: 0,
              description: `${refund.number} customer refund`,
              memo: refund.reference ?? null,
              activityTypeCode: 'ar_settlement',
              debit: amount,
              credit: 0,
              localDebit: arLocalDebit == null ? undefined : arLocalDebit,
              functionalDebit: arFunctionalDebit == null ? undefined : arFunctionalDebit,
              groupDebit: arGroupDebit == null ? undefined : arGroupDebit,
              accountId: arAccountId,
              subsidiaryId: refund.subsidiaryId,
              customerId: refund.customerId,
            },
            {
              displayOrder: 1,
              description: `${refund.number} cash disbursement`,
              memo: refund.reference ?? null,
              activityTypeCode: 'cash_disbursement',
              debit: 0,
              credit: amount,
              localCredit:
                refundCurrencyContext.originalLocalAmount == null
                  ? undefined
                  : Number(refundCurrencyContext.originalLocalAmount),
              functionalCredit:
                refundCurrencyContext.originalFunctionalAmount == null
                  ? undefined
                  : Number(refundCurrencyContext.originalFunctionalAmount),
              groupCredit:
                refundCurrencyContext.originalGroupAmount == null
                  ? undefined
                  : Number(refundCurrencyContext.originalGroupAmount),
              accountId: bankAccountId,
              subsidiaryId: refund.subsidiaryId,
              customerId: refund.customerId,
            },
            ...fxLines,
          ],
        },
      },
    })

    await logActivity({
      entityType: 'customer-refund',
      entityId: refund.id,
      action: 'post',
      summary: `Posted customer refund ${refund.number} to GL`,
      userId: refund.userId ?? undefined,
    })
    return
  }

  if (!existingJournal) return
}

async function unpostCustomerRefundJournal(refundId: string) {
  await prisma.$transaction(async (tx) => {
    const applications = await tx.openItemApplication.findMany({
      where: {
        settlementTransactionType: 'customer-refund',
        settlementTransactionId: refundId,
      },
      select: {
        id: true,
        fromOpenItemId: true,
        toOpenItemId: true,
      },
    })

    const applicationIds = applications.map((application) => application.id)
    const openItemIdsToResync = Array.from(
      new Set(
        applications.flatMap((application) =>
          [application.fromOpenItemId, application.toOpenItemId].filter(
            (value): value is string => Boolean(value),
          ),
        ),
      ),
    )

    if (applicationIds.length) {
      await tx.openItemEntry.deleteMany({
        where: {
          sourceApplicationId: { in: applicationIds },
        },
      })
      await tx.openItemApplication.deleteMany({
        where: { id: { in: applicationIds } },
      })
      await tx.clearingDocumentHeader.deleteMany({
        where: {
          sourceTransactionType: 'customer-refund',
          sourceTransactionId: refundId,
        },
      })
    }

    const refundOpenItems = await tx.openItem.findMany({
      where: {
        sourceTransactionType: 'customer-refund',
        sourceTransactionId: refundId,
      },
      select: { id: true },
    })
    const refundOpenItemIds = refundOpenItems.map((item) => item.id)

    if (refundOpenItemIds.length) {
      await tx.openItemEntry.deleteMany({
        where: { openItemId: { in: refundOpenItemIds } },
      })
      await tx.openItem.deleteMany({
        where: { id: { in: refundOpenItemIds } },
      })
    }

    await tx.journalEntry.deleteMany({
      where: { sourceType: 'customer-refund', sourceId: refundId },
    })

    for (const openItemId of openItemIdsToResync.filter((id) => !refundOpenItemIds.includes(id))) {
      await syncOpenItemStatus(openItemId, { tx })
    }
  })
}

async function syncCustomerRefundPosting(refundId: string, status: string) {
  if (CUSTOMER_REFUND_POSTING_STATUSES.has(status.toLowerCase())) {
    await unpostCustomerRefundJournal(refundId)
    await postCustomerRefundJournal(refundId)
    return
  }
  await unpostCustomerRefundJournal(refundId)
}

async function validateCustomerRefund({
  customerId,
  cashReceiptId,
  amount,
  currentRefundId,
}: {
  customerId: string
  cashReceiptId?: string | null
  amount: number
  currentRefundId?: string
}) {
  if (!customerId) throw new Error('Customer is required')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Refund amount must be greater than zero')
  if (!cashReceiptId) throw new Error('Refund source invoice receipt is required')

  const { receipt, availableAmount } = await computeReceiptOverpayment(cashReceiptId, currentRefundId)
  if (receipt.invoice.customerId !== customerId) {
    throw new Error('Selected overpayment source does not belong to the chosen customer')
  }
  if (!receipt.invoice.subsidiaryId || !receipt.invoice.currencyId) {
    throw new Error('Selected invoice receipt does not have complete transaction subsidiary/currency context')
  }
  if ((receipt.overpaymentHandling ?? '').toLowerCase() !== 'refund_pending') {
    throw new Error('Selected invoice receipt is not marked for refund')
  }
  if (availableAmount <= 0) {
    throw new Error('Selected invoice receipt does not have refundable overpayment available')
  }
  if (amount > availableAmount + 0.005) {
    throw new Error(`Refund amount exceeds available refundable balance of ${availableAmount.toFixed(2)}`)
  }

  return {
    subsidiaryId: receipt.invoice.subsidiaryId,
    currencyId: receipt.invoice.currencyId,
    userId: receipt.invoice.userId ?? null,
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const row = await prisma.customerRefund.findUnique({
      where: { id },
      include: {
        customer: true,
        cashReceipt: {
          include: {
            invoice: { include: { customer: true } },
          },
        },
        bankAccount: true,
      },
    })
    return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const rows = await prisma.customerRefund.findMany({
    include: {
      customer: true,
      cashReceipt: { include: { invoice: true } },
      bankAccount: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action')
    const body = await req.json()
    if (action === 'send-email') {
      const {
        customerRefundId,
        userId,
        to,
        from,
        subject,
        preview,
        attachPdf,
      } = body as {
        customerRefundId?: string
        userId?: string | null
        to?: string
        from?: string
        subject?: string
        preview?: string
        attachPdf?: boolean
      }

      if (!customerRefundId || !to?.trim() || !subject?.trim()) {
        return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
      }

      const refund = await prisma.customerRefund.findUnique({
        where: { id: customerRefundId },
        select: { id: true },
      })

      if (!refund) {
        return NextResponse.json({ error: 'Customer refund not found' }, { status: 404 })
      }

      await logCommunicationActivity({
        entityType: 'customer-refund',
        entityId: customerRefundId,
        userId: userId ?? null,
        context: 'UI',
        channel: 'Email',
        direction: 'Outbound',
        subject: subject.trim(),
        from: from?.trim() || '-',
        to: to.trim(),
        status: attachPdf ? 'Prepared (PDF)' : 'Prepared',
        preview: (preview?.trim() || '-').slice(0, 500),
      })

      return NextResponse.json({ ok: true })
    }

    const statusValues = await loadCustomerRefundStatusValues()
    const normalizedStatus = normalizeCustomerRefundStatus(body.status, statusValues, 'draft')
    const amount = parseMoneyValue(body.amount)
    const validation = await validateCustomerRefund({
      customerId: body.customerId,
      cashReceiptId: body.cashReceiptId || null,
      amount,
    })
    const number = await generateCustomerRefundNumber()

    const row = await prisma.customerRefund.create({
      data: {
        number,
        customerId: body.customerId,
        cashReceiptId: body.cashReceiptId || null,
        bankAccountId: body.bankAccountId || null,
        amount,
        date: new Date(body.date),
        method: body.method,
        reference: body.reference || null,
        notes: body.notes || null,
        status: normalizedStatus,
        subsidiaryId: validation.subsidiaryId,
        currencyId: validation.currencyId,
        userId: validation.userId,
      },
    })

    await syncCustomerRefundPosting(row.id, normalizedStatus)
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create customer refund'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json()
    const before = await prisma.customerRefund.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: 'Customer refund not found' }, { status: 404 })

    const statusValues = await loadCustomerRefundStatusValues()
    const normalizedStatus = normalizeCustomerRefundStatus(body.status, statusValues, before.status.toLowerCase())
    const amount = body.amount !== undefined ? parseMoneyValue(body.amount) : Number(before.amount)
    const customerId = body.customerId ?? before.customerId
    const cashReceiptId = body.cashReceiptId !== undefined ? body.cashReceiptId || null : before.cashReceiptId

    const validation = await validateCustomerRefund({
      customerId,
      cashReceiptId,
      amount,
      currentRefundId: before.id,
    })

    const row = await prisma.customerRefund.update({
      where: { id },
      data: {
        ...(body.customerId !== undefined ? { customerId } : {}),
        ...(body.cashReceiptId !== undefined ? { cashReceiptId } : {}),
        ...(body.bankAccountId !== undefined ? { bankAccountId: body.bankAccountId || null } : {}),
        ...(body.amount !== undefined ? { amount } : {}),
        ...(body.date ? { date: new Date(body.date) } : {}),
        ...(body.method !== undefined ? { method: body.method } : {}),
        ...(body.reference !== undefined ? { reference: body.reference || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
        ...(body.status !== undefined ? { status: normalizedStatus } : {}),
        subsidiaryId: validation.subsidiaryId,
        currencyId: validation.currencyId,
        userId: validation.userId,
      },
    })

    await syncCustomerRefundPosting(row.id, normalizedStatus)
    await logActivity({
      entityType: 'customer-refund',
      entityId: row.id,
      action: 'update',
      summary: `Updated customer refund ${row.number}`,
      userId: row.userId ?? undefined,
    })
    return NextResponse.json(row)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update customer refund'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await unpostCustomerRefundJournal(id)
  await prisma.customerRefund.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
