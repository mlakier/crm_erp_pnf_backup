const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const TRANSACTION_ENTITY_TYPES = [
  'invoice',
  'invoice-receipt',
  'cash-receipt',
  'customer-refund',
  'bill',
  'bill-payment',
  'journal-entry',
  'journal',
  'purchase-order',
  'purchase-requisition',
  'requisition',
  'receipt',
  'fulfillment',
  'sales-order',
  'quote',
  'credit-memo',
  'bill-credit',
  'open-item',
  'clearing-document',
  'fx-revaluation',
]

const RUN_TYPES_TO_CLEAR = ['fx_revaluation']

async function countCurrentState(tx = prisma) {
  return {
    quotes: await tx.quote.count(),
    salesOrders: await tx.salesOrder.count(),
    invoices: await tx.invoice.count(),
    cashReceipts: await tx.cashReceipt.count(),
    customerRefunds: await tx.customerRefund.count(),
    creditMemos: await tx.creditMemo.count(),
    requisitions: await tx.requisition.count(),
    purchaseOrders: await tx.purchaseOrder.count(),
    receipts: await tx.receipt.count(),
    fulfillments: await tx.fulfillment.count(),
    bills: await tx.bill.count(),
    billPayments: await tx.billPayment.count(),
    billCredits: await tx.billCredit.count(),
    journals: await tx.journalEntry.count(),
    openItems: await tx.openItem.count(),
    openItemApplications: await tx.openItemApplication.count(),
    clearingDocuments: await tx.clearingDocumentHeader.count(),
    documentRelationships: await tx.documentRelationship.count(),
    activities: await tx.activity.count(),
    attachments: await tx.attachment.count(),
    approvals: await tx.approvalRecord.count(),
    fxRuns: await tx.runHeader.count({ where: { runType: { in: RUN_TYPES_TO_CLEAR } } }),
  }
}

async function main() {
  const before = await countCurrentState()
  console.log('Transaction-layer counts before reset:')
  console.log(JSON.stringify(before, null, 2))

  await prisma.$transaction(async (tx) => {
    await tx.attachment.deleteMany({
      where: {
        entityType: {
          in: TRANSACTION_ENTITY_TYPES,
        },
      },
    })

    await tx.approvalRecord.deleteMany({
      where: {
        entityType: {
          in: TRANSACTION_ENTITY_TYPES,
        },
      },
    })

    await tx.activity.deleteMany({
      where: {
        entityType: {
          in: TRANSACTION_ENTITY_TYPES,
        },
      },
    })

    const runHeaders = await tx.runHeader.findMany({
      where: { runType: { in: RUN_TYPES_TO_CLEAR } },
      select: { id: true },
    })
    const runHeaderIds = runHeaders.map((row) => row.id)

    if (runHeaderIds.length > 0) {
      await tx.runOutputLink.deleteMany({ where: { runHeaderId: { in: runHeaderIds } } })
      await tx.runException.deleteMany({ where: { runHeaderId: { in: runHeaderIds } } })
      await tx.runItem.deleteMany({ where: { runHeaderId: { in: runHeaderIds } } })
      await tx.runHeader.deleteMany({ where: { id: { in: runHeaderIds } } })
    }

    await tx.documentRelationship.deleteMany()

    await tx.clearingDocumentLine.deleteMany()
    await tx.clearingDocumentHeader.deleteMany()

    await tx.openItemApplication.deleteMany()
    await tx.openItemEntry.deleteMany()
    await tx.openItem.deleteMany()

    await tx.journalEntryLineItem.deleteMany()
    await tx.journalEntry.deleteMany()

    await tx.billPaymentApplication.deleteMany()
    await tx.billPayment.deleteMany()

    await tx.cashReceiptApplication.deleteMany()
    await tx.customerRefund.deleteMany()
    await tx.cashReceipt.deleteMany()

    await tx.creditMemoLineItem.deleteMany()
    await tx.creditMemo.deleteMany()

    await tx.billCreditLineItem.deleteMany()
    await tx.billCredit.deleteMany()

    await tx.billLineItem.deleteMany()
    await tx.bill.deleteMany()

    await tx.invoiceLineItem.deleteMany()
    await tx.invoice.deleteMany()

    await tx.receiptLine.deleteMany()
    await tx.receipt.deleteMany()

    await tx.fulfillmentLine.deleteMany()
    await tx.fulfillment.deleteMany()

    await tx.purchaseOrderLineItem.deleteMany()
    await tx.purchaseOrder.deleteMany()

    await tx.requisitionLineItem.deleteMany()
    await tx.requisition.deleteMany()

    await tx.salesOrderLineItem.deleteMany()
    await tx.salesOrder.deleteMany()

    await tx.quoteLineItem.deleteMany()
    await tx.quote.deleteMany()
  })

  const after = await countCurrentState()
  console.log('Transaction-layer counts after reset:')
  console.log(JSON.stringify(after, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
