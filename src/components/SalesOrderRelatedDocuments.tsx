'use client'

import Link from 'next/link'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import TransactionRelatedDocumentsTabs, { RelatedDocumentsStatusBadge } from '@/components/TransactionRelatedDocumentsTabs'

type QuoteDoc = {
  id: string
  number: string
  status: string
  total: number
  validUntil: string | null
  opportunityName: string | null
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
  dueDate: string | null
  createdAt: string
}

type CashReceiptDoc = {
  id: string
  amount: number
  date: string
  method: string | null
  reference: string | null
  invoiceNumber: string
}

export default function SalesOrderRelatedDocuments({
  quotes,
  fulfillments,
  invoices,
  cashReceipts,
}: {
  quotes: QuoteDoc[]
  fulfillments: FulfillmentDoc[]
  invoices: InvoiceDoc[]
  cashReceipts: CashReceiptDoc[]
}) {
  return (
    <TransactionRelatedDocumentsTabs
      defaultActiveKey="quotes"
      tabs={[
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
              fmtCurrency(quote.total),
              quote.validUntil ? fmtDocumentDate(quote.validUntil) : '-',
              quote.opportunityName ?? '-',
            ],
          })),
        },
        {
          key: 'fulfillments',
          label: 'Fulfillments',
          count: fulfillments.length,
          tone: 'downstream',
          emptyMessage: 'No fulfillments are linked to this sales order yet.',
          headers: ['Txn ID', 'Date', 'Status', 'Notes'],
          rows: fulfillments.map((fulfillment) => ({
            id: fulfillment.id,
            cells: [
              <Link key="link" href={`/fulfillments/${fulfillment.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {fulfillment.number}
              </Link>,
              fmtDocumentDate(fulfillment.date),
              <RelatedDocumentsStatusBadge key="status" status={fulfillment.status} />,
              fulfillment.notes ?? '-',
            ],
          })),
        },
        {
          key: 'invoices',
          label: 'Invoices',
          count: invoices.length,
          tone: 'downstream',
          emptyMessage: 'No invoices are linked to this sales order yet.',
          headers: ['Txn ID', 'Created', 'Due Date', 'Status', 'Total'],
          rows: invoices.map((invoice) => ({
            id: invoice.id,
            cells: [
              <Link key="link" href={`/invoices/${invoice.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {invoice.number}
              </Link>,
              fmtDocumentDate(invoice.createdAt),
              invoice.dueDate ? fmtDocumentDate(invoice.dueDate) : '-',
              <RelatedDocumentsStatusBadge key="status" status={invoice.status} />,
              fmtCurrency(invoice.total),
            ],
          })),
        },
        {
          key: 'cash-receipts',
          label: 'Customer Receipts',
          count: cashReceipts.length,
          tone: 'downstream',
          emptyMessage: 'No customer receipts are linked to invoices for this sales order yet.',
          headers: ['Amount', 'Date', 'Method', 'Reference', 'Invoice'],
          rows: cashReceipts.map((receipt) => ({
            id: receipt.id,
            cells: [
              fmtCurrency(receipt.amount),
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
