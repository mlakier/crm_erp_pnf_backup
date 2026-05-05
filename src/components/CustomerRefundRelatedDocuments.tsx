'use client'

import { fmtCurrency } from '@/lib/format'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'

export default function CustomerRefundRelatedDocuments({
  customer,
  opportunity,
  quote,
  salesOrder,
  invoice,
  receipt,
  moneySettings,
  embedded = false,
  showDisplayControl = true,
  defaultCurrencyCode,
}: {
  customer: { id: string; number: string; name: string; email?: string | null } | null
  opportunity: { id: string; number: string; name: string; status: string; total: number; currencyCode?: string | null } | null
  quote: { id: string; number: string; status: string; total: number; currencyCode?: string | null } | null
  salesOrder: { id: string; number: string; status: string; total: number; currencyCode?: string | null } | null
  invoice: { id: string; number: string; status: string; total: number; currencyCode?: string | null } | null
  receipt: { id: string; number: string; status: string; amount: number; currencyCode?: string | null } | null
  moneySettings?: Parameters<typeof import('@/lib/format').fmtCurrency>[2]
  embedded?: boolean
  showDisplayControl?: boolean
  defaultCurrencyCode?: string | null
}) {
  const formatAmount = (value: number, currencyCode?: string | null) =>
    fmtCurrency(value, currencyCode ?? defaultCurrencyCode ?? undefined, moneySettings)
  const tabs = [
    ...(customer
      ? [{
          key: 'master-data',
          label: 'Master Data',
          count: 1,
          emptyMessage: 'No related master data records are linked to this refund.',
          rows: [
            {
              id: customer.id,
              type: 'Customer',
              reference: customer.number,
              name: customer.name,
              details: customer.email ?? '-',
              href: `/customers/${customer.id}`,
            },
          ],
        }]
      : []),
    {
      key: 'transactions',
      label: 'Transactions',
      count:
        (opportunity ? 1 : 0) +
        (quote ? 1 : 0) +
        (salesOrder ? 1 : 0) +
        (invoice ? 1 : 0) +
        (receipt ? 1 : 0),
      emptyMessage: 'No related transactions are linked to this refund.',
      rows: [
        ...(opportunity
          ? [{
              id: opportunity.id,
              type: 'Opportunity',
              reference: opportunity.number,
              name: opportunity.name,
              details: `${opportunity.status} | ${formatAmount(opportunity.total, opportunity.currencyCode)}`,
              href: `/opportunities/${opportunity.id}`,
            }]
          : []),
        ...(quote
          ? [{
              id: quote.id,
              type: 'Quote',
              reference: quote.number,
              name: quote.status,
              details: formatAmount(quote.total, quote.currencyCode),
              href: `/quotes/${quote.id}`,
            }]
          : []),
        ...(salesOrder
          ? [{
              id: salesOrder.id,
              type: 'Sales Order',
              reference: salesOrder.number,
              name: salesOrder.status,
              details: formatAmount(salesOrder.total, salesOrder.currencyCode),
              href: `/sales-orders/${salesOrder.id}`,
            }]
          : []),
        ...(invoice
          ? [{
              id: invoice.id,
              type: 'Invoice',
              reference: invoice.number,
              name: invoice.status,
              details: formatAmount(invoice.total, invoice.currencyCode),
              href: `/invoices/${invoice.id}`,
            }]
          : []),
        ...(receipt
          ? [{
              id: receipt.id,
              type: 'Invoice Receipt',
              reference: receipt.number,
              name: receipt.status,
              details: formatAmount(receipt.amount, receipt.currencyCode),
              href: `/invoice-receipts/${receipt.id}`,
            }]
          : []),
      ],
    },
  ]

  return (
    <RelatedRecordsSection embedded={embedded} showDisplayControl={showDisplayControl} tabs={tabs} />
  )
}
