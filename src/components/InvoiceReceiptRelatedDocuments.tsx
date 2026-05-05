'use client'

import Link from 'next/link'
import { fmtCurrency } from '@/lib/format'
import TransactionRelatedDocumentsTabs, {
  RelatedDocumentsStatusBadge,
} from '@/components/TransactionRelatedDocumentsTabs'
import type { DocumentRelationshipSummary } from '@/lib/document-relationships'

export default function InvoiceReceiptRelatedDocuments({
  invoice,
  salesOrder,
  quote,
  opportunity,
  linkedDocuments = [],
  moneySettings,
  embedded = false,
  showDisplayControl = true,
  defaultCurrencyCode,
}: {
  invoice: { id: string; number: string; status: string; total: number; currencyCode?: string | null } | null
  salesOrder: { id: string; number: string; status: string; total: number; currencyCode?: string | null } | null
  quote: { id: string; number: string; status: string; total: number; currencyCode?: string | null } | null
  opportunity: { id: string; number: string; name: string; status: string; total: number; currencyCode?: string | null } | null
  linkedDocuments?: DocumentRelationshipSummary[]
  moneySettings?: Parameters<typeof import('@/lib/format').fmtCurrency>[2]
  embedded?: boolean
  showDisplayControl?: boolean
  defaultCurrencyCode?: string | null
}) {
  const formatAmount = (value: number, currencyCode?: string | null) =>
    fmtCurrency(value, currencyCode ?? defaultCurrencyCode ?? undefined, moneySettings)
  return (
    <TransactionRelatedDocumentsTabs
      embedded={embedded}
      showDisplayControl={showDisplayControl}
      defaultActiveKey="opportunities"
      tabs={[
        {
          key: 'opportunities',
          label: 'Opportunities',
          count: opportunity ? 1 : 0,
          tone: 'upstream',
          emptyMessage: 'No source opportunity is linked to this invoice receipt.',
          headers: ['TXN ID', 'NAME', 'STATUS', 'TOTAL'],
          rows: opportunity
            ? [
                {
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
                },
              ]
            : [],
        },
        {
          key: 'quotes',
          label: 'Quotes',
          count: quote ? 1 : 0,
          tone: 'upstream',
          emptyMessage: 'No source quote is linked to this invoice receipt.',
          headers: ['TXN ID', 'STATUS', 'TOTAL'],
          rows: quote
            ? [
                {
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
                },
              ]
            : [],
        },
        {
          key: 'sales-orders',
          label: 'Sales Orders',
          count: salesOrder ? 1 : 0,
          tone: 'upstream',
          emptyMessage: 'No source sales order is linked to this invoice receipt.',
          headers: ['TXN ID', 'STATUS', 'TOTAL'],
          rows: salesOrder
            ? [
                {
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
                },
              ]
            : [],
        },
        {
          key: 'invoices',
          label: 'Invoices',
          count: invoice ? 1 : 0,
          tone: 'upstream',
          emptyMessage: 'No invoice is linked to this invoice receipt.',
          headers: ['TXN ID', 'STATUS', 'TOTAL'],
          rows: invoice
            ? [
                {
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
                },
              ]
            : [],
        },
        {
          key: 'linked-documents',
          label: 'Linked Documents',
          count: linkedDocuments.length,
          tone: 'downstream',
          emptyMessage: 'No linked documents are attached to this invoice receipt yet.',
          headers: ['RELATIONSHIP', 'TYPE', 'TXN ID', 'STATUS', 'AMOUNT'],
          rows: linkedDocuments.map((document) => ({
            id: document.id,
            cells: [
              document.relationshipLabel,
              document.relatedRecordLabel,
              document.href ? (
                <Link
                  key="link"
                  href={document.href}
                  className="hover:underline"
                  style={{ color: 'var(--accent-primary-strong)' }}
                >
                  {document.relatedNumber}
                </Link>
              ) : (
                document.relatedNumber
              ),
              document.relatedStatus ? <RelatedDocumentsStatusBadge key="status" status={document.relatedStatus} /> : '-',
              document.relatedAmount != null
                ? fmtCurrency(document.relatedAmount, defaultCurrencyCode ?? undefined, moneySettings)
                : '-',
            ],
            filterValues: [
              document.relationshipLabel,
              document.relatedRecordLabel,
              document.relatedNumber,
              document.relatedStatus ?? '-',
              document.relatedAmount != null
                ? fmtCurrency(document.relatedAmount, defaultCurrencyCode ?? undefined, moneySettings)
                : '-',
            ],
          })),
        },
      ]}
    />
  )
}
