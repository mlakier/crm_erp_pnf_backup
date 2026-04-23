'use client'

import { useState } from 'react'
import Link from 'next/link'
import { fmtCurrency } from '@/lib/format'

type Tab = 'opportunities' | 'quotes' | 'sales-orders' | 'fulfillments' | 'invoices' | 'invoice-receipts'

type TabTone = 'upstream' | 'downstream'

type Opportunity = {
  id: string
  name: string
  stage: string
  amount: number | null
  closeDate: string | null
}

type Quote = {
  id: string
  number: string
  status: string
  total: number
  validUntil: string | null
  createdAt: string
}

type SalesOrder = {
  id: string
  number: string
  status: string
  total: number
  createdAt: string
}

type Fulfillment = {
  id: string
  number: string
  status: string
  date: string
  notes: string | null
  salesOrderNumber: string
}

type Invoice = {
  id: string
  number: string
  status: string
  total: number
  dueDate: string | null
  paidDate: string | null
  createdAt: string
}

type InvoiceReceipt = {
  id: string
  number: string | null
  amount: number
  date: string
  method: string | null
  reference: string | null
  invoiceNumber: string
}

interface Props {
  opportunities: Opportunity[]
  quotes: Quote[]
  salesOrders: SalesOrder[]
  fulfillments: Fulfillment[]
  invoices: Invoice[]
  invoiceReceipts: InvoiceReceipt[]
}

export default function CustomerRelatedDocs({ opportunities, quotes, salesOrders, fulfillments, invoices, invoiceReceipts }: Props) {
  const [active, setActive] = useState<Tab>('opportunities')

  const tabs: { key: Tab; label: string; count: number; tone: TabTone }[] = [
    { key: 'opportunities', label: 'Opportunities', count: opportunities.length, tone: 'upstream' },
    { key: 'quotes', label: 'Quotes', count: quotes.length, tone: 'upstream' },
    { key: 'sales-orders', label: 'Sales Orders', count: salesOrders.length, tone: 'downstream' },
    { key: 'fulfillments', label: 'Fulfillments', count: fulfillments.length, tone: 'downstream' },
    { key: 'invoices', label: 'Invoices', count: invoices.length, tone: 'downstream' },
    { key: 'invoice-receipts', label: 'Invoice Receipts', count: invoiceReceipts.length, tone: 'downstream' },
  ]

  return (
    <div className="mb-6 overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      {/* Header + Tabs */}
      <div className="border-b px-6 pt-5 pb-0" style={{ borderColor: 'var(--border-muted)' }}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Related Documents
        </p>
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
      </div>

      {/* Panel */}
      <div className="overflow-x-auto">
        {active === 'opportunities' && (
          opportunities.length === 0 ? (
            <Empty message="No opportunities yet" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Stage</Th>
                  <Th>Amount</Th>
                  <Th>Close Date</Th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o) => (
                  <tr key={o.id}>
                    <Td>
                      <Link href={`/opportunities/${o.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {o.name}
                      </Link>
                    </Td>
                    <Td>{o.stage}</Td>
                    <Td>{fmtCurrency(o.amount)}</Td>
                    <Td>{o.closeDate ? new Date(o.closeDate).toLocaleDateString() : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {active === 'quotes' && (
          quotes.length === 0 ? (
            <Empty message="No estimates yet" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Status</Th>
                  <Th>Total</Th>
                  <Th>Valid Until</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <Td>
                      <Link href={`/quotes/${q.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {q.number}
                      </Link>
                    </Td>
                    <Td><StatusBadge status={q.status} /></Td>
                    <Td>{fmtCurrency(q.total)}</Td>
                    <Td>{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}</Td>
                    <Td>{new Date(q.createdAt).toLocaleDateString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {active === 'sales-orders' && (
          salesOrders.length === 0 ? (
            <Empty message="No sales orders yet" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Status</Th>
                  <Th>Total</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {salesOrders.map((so) => (
                  <tr key={so.id}>
                    <Td>
                      <Link href={`/sales-orders/${so.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {so.number}
                      </Link>
                    </Td>
                    <Td><StatusBadge status={so.status} /></Td>
                    <Td>{fmtCurrency(so.total)}</Td>
                    <Td>{new Date(so.createdAt).toLocaleDateString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {active === 'invoices' && (
          invoices.length === 0 ? (
            <Empty message="No invoices yet" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Status</Th>
                  <Th>Total</Th>
                  <Th>Due Date</Th>
                  <Th>Paid Date</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <Td>
                      <Link href={`/invoices/${inv.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {inv.number}
                      </Link>
                    </Td>
                    <Td><StatusBadge status={inv.status} /></Td>
                    <Td>{fmtCurrency(inv.total)}</Td>
                    <Td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</Td>
                    <Td>{inv.paidDate ? new Date(inv.paidDate).toLocaleDateString() : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {active === 'fulfillments' && (
          fulfillments.length === 0 ? (
            <Empty message="No fulfillments yet" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Sales Order</Th>
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
                    <Td>{fulfillment.salesOrderNumber}</Td>
                    <Td>{fulfillment.notes ?? '-'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {active === 'invoice-receipts' && (
          invoiceReceipts.length === 0 ? (
            <Empty message="No invoice receipts yet" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Date</Th>
                  <Th>Amount</Th>
                  <Th>Method</Th>
                  <Th>Reference</Th>
                  <Th>Invoice</Th>
                </tr>
              </thead>
              <tbody>
                {invoiceReceipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <Td>
                      <Link href="/invoice-receipts" className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {receipt.number ?? receipt.id}
                      </Link>
                    </Td>
                    <Td>{new Date(receipt.date).toLocaleDateString()}</Td>
                    <Td>{fmtCurrency(receipt.amount)}</Td>
                    <Td>{receipt.method ?? '-'}</Td>
                    <Td>{receipt.reference ?? '-'}</Td>
                    <Td>{receipt.invoiceNumber}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>{message}</p>
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </td>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const styles: Record<string, { bg: string; color: string }> = {
    paid:      { bg: 'rgba(34,197,94,0.16)',   color: '#86efac' },
    sent:      { bg: 'rgba(34,197,94,0.16)',   color: '#86efac' },
    accepted:  { bg: 'rgba(34,197,94,0.16)',   color: '#86efac' },
    completed: { bg: 'rgba(34,197,94,0.16)',   color: '#86efac' },
    fulfilled: { bg: 'rgba(34,197,94,0.16)',   color: '#86efac' },
    approved:  { bg: 'rgba(59,130,246,0.18)',  color: 'var(--accent-primary-strong)' },
    confirmed: { bg: 'rgba(59,130,246,0.18)',  color: 'var(--accent-primary-strong)' },
    booked:    { bg: 'rgba(59,130,246,0.18)',  color: 'var(--accent-primary-strong)' },
    pending:   { bg: 'rgba(245,158,11,0.16)',  color: '#fcd34d' },
    overdue:   { bg: 'rgba(239,68,68,0.18)',   color: '#fca5a5' },
    cancelled: { bg: 'rgba(239,68,68,0.18)',   color: '#fca5a5' },
    draft:     { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
  }
  const { bg, color } = styles[s] ?? { bg: 'rgba(245,158,11,0.16)', color: '#fcd34d' }
  return (
    <span className="rounded-full px-2 py-0.5 text-xs capitalize" style={{ backgroundColor: bg, color }}>
      {status}
    </span>
  )
}
