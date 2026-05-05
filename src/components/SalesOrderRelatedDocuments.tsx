'use client'

import Link from 'next/link'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import TransactionRelatedDocumentsTabs, { RelatedDocumentsStatusBadge } from '@/components/TransactionRelatedDocumentsTabs'

type QuoteDoc = {
  id: string
  number: string
  status: string
  total: number
  currencyCode?: string | null
  validUntil: string | null
  opportunityName: string | null
}

type OpportunityDoc = {
  id: string
  number: string
  name: string
  status: string
  total: number
  currencyCode?: string | null
}

type FulfillmentDoc = {
  id: string
  number: string
  status: string
  date: string
  notes: string | null
}

type InvoiceDoc = {
  id: string
  number: string
  status: string
  total: number
  currencyCode?: string | null
  dueDate: string | null
  createdAt: string
}

type CashReceiptDoc = {
  id: string
  number: string | null
  amount: number
  currencyCode?: string | null
  date: string
  method: string | null
  reference: string | null
  invoiceNumber: string
}

export default function SalesOrderRelatedDocuments({
  opportunities,
  quotes,
  fulfillments,
  invoices,
  cashReceipts,
  defaultCurrencyCode,
  showFulfillments = true,
  embedded = false,
  showDisplayControl = true,
}: {
  opportunities: OpportunityDoc[]
  quotes: QuoteDoc[]
  fulfillments: FulfillmentDoc[]
  invoices: InvoiceDoc[]
  cashReceipts: CashReceiptDoc[]
  defaultCurrencyCode?: string | null
  showFulfillments?: boolean
  embedded?: boolean
  showDisplayControl?: boolean
}) {
  const formatAmount = (value: number, currencyCode?: string | null) =>
    fmtCurrency(value, currencyCode ?? defaultCurrencyCode ?? undefined)
  const fulfillmentTab = {
    key: 'fulfillments',
    label: 'Fulfillments',
    count: fulfillments.length,
    tone: 'downstream' as const,
    emptyMessage: 'No fulfillments are linked to this sales order yet.',
    headers: ['Txn ID', 'Status', 'Date', 'Notes'],
    rows: fulfillments.map((fulfillment) => ({
      id: fulfillment.id,
      cells: [
        <Link key="link" href={`/fulfillments/${fulfillment.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {fulfillment.number}
        </Link>,
        <RelatedDocumentsStatusBadge key="status" status={fulfillment.status} />,
        fmtDocumentDate(fulfillment.date),
        fulfillment.notes ?? '-',
      ],
      filterValues: [
        fulfillment.number,
        fulfillment.status,
        fmtDocumentDate(fulfillment.date),
        fulfillment.notes ?? '-',
      ],
    })),
  }

  return (
    <TransactionRelatedDocumentsTabs
      embedded={embedded}
      showDisplayControl={showDisplayControl}
      defaultActiveKey="opportunities"
      tabs={[
        {
          key: 'opportunities',
          label: 'Opportunities',
          count: opportunities.length,
          tone: 'upstream',
          emptyMessage: 'No opportunity is linked to this sales order.',
          headers: ['Txn ID', 'Name', 'Status', 'Total'],
          rows: opportunities.map((opportunity) => ({
            id: opportunity.id,
            cells: [
              <Link key="link" href={`/opportunities/${opportunity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
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
          emptyMessage: 'No quote is linked to this sales order.',
          headers: ['Txn ID', 'Status', 'Total', 'Valid Until', 'Opportunity'],
          rows: quotes.map((quote) => ({
            id: quote.id,
            cells: [
              <Link key="link" href={`/quotes/${quote.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {quote.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={quote.status} />,
              formatAmount(quote.total, quote.currencyCode),
              quote.validUntil ? fmtDocumentDate(quote.validUntil) : '-',
              quote.opportunityName ?? '-',
            ],
            filterValues: [
              quote.number,
              quote.status,
              formatAmount(quote.total, quote.currencyCode),
              quote.validUntil ? fmtDocumentDate(quote.validUntil) : '-',
              quote.opportunityName ?? '-',
            ],
          })),
        },
        ...(showFulfillments ? [fulfillmentTab] : []),
        {
          key: 'invoices',
          label: 'Invoices',
          count: invoices.length,
          tone: 'downstream',
          emptyMessage: 'No invoices are linked to this sales order yet.',
          headers: ['Txn ID', 'Status', 'Total', 'Created', 'Due Date'],
          rows: invoices.map((invoice) => ({
            id: invoice.id,
            cells: [
              <Link key="link" href={`/invoices/${invoice.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {invoice.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={invoice.status} />,
              formatAmount(invoice.total, invoice.currencyCode),
              fmtDocumentDate(invoice.createdAt),
              invoice.dueDate ? fmtDocumentDate(invoice.dueDate) : '-',
            ],
            filterValues: [
              invoice.number,
              invoice.status,
              formatAmount(invoice.total, invoice.currencyCode),
              fmtDocumentDate(invoice.createdAt),
              invoice.dueDate ? fmtDocumentDate(invoice.dueDate) : '-',
            ],
          })),
        },
        {
          key: 'cash-receipts',
          label: 'Invoice Receipts',
          count: cashReceipts.length,
          tone: 'downstream',
          emptyMessage: 'No invoice receipts are linked to invoices for this sales order yet.',
          headers: ['Txn ID', 'Amount', 'Date', 'Method', 'Reference', 'Invoice'],
          rows: cashReceipts.map((receipt) => ({
            id: receipt.id,
            cells: [
              <Link key="link" href={`/invoice-receipts/${receipt.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {receipt.number ?? receipt.id}
              </Link>,
              formatAmount(receipt.amount, receipt.currencyCode),
              fmtDocumentDate(receipt.date),
              receipt.method ?? '-',
              receipt.reference ?? '-',
              receipt.invoiceNumber,
            ],
            filterValues: [
              receipt.number ?? receipt.id,
              formatAmount(receipt.amount, receipt.currencyCode),
              fmtDocumentDate(receipt.date),
              receipt.method ?? '-',
              receipt.reference ?? '-',
              receipt.invoiceNumber,
            ],
          })),
        },
      ]}
    />
  )
}
