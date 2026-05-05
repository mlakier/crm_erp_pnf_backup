'use client'

import Link from 'next/link'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import TransactionRelatedDocumentsTabs, {
  RelatedDocumentsStatusBadge,
} from '@/components/TransactionRelatedDocumentsTabs'

type QuoteRow = {
  id: string
  href: string
  number: string
  status: string
  total: number
  currencyCode?: string | null
}

type ContactRow = {
  id: string
  href: string
  number: string
  name: string
  email: string
  position: string
}

type SalesOrderRow = {
  id: string
  href: string
  number: string
  status: string
  total: number
  currencyCode?: string | null
}

type FulfillmentRow = {
  id: string
  href: string
  number: string
  status: string
  date: string
  notes: string | null
}

type InvoiceRow = {
  id: string
  href: string
  number: string
  status: string
  total: number
  currencyCode?: string | null
  dueDate: string | null
  createdAt: string
}

type InvoiceReceiptRow = {
  id: string
  href: string
  number: string
  amount: number
  currencyCode?: string | null
  date: string
  method: string | null
  reference: string | null
}

export default function OpportunityRelatedDocumentsSection({
  quote,
  contacts,
  salesOrders,
  fulfillments,
  invoices,
  invoiceReceipts,
  defaultCurrencyCode,
  embedded = false,
  showDisplayControl = true,
}: {
  quote: QuoteRow | null
  contacts: ContactRow[]
  salesOrders: SalesOrderRow[]
  fulfillments: FulfillmentRow[]
  invoices: InvoiceRow[]
  invoiceReceipts: InvoiceReceiptRow[]
  defaultCurrencyCode?: string | null
  embedded?: boolean
  showDisplayControl?: boolean
}) {
  const quoteRows = quote ? [quote] : []
  const formatAmount = (value: number, currencyCode?: string | null) =>
    fmtCurrency(value, currencyCode ?? defaultCurrencyCode ?? undefined)

  return (
    <TransactionRelatedDocumentsTabs
      embedded={embedded}
      showDisplayControl={showDisplayControl}
      defaultActiveKey="quotes"
      tabs={[
        {
          key: 'quotes',
          label: 'Quotes',
          count: quoteRows.length,
          tone: 'downstream',
          emptyMessage: 'No related quotes yet.',
          headers: ['Txn ID', 'Status', 'Total'],
          rows: quoteRows.map((row) => ({
            id: row.id,
            cells: [
              <Link key="link" href={row.href} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {row.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={row.status} />,
              formatAmount(row.total, row.currencyCode),
            ],
            filterValues: [row.number, row.status, formatAmount(row.total, row.currencyCode)],
          })),
        },
        {
          key: 'sales-orders',
          label: 'Sales Orders',
          count: salesOrders.length,
          tone: 'downstream',
          emptyMessage: 'No sales orders are linked downstream from this opportunity yet.',
          headers: ['Txn ID', 'Status', 'Total'],
          rows: salesOrders.map((salesOrder) => ({
            id: salesOrder.id,
            cells: [
              <Link key="link" href={salesOrder.href} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {salesOrder.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={salesOrder.status} />,
              formatAmount(salesOrder.total, salesOrder.currencyCode),
            ],
            filterValues: [salesOrder.number, salesOrder.status, formatAmount(salesOrder.total, salesOrder.currencyCode)],
          })),
        },
        {
          key: 'fulfillments',
          label: 'Fulfillments',
          count: fulfillments.length,
          tone: 'downstream',
          emptyMessage: 'No fulfillments are linked downstream from this opportunity yet.',
          headers: ['Txn ID', 'Status', 'Date', 'Notes'],
          rows: fulfillments.map((fulfillment) => ({
            id: fulfillment.id,
            cells: [
              <Link key="link" href={fulfillment.href} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
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
        },
        {
          key: 'invoices',
          label: 'Invoices',
          count: invoices.length,
          tone: 'downstream',
          emptyMessage: 'No invoices are linked downstream from this opportunity yet.',
          headers: ['Txn ID', 'Status', 'Total', 'Created', 'Due Date'],
          rows: invoices.map((invoice) => ({
            id: invoice.id,
            cells: [
              <Link key="link" href={invoice.href} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
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
          key: 'invoice-receipts',
          label: 'Invoice Receipts',
          count: invoiceReceipts.length,
          tone: 'downstream',
          emptyMessage: 'No invoice receipts are linked downstream from this opportunity yet.',
          headers: ['Txn ID', 'Amount', 'Date', 'Method', 'Reference'],
          rows: invoiceReceipts.map((receipt) => ({
            id: receipt.id,
            cells: [
              <Link key="link" href={receipt.href} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {receipt.number}
              </Link>,
              formatAmount(receipt.amount, receipt.currencyCode),
              fmtDocumentDate(receipt.date),
              receipt.method ?? '-',
              receipt.reference ?? '-',
            ],
            filterValues: [
              receipt.number,
              formatAmount(receipt.amount, receipt.currencyCode),
              fmtDocumentDate(receipt.date),
              receipt.method ?? '-',
              receipt.reference ?? '-',
            ],
          })),
        },
        {
          key: 'contacts',
          label: 'Customer Contacts',
          count: contacts.length,
          tone: 'upstream',
          emptyMessage: 'No related customer contacts.',
          headers: ['Contact #', 'Name', 'Email', 'Position'],
          rows: contacts.map((contact) => ({
            id: contact.id,
            cells: [
              <Link key="link" href={contact.href} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {contact.number}
              </Link>,
              contact.name,
              contact.email,
              contact.position,
            ],
            filterValues: [contact.number, contact.name, contact.email, contact.position],
          })),
        },
      ]}
    />
  )
}
