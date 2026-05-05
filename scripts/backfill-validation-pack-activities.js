const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function formatActivityValue(value) {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value.map((entry) => formatActivityValue(entry)).filter(Boolean).join(', ')
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value)
}

function createFieldChangeSummary(payload) {
  return `FIELD_CHANGE:${JSON.stringify(payload)}`
}

async function createCreateSnapshots(tx, { entityType, entityId, userId = null, summary, context, fields }) {
  const existingCount = await tx.activity.count({ where: { entityType, entityId } })
  if (existingCount > 0) return false

  await tx.activity.create({
    data: {
      entityType,
      entityId,
      action: 'create',
      summary,
      userId,
    },
  })

  const snapshots = fields
    .map((field) => {
      const formattedValue = formatActivityValue(field.value)
      if (!formattedValue) return null
      return {
        entityType,
        entityId,
        action: 'create',
        userId,
        summary: createFieldChangeSummary({
          context,
          fieldName: field.fieldName,
          oldValue: '',
          newValue: formattedValue,
        }),
      }
    })
    .filter(Boolean)

  if (snapshots.length > 0) {
    await tx.activity.createMany({ data: snapshots })
  }

  return true
}

async function main() {
  const summary = await prisma.$transaction(async (tx) => {
    let created = 0

    const invoices = await tx.invoice.findMany({
      where: { number: { startsWith: 'INV-VAL-' } },
      select: {
        id: true, number: true, userId: true, customerId: true, salesOrderId: true,
        status: true, total: true, dueDate: true, paidDate: true, subsidiaryId: true, currencyId: true,
      },
    })
    for (const row of invoices) {
      if (await createCreateSnapshots(tx, {
        entityType: 'invoice',
        entityId: row.id,
        userId: row.userId,
        summary: `Created invoice ${row.number}`,
        context: 'Invoice Header',
        fields: [
          { fieldName: 'Invoice #', value: row.number },
          { fieldName: 'Customer', value: row.customerId },
          { fieldName: 'Sales Order', value: row.salesOrderId },
          { fieldName: 'Status', value: row.status },
          { fieldName: 'Total', value: row.total },
          { fieldName: 'Due Date', value: row.dueDate },
          { fieldName: 'Paid Date', value: row.paidDate },
          { fieldName: 'Subsidiary', value: row.subsidiaryId },
          { fieldName: 'Currency', value: row.currencyId },
        ],
      })) created += 1
    }

    const receipts = await tx.cashReceipt.findMany({
      where: { number: { startsWith: 'IR-VAL-' } },
      select: {
        id: true, number: true, invoiceId: true, bankAccountId: true, amount: true, date: true,
        method: true, reference: true, status: true, overpaymentHandling: true,
      },
    })
    for (const row of receipts) {
      if (await createCreateSnapshots(tx, {
        entityType: 'invoice-receipt',
        entityId: row.id,
        userId: null,
        summary: `Created invoice receipt ${row.number ?? row.id}`,
        context: 'Invoice Receipt Details',
        fields: [
          { fieldName: 'Business Id', value: row.number },
          { fieldName: 'Invoice', value: row.invoiceId },
          { fieldName: 'Bank Account', value: row.bankAccountId },
          { fieldName: 'Amount', value: row.amount },
          { fieldName: 'Date', value: row.date },
          { fieldName: 'Method', value: row.method },
          { fieldName: 'Reference', value: row.reference },
          { fieldName: 'Status', value: row.status },
          { fieldName: 'Overpayment Handling', value: row.overpaymentHandling },
        ],
      })) created += 1
    }

    const bills = await tx.bill.findMany({
      where: { number: { startsWith: 'BILL-VAL-' } },
      select: {
        id: true, number: true, userId: true, vendorId: true, vendorBillNumber: true, vendorBillDate: true,
        purchaseOrderId: true, total: true, date: true, dueDate: true, status: true, notes: true,
        subsidiaryId: true, currencyId: true,
      },
    })
    for (const row of bills) {
      if (await createCreateSnapshots(tx, {
        entityType: 'bill',
        entityId: row.id,
        userId: row.userId,
        summary: `Created bill ${row.number}`,
        context: 'Bill Header',
        fields: [
          { fieldName: 'Bill #', value: row.number },
          { fieldName: 'Vendor', value: row.vendorId },
          { fieldName: 'Vendor Bill Number', value: row.vendorBillNumber },
          { fieldName: 'Vendor Bill Date', value: row.vendorBillDate },
          { fieldName: 'Purchase Order', value: row.purchaseOrderId },
          { fieldName: 'Total', value: row.total },
          { fieldName: 'Bill Date', value: row.date },
          { fieldName: 'Due Date', value: row.dueDate },
          { fieldName: 'Status', value: row.status },
          { fieldName: 'Notes', value: row.notes },
          { fieldName: 'Subsidiary', value: row.subsidiaryId },
          { fieldName: 'Currency', value: row.currencyId },
        ],
      })) created += 1
    }

    const billPayments = await tx.billPayment.findMany({
      where: { number: { startsWith: 'BP-VAL-' } },
      select: {
        id: true, number: true, vendorId: true, billId: true, amount: true, date: true, method: true,
        bankAccountId: true, reference: true, status: true, notes: true,
      },
    })
    for (const row of billPayments) {
      if (await createCreateSnapshots(tx, {
        entityType: 'bill-payment',
        entityId: row.id,
        userId: null,
        summary: `Created bill payment ${row.number ?? row.id}`,
        context: 'Bill Payment Details',
        fields: [
          { fieldName: 'Business Id', value: row.number },
          { fieldName: 'Vendor', value: row.vendorId },
          { fieldName: 'Bill', value: row.billId },
          { fieldName: 'Amount', value: row.amount },
          { fieldName: 'Date', value: row.date },
          { fieldName: 'Method', value: row.method },
          { fieldName: 'Bank Account', value: row.bankAccountId },
          { fieldName: 'Reference', value: row.reference },
          { fieldName: 'Status', value: row.status },
          { fieldName: 'Notes', value: row.notes },
        ],
      })) created += 1
    }

    const journals = await tx.journalEntry.findMany({
      where: { number: { startsWith: 'JE-VAL-' } },
      select: {
        id: true, number: true, userId: true, date: true, description: true, status: true,
        journalType: true, isOpenItemRelevant: true, subsidiaryId: true, currencyId: true,
        accountingPeriodId: true, total: true,
      },
    })
    for (const row of journals) {
      if (await createCreateSnapshots(tx, {
        entityType: 'journal-entry',
        entityId: row.id,
        userId: row.userId,
        summary: `Created journal entry ${row.number}`,
        context: 'Journal Header',
        fields: [
          { fieldName: 'Journal Id', value: row.number },
          { fieldName: 'Date', value: row.date },
          { fieldName: 'Description', value: row.description },
          { fieldName: 'Status', value: row.status },
          { fieldName: 'Journal Type', value: row.journalType },
          { fieldName: 'Open Item Relevant', value: row.isOpenItemRelevant },
          { fieldName: 'Subsidiary', value: row.subsidiaryId },
          { fieldName: 'Currency', value: row.currencyId },
          { fieldName: 'Accounting Period', value: row.accountingPeriodId },
          { fieldName: 'Total', value: row.total },
        ],
      })) created += 1
    }

    return { created }
  })

  console.log(JSON.stringify(summary, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
