'use client'

import Link from 'next/link'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import TransactionRelatedDocumentsTabs, {
  RelatedDocumentsStatusBadge,
} from '@/components/TransactionRelatedDocumentsTabs'

export default function InvoiceRelatedDocuments({
  invoices,
  salesOrders,
  quotes,
  opportunities,
  cashReceipts,
  moneySettings,
  embedded = false,
  showDisplayControl = true,
  defaultActiveKey = 'opportunities',
  defaultCurrencyCode,
}: {
  invoices?: Array<{
    id: string
    number: string
    status: string
    total: number
    currencyCode?: string | null
  }>
  salesOrders: Array<{
    id: string
    number: string
    status: string
    total: number
    currencyCode?: string | null
  }>
  quotes: Array<{
    id: string
    number: string
    status: string
    total: number
    currencyCode?: string | null
  }>
  opportunities: Array<{
    id: string
    number: string
    name: string
    status: string
    total: number
    currencyCode?: string | null
  }>
  cashReceipts: Array<{
    id: string
    number: string | null
    amount: number
    date: string
    method: string
    reference: string | null
    currencyCode?: string | null
  }>
  moneySettings?: Parameters<typeof fmtCurrency>[2]
  embedded?: boolean
  showDisplayControl?: boolean
  defaultActiveKey?: string
  defaultCurrencyCode?: string | null
}) {
  const formatAmount = (value: number, currencyCode?: string | null) =>
    fmtCurrency(value, currencyCode ?? defaultCurrencyCode ?? undefined, moneySettings)
  return (
    <TransactionRelatedDocumentsTabs
      embedded={embedded}
      showDisplayControl={showDisplayControl}
      defaultActiveKey={defaultActiveKey}
      tabs={[
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
              formatAmount(opportunity.total, opportunity.currencyCode),
            ],
            filterValues: [
              opportunity.number,
              opportunity.name,
              opportunity.status,
              formatAmount(opportunity.total, opportunity.currencyCode),
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
              formatAmount(quote.total, quote.currencyCode),
            ],
            filterValues: [
              quote.number,
              quote.status,
              formatAmount(quote.total, quote.currencyCode),
            ],
          })),
        },
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
              formatAmount(salesOrder.total, salesOrder.currencyCode),
            ],
            filterValues: [
              salesOrder.number,
              salesOrder.status,
              formatAmount(salesOrder.total, salesOrder.currencyCode),
            ],
          })),
        },
        {
          key: 'invoices',
          label: 'Invoices',
          count: invoices?.length ?? 0,
          tone: 'upstream',
          emptyMessage: 'No linked invoices.',
          headers: ['TXN ID', 'STATUS', 'TOTAL'],
          rows: (invoices ?? []).map((invoice) => ({
            id: invoice.id,
            cells: [
              <Link
                key="link"
                href={`/invoices/${invoice.id}`}
                className="hover:underline"
                style={{ color: 'var(--accent-primary-strong)' }}
              >
                {invoice.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={invoice.status} />,
              formatAmount(invoice.total, invoice.currencyCode),
            ],
            filterValues: [
              invoice.number,
              invoice.status,
              formatAmount(invoice.total, invoice.currencyCode),
            ],
          })),
        },
        {
          key: 'customer-receipts',
          label: 'Invoice Receipts',
          count: cashReceipts.length,
          tone: 'downstream',
          emptyMessage: 'No invoice receipts are linked to this invoice yet.',
          headers: ['TXN ID', 'AMOUNT', 'DATE', 'METHOD', 'REFERENCE'],
          rows: cashReceipts.map((receipt) => ({
            id: receipt.id,
            cells: [
              <Link
                key="link"
                href={`/invoice-receipts/${receipt.id}`}
                className="hover:underline"
                style={{ color: 'var(--accent-primary-strong)' }}
              >
                {receipt.number ?? receipt.id}
              </Link>,
              formatAmount(receipt.amount, receipt.currencyCode),
              fmtDocumentDate(receipt.date, moneySettings),
              receipt.method,
              receipt.reference ?? '-',
            ],
            filterValues: [
              receipt.number ?? receipt.id,
              formatAmount(receipt.amount, receipt.currencyCode),
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
