'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { fmtCurrency } from '@/lib/format'

type Tab = 'quotes' | 'fulfillments' | 'invoices' | 'cash-receipts'

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
  const [active, setActive] = useState<Tab>('quotes')
  const [expanded, setExpanded] = useState(true)

  const tabs: Array<{ key: Tab; label: string; count: number; tone: 'upstream' | 'downstream' }> = [
    { key: 'quotes', label: 'Quotes', count: quotes.length, tone: 'upstream' },
    { key: 'fulfillments', label: 'Fulfillments', count: fulfillments.length, tone: 'downstream' },
    { key: 'invoices', label: 'Invoices', count: invoices.length, tone: 'downstream' },
    { key: 'cash-receipts', label: 'Customer Receipts', count: cashReceipts.length, tone: 'downstream' },
  ]

  return (
    <div
      className="mb-6 overflow-hidden rounded-xl border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
    >
      <div className="border-b px-6 pt-5 pb-0" style={{ borderColor: 'var(--border-muted)' }}>
        <div className="mb-3 flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Related Documents
          </p>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-md px-1.5 py-0.5 text-xs"
            style={{ color: 'var(--text-muted)' }}
            aria-label={expanded ? 'Collapse Related Documents' : 'Expand Related Documents'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        </div>
        {expanded ? (
          <div className="flex overflow-x-auto overflow-y-hidden">
            {tabs.map((tab) => {
              const isActive = active === tab.key
              const palette =
                tab.tone === 'upstream'
                  ? {
                      activeBorder: '#f59e0b',
                      activeText: '#fcd34d',
                      activeBadgeBg: 'rgba(245,158,11,0.16)',
                      inactiveBadgeBg: 'rgba(245,158,11,0.1)',
                      inactiveBadgeText: '#d1a24a',
                      inactiveText: '#d8b86a',
                    }
                  : {
                      activeBorder: 'var(--accent-primary-strong)',
                      activeText: '#93c5fd',
                      activeBadgeBg: 'rgba(59,130,246,0.18)',
                      inactiveBadgeBg: 'rgba(59,130,246,0.1)',
                      inactiveBadgeText: '#7fb0f8',
                      inactiveText: '#8ab4f8',
                    }
              return (
                <button
                  key={tab.key}
                  onClick={() => setActive(tab.key)}
                  className="flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
                  style={{
                    borderColor: isActive ? palette.activeBorder : 'transparent',
                    color: isActive ? palette.activeText : palette.inactiveText,
                  }}
                >
                  {tab.label}
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: isActive ? palette.activeBadgeBg : palette.inactiveBadgeBg,
                      color: isActive ? palette.activeText : palette.inactiveBadgeText,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="overflow-x-auto overflow-y-hidden">
          {active === 'quotes' &&
            (quotes.length === 0 ? (
              <Empty message="No quote is linked to this sales order." />
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr>
                    <Th>Txn ID</Th>
                    <Th>Status</Th>
                    <Th>Total</Th>
                    <Th>Valid Until</Th>
                    <Th>Opportunity</Th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.id}>
                      <Td>
                        <Link href={`/quotes/${quote.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {quote.number}
                        </Link>
                      </Td>
                      <Td><StatusBadge status={quote.status} /></Td>
                      <Td>{fmtCurrency(quote.total)}</Td>
                      <Td>{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '-'}</Td>
                      <Td>{quote.opportunityName ?? '-'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {active === 'fulfillments' &&
            (fulfillments.length === 0 ? (
              <Empty message="No fulfillments are linked to this sales order yet." />
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr>
                    <Th>Txn ID</Th>
                    <Th>Date</Th>
                    <Th>Status</Th>
                    <Th>Notes</Th>
                  </tr>
                </thead>
                <tbody>
                  {fulfillments.map((fulfillment) => (
                    <tr key={fulfillment.id}>
                      <Td>
                        <Link href={`/fulfillments/${fulfillment.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {fulfillment.number}
                        </Link>
                      </Td>
                      <Td>{new Date(fulfillment.date).toLocaleDateString()}</Td>
                      <Td><StatusBadge status={fulfillment.status} /></Td>
                      <Td>{fulfillment.notes ?? '-'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {active === 'invoices' &&
            (invoices.length === 0 ? (
              <Empty message="No invoices are linked to this sales order yet." />
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr>
                    <Th>Txn ID</Th>
                    <Th>Created</Th>
                    <Th>Due Date</Th>
                    <Th>Status</Th>
                    <Th>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <Td>
                        <Link href={`/invoices/${invoice.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {invoice.number}
                        </Link>
                      </Td>
                      <Td>{new Date(invoice.createdAt).toLocaleDateString()}</Td>
                      <Td>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}</Td>
                      <Td><StatusBadge status={invoice.status} /></Td>
                      <Td>{fmtCurrency(invoice.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {active === 'cash-receipts' &&
            (cashReceipts.length === 0 ? (
              <Empty message="No customer receipts are linked to invoices for this sales order yet." />
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr>
                    <Th>Amount</Th>
                    <Th>Date</Th>
                    <Th>Method</Th>
                    <Th>Reference</Th>
                    <Th>Invoice</Th>
                  </tr>
                </thead>
                <tbody>
                  {cashReceipts.map((receipt) => (
                    <tr key={receipt.id}>
                      <Td>{fmtCurrency(receipt.amount)}</Td>
                      <Td>{new Date(receipt.date).toLocaleDateString()}</Td>
                      <Td>{receipt.method ?? '-'}</Td>
                      <Td>{receipt.reference ?? '-'}</Td>
                      <Td>{receipt.invoiceNumber}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      ) : null}
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>{message}</p>
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: ReactNode }) {
  return (
    <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </td>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const styles: Record<string, { bg: string; color: string }> = {
    paid: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    booked: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    fulfilled: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    accepted: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    pending: { bg: 'rgba(245,158,11,0.16)', color: '#fcd34d' },
    cancelled: { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' },
    sent: { bg: 'rgba(99,102,241,0.18)', color: '#c7d2fe' },
    draft: { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
  }
  const style = styles[s] ?? styles.draft
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status}
    </span>
  )
}
