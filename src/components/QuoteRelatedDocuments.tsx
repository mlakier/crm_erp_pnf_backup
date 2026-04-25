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
}

type SalesOrderDoc = {
  id: string
  number: string
  status: string
  total: number
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

export default function QuoteRelatedDocuments({
  opportunities,
  salesOrders,
  fulfillments,
  invoices,
}: {
  opportunities: OpportunityDoc[]
  salesOrders: SalesOrderDoc[]
  fulfillments: FulfillmentDoc[]
  invoices: InvoiceDoc[]
}) {
  return (
    <TransactionRelatedDocumentsTabs
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
              fmtCurrency(opportunity.total),
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
              fmtCurrency(salesOrder.total),
            ],
          })),
        },
        {
          key: 'fulfillments',
          label: 'Fulfillments',
          count: fulfillments.length,
          tone: 'downstream',
          emptyMessage: 'No fulfillments are linked downstream from this quote yet.',
          headers: ['Txn ID', 'Date', 'Status', 'Notes'],
          rows: fulfillments.map((fulfillment) => ({
            id: fulfillment.id,
            cells: [
              fulfillment.number,
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
          emptyMessage: 'No invoices are linked downstream from this quote yet.',
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
      ]}
    />
  )
}
