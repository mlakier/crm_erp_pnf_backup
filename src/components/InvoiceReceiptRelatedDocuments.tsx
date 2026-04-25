'use client'

import InvoiceRelatedDocuments from '@/components/InvoiceRelatedDocuments'

export default function InvoiceReceiptRelatedDocuments({
  salesOrder,
  quote,
  opportunity,
  cashReceipts,
  moneySettings,
}: {
  salesOrder: { id: string; number: string; status: string; total: number } | null
  quote: { id: string; number: string; status: string; total: number } | null
  opportunity: { id: string; number: string; name: string; status: string; total: number } | null
  cashReceipts: Array<{
    id: string
    number: string | null
    amount: number
    date: string
    method: string
    reference: string | null
  }>
  moneySettings?: Parameters<typeof import('@/lib/format').fmtCurrency>[2]
}) {
  return (
    <InvoiceRelatedDocuments
      salesOrders={
        salesOrder
          ? [
              {
                id: salesOrder.id,
                number: salesOrder.number,
                status: salesOrder.status,
                total: salesOrder.total,
              },
            ]
          : []
      }
      quotes={
        quote
          ? [
              {
                id: quote.id,
                number: quote.number,
                status: quote.status,
                total: quote.total,
              },
            ]
          : []
      }
      opportunities={
        opportunity
          ? [
              {
                id: opportunity.id,
                number: opportunity.number,
                name: opportunity.name,
                status: opportunity.status,
                total: opportunity.total,
              },
            ]
          : []
      }
      cashReceipts={cashReceipts}
      moneySettings={moneySettings}
    />
  )
}
