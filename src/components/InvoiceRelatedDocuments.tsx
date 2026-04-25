'use client'

import Link from 'next/link'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import TransactionRelatedDocumentsTabs, {
  RelatedDocumentsStatusBadge,
} from '@/components/TransactionRelatedDocumentsTabs'

export default function InvoiceRelatedDocuments({
  salesOrders,
  quotes,
  opportunities,
  cashReceipts,
  moneySettings,
}: {
  salesOrders: Array<{
    id: string
    number: string
    status: string
    total: number
  }>
  quotes: Array<{
    id: string
    number: string
    status: string
    total: number
  }>
  opportunities: Array<{
    id: string
    number: string
    name: string
    status: string
    total: number
  }>
  cashReceipts: Array<{
    id: string
    number: string | null
    amount: number
    date: string
    method: string
    reference: string | null
  }>
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}) {
  return (
    <TransactionRelatedDocumentsTabs
      defaultActiveKey="sales-orders"
      tabs={[
        {
          key: 'sales-orders',
          label: 'Sales Orders',
          count: salesOrders.length,
          tone: 'upstream',
          emptyMessage: 'No source sales order is linked to this invoice.',
          headers: ['TXN ID', 'STATUS', 'TOTAL'],
          rows: salesOrders.map((salesOrder) => ({
            id: salesOrder.id,
            cells: [
              <Link
                key="link"
                href={`/sales-orders/${salesOrder.id}`}
                className="hover:underline"
                style={{ color: 'var(--accent-primary-strong)' }}
              >
                {salesOrder.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={salesOrder.status} />,
              fmtCurrency(salesOrder.total, undefined, moneySettings),
            ],
          })),
        },
        {
          key: 'quotes',
          label: 'Quotes',
          count: quotes.length,
          tone: 'upstream',
          emptyMessage: 'No source quote is linked to this invoice.',
          headers: ['TXN ID', 'STATUS', 'TOTAL'],
          rows: quotes.map((quote) => ({
            id: quote.id,
            cells: [
              <Link
                key="link"
                href={`/quotes/${quote.id}`}
                className="hover:underline"
                style={{ color: 'var(--accent-primary-strong)' }}
              >
                {quote.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={quote.status} />,
              fmtCurrency(quote.total, undefined, moneySettings),
            ],
          })),
        },
        {
          key: 'opportunities',
          label: 'Opportunities',
          count: opportunities.length,
          tone: 'upstream',
          emptyMessage: 'No source opportunity is linked to this invoice.',
          headers: ['TXN ID', 'NAME', 'STATUS', 'TOTAL'],
          rows: opportunities.map((opportunity) => ({
            id: opportunity.id,
            cells: [
              <Link
                key="link"
                href={`/opportunities/${opportunity.id}`}
                className="hover:underline"
                style={{ color: 'var(--accent-primary-strong)' }}
              >
                {opportunity.number}
              </Link>,
              opportunity.name,
              <RelatedDocumentsStatusBadge key="status" status={opportunity.status} />,
              fmtCurrency(opportunity.total, undefined, moneySettings),
            ],
          })),
        },
        {
          key: 'customer-receipts',
          label: 'Customer Receipts',
          count: cashReceipts.length,
          tone: 'downstream',
          emptyMessage: 'No customer receipts are linked to this invoice yet.',
          headers: ['TXN ID', 'AMOUNT', 'DATE', 'METHOD', 'REFERENCE'],
          rows: cashReceipts.map((receipt) => ({
            id: receipt.id,
            cells: [
              receipt.number ?? receipt.id,
              fmtCurrency(receipt.amount, undefined, moneySettings),
              fmtDocumentDate(receipt.date, moneySettings),
              receipt.method,
              receipt.reference ?? '-',
            ],
          })),
        },
      ]}
    />
  )
}
