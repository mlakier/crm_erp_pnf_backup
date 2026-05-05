'use client'

import Link from 'next/link'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import TransactionRelatedDocumentsTabs, {
  RelatedDocumentsStatusBadge,
} from '@/components/TransactionRelatedDocumentsTabs'

type OpportunityDoc = {
  id: string
  number: string
  name: string
  status: string
  total: number
  currencyCode?: string | null
  closeDate: string | null
}

type QuoteDoc = {
  id: string
  number: string
  status: string
  total: number
  currencyCode?: string | null
  validUntil: string | null
  createdAt: string
}

type SalesOrderDoc = {
  id: string
  number: string
  status: string
  total: number
  currencyCode?: string | null
  createdAt: string
}

type FulfillmentDoc = {
  id: string
  number: string
  status: string
  date: string
  notes: string | null
  salesOrderNumber: string
}

type InvoiceDoc = {
  id: string
  number: string
  status: string
  total: number
  currencyCode?: string | null
  dueDate: string | null
  paidDate: string | null
}

type InvoiceReceiptDoc = {
  id: string
  number: string | null
  amount: number
  currencyCode?: string | null
  date: string
  method: string | null
  reference: string | null
  invoiceNumber: string
}

export default function CustomerRelatedDocumentsSection({
  opportunities,
  quotes,
  salesOrders,
  fulfillments,
  invoices,
  invoiceReceipts,
  defaultCurrencyCode,
  embedded = false,
  showDisplayControl = true,
}: {
  opportunities: OpportunityDoc[]
  quotes: QuoteDoc[]
  salesOrders: SalesOrderDoc[]
  fulfillments: FulfillmentDoc[]
  invoices: InvoiceDoc[]
  invoiceReceipts: InvoiceReceiptDoc[]
  defaultCurrencyCode?: string | null
  embedded?: boolean
  showDisplayControl?: boolean
}) {
  const formatAmount = (value: number, currencyCode?: string | null) =>
    fmtCurrency(value, currencyCode ?? defaultCurrencyCode ?? undefined)
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
          emptyMessage: 'No opportunities are linked to this customer yet.',
          headers: ['Txn ID', 'Name', 'Status', 'Total', 'Close Date'],
          rows: opportunities.map((opportunity) => ({
            id: opportunity.id,
            cells: [
              <Link key="link" href={`/opportunities/${opportunity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {opportunity.number}
              </Link>,
              opportunity.name,
              <RelatedDocumentsStatusBadge key="status" status={opportunity.status} />,
              formatAmount(opportunity.total, opportunity.currencyCode),
              opportunity.closeDate ? fmtDocumentDate(opportunity.closeDate) : '-',
            ],
            filterValues: [
              opportunity.number,
              opportunity.name,
              opportunity.status,
              formatAmount(opportunity.total, opportunity.currencyCode),
              opportunity.closeDate ? fmtDocumentDate(opportunity.closeDate) : '-',
            ],
          })),
        },
        {
          key: 'quotes',
          label: 'Quotes',
          count: quotes.length,
          tone: 'upstream',
          emptyMessage: 'No quotes are linked to this customer yet.',
          headers: ['Txn ID', 'Status', 'Total', 'Valid Until', 'Created'],
          rows: quotes.map((quote) => ({
            id: quote.id,
            cells: [
              <Link key="link" href={`/quotes/${quote.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {quote.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={quote.status} />,
              formatAmount(quote.total, quote.currencyCode),
              quote.validUntil ? fmtDocumentDate(quote.validUntil) : '-',
              fmtDocumentDate(quote.createdAt),
            ],
            filterValues: [
              quote.number,
              quote.status,
              formatAmount(quote.total, quote.currencyCode),
              quote.validUntil ? fmtDocumentDate(quote.validUntil) : '-',
              fmtDocumentDate(quote.createdAt),
            ],
          })),
        },
        {
          key: 'sales-orders',
          label: 'Sales Orders',
          count: salesOrders.length,
          tone: 'downstream',
          emptyMessage: 'No sales orders are linked to this customer yet.',
          headers: ['Txn ID', 'Status', 'Total', 'Created'],
          rows: salesOrders.map((salesOrder) => ({
            id: salesOrder.id,
            cells: [
              <Link key="link" href={`/sales-orders/${salesOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {salesOrder.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={salesOrder.status} />,
              formatAmount(salesOrder.total, salesOrder.currencyCode),
              fmtDocumentDate(salesOrder.createdAt),
            ],
            filterValues: [
              salesOrder.number,
              salesOrder.status,
              formatAmount(salesOrder.total, salesOrder.currencyCode),
              fmtDocumentDate(salesOrder.createdAt),
            ],
          })),
        },
        {
          key: 'fulfillments',
          label: 'Fulfillments',
          count: fulfillments.length,
          tone: 'downstream',
          emptyMessage: 'No fulfillments are linked to this customer yet.',
          headers: ['Txn ID', 'Status', 'Date', 'Sales Order', 'Notes'],
          rows: fulfillments.map((fulfillment) => ({
            id: fulfillment.id,
            cells: [
              <Link key="link" href={`/fulfillments/${fulfillment.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {fulfillment.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={fulfillment.status} />,
              fmtDocumentDate(fulfillment.date),
              fulfillment.salesOrderNumber,
              fulfillment.notes ?? '-',
            ],
            filterValues: [
              fulfillment.number,
              fulfillment.status,
              fmtDocumentDate(fulfillment.date),
              fulfillment.salesOrderNumber,
              fulfillment.notes ?? '-',
            ],
          })),
        },
        {
          key: 'invoices',
          label: 'Invoices',
          count: invoices.length,
          tone: 'downstream',
          emptyMessage: 'No invoices are linked to this customer yet.',
          headers: ['Txn ID', 'Status', 'Total', 'Due Date', 'Paid Date'],
          rows: invoices.map((invoice) => ({
            id: invoice.id,
            cells: [
              <Link key="link" href={`/invoices/${invoice.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {invoice.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={invoice.status} />,
              formatAmount(invoice.total, invoice.currencyCode),
              invoice.dueDate ? fmtDocumentDate(invoice.dueDate) : '-',
              invoice.paidDate ? fmtDocumentDate(invoice.paidDate) : '-',
            ],
            filterValues: [
              invoice.number,
              invoice.status,
              formatAmount(invoice.total, invoice.currencyCode),
              invoice.dueDate ? fmtDocumentDate(invoice.dueDate) : '-',
              invoice.paidDate ? fmtDocumentDate(invoice.paidDate) : '-',
            ],
          })),
        },
        {
          key: 'invoice-receipts',
          label: 'Invoice Receipts',
          count: invoiceReceipts.length,
          tone: 'downstream',
          emptyMessage: 'No invoice receipts are linked to this customer yet.',
          headers: ['Txn ID', 'Amount', 'Date', 'Method', 'Reference', 'Invoice'],
          rows: invoiceReceipts.map((receipt) => ({
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
