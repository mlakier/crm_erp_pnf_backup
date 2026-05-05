'use client'

import Link from 'next/link'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import TransactionRelatedDocumentsTabs, { RelatedDocumentsStatusBadge } from '@/components/TransactionRelatedDocumentsTabs'

type OpportunityDoc = {
  id: string
  number: string
  name: string
  status: string
  total: number
  currencyCode?: string | null
}

type SalesOrderDoc = {
  id: string
  number: string
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

type InvoiceReceiptDoc = {
  id: string
  number: string
  amount: number
  currencyCode?: string | null
  date: string
  method: string | null
  reference: string | null
}

export default function QuoteRelatedDocuments({
  opportunities,
  salesOrders,
  fulfillments,
  invoices,
  invoiceReceipts,
  defaultCurrencyCode,
  embedded = false,
  showDisplayControl = true,
}: {
  opportunities: OpportunityDoc[]
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
          emptyMessage: 'No source opportunity is linked to this quote.',
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
          key: 'sales-orders',
          label: 'Sales Orders',
          count: salesOrders.length,
          tone: 'downstream',
          emptyMessage: 'No sales order is linked to this quote yet.',
          headers: ['Txn ID', 'Status', 'Total'],
          rows: salesOrders.map((salesOrder) => ({
            id: salesOrder.id,
            cells: [
              <Link key="link" href={`/sales-orders/${salesOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
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
          key: 'fulfillments',
          label: 'Fulfillments',
          count: fulfillments.length,
          tone: 'downstream',
          emptyMessage: 'No fulfillments are linked downstream from this quote yet.',
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
        },
        {
          key: 'invoices',
          label: 'Invoices',
          count: invoices.length,
          tone: 'downstream',
          emptyMessage: 'No invoices are linked downstream from this quote yet.',
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
          key: 'invoice-receipts',
          label: 'Invoice Receipts',
          count: invoiceReceipts.length,
          tone: 'downstream',
          emptyMessage: 'No invoice receipts are linked downstream from this quote yet.',
          headers: ['Txn ID', 'Amount', 'Date', 'Method', 'Reference'],
          rows: invoiceReceipts.map((receipt) => ({
            id: receipt.id,
            cells: [
              <Link key="link" href={`/invoice-receipts/${receipt.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
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
      ]}
    />
  )
}
