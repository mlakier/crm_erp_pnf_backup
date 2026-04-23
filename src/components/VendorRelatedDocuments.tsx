'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { fmtCurrency } from '@/lib/format'

type Tab = 'purchase-requisitions' | 'purchase-orders' | 'receipts' | 'bills' | 'bill-payments'

type TabTone = 'upstream' | 'downstream'

type PurchaseOrderDoc = {
  id: string
  number: string
  status: string
  total: number
  createdAt: string
}

type PurchaseRequisitionDoc = {
  id: string
  number: string
  status: string
  total: number
  priority: string | null
  title: string | null
  createdAt: string
}

type BillDoc = {
  id: string
  number: string
  status: string
  total: number
  date: string
  dueDate: string | null
}

type ReceiptDoc = {
  id: string
  number: string
  date: string
  status: string
  quantity: number
  notes: string | null
  purchaseOrderNumber: string
}

type BillPaymentDoc = {
  id: string
  number: string
  amount: number
  date: string
  method: string | null
  reference: string | null
  status: string
  billNumber: string
}

export default function VendorRelatedDocuments({
  purchaseRequisitions,
  purchaseOrders,
  receipts,
  bills,
  billPayments,
}: {
  purchaseRequisitions: PurchaseRequisitionDoc[]
  purchaseOrders: PurchaseOrderDoc[]
  receipts: ReceiptDoc[]
  bills: BillDoc[]
  billPayments: BillPaymentDoc[]
}) {
  const [active, setActive] = useState<Tab>('purchase-requisitions')

  const tabs: { key: Tab; label: string; count: number; tone: TabTone }[] = [
    { key: 'purchase-requisitions', label: 'Purchase Requisitions', count: purchaseRequisitions.length, tone: 'upstream' },
    { key: 'purchase-orders', label: 'Purchase Orders', count: purchaseOrders.length, tone: 'upstream' },
    { key: 'receipts', label: 'Receipts', count: receipts.length, tone: 'downstream' },
    { key: 'bills', label: 'Bills', count: bills.length, tone: 'downstream' },
    { key: 'bill-payments', label: 'Bill Payments', count: billPayments.length, tone: 'downstream' },
  ]

  return (
    <div
      className="mb-6 overflow-hidden rounded-xl border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
    >
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
                type="button"
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

      <div className="overflow-x-auto overflow-y-hidden">
        {active === 'purchase-requisitions' && (
          purchaseRequisitions.length === 0 ? (
            <Empty message="No purchase requisitions yet." />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Txn ID</Th>
                  <Th>Created</Th>
                  <Th>Status</Th>
                  <Th>Total</Th>
                  <Th>Priority</Th>
                  <Th>Title</Th>
                </tr>
              </thead>
              <tbody>
                {purchaseRequisitions.map((requisition) => (
                  <tr key={requisition.id}>
                    <Td>
                      <Link href={`/purchase-requisitions/${requisition.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {requisition.number}
                      </Link>
                    </Td>
                    <Td>{new Date(requisition.createdAt).toLocaleDateString()}</Td>
                    <Td><StatusBadge status={requisition.status} /></Td>
                    <Td>{fmtCurrency(requisition.total)}</Td>
                    <Td className="capitalize">{requisition.priority ?? '-'}</Td>
                    <Td>{requisition.title ?? '-'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {active === 'purchase-orders' && (
          purchaseOrders.length === 0 ? (
            <Empty message="No purchase orders yet." />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Txn ID</Th>
                  <Th>Status</Th>
                  <Th>Total</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((purchaseOrder) => (
                  <tr key={purchaseOrder.id}>
                    <Td>
                      <Link href={`/purchase-orders/${purchaseOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {purchaseOrder.number}
                      </Link>
                    </Td>
                    <Td><StatusBadge status={purchaseOrder.status} /></Td>
                    <Td>{fmtCurrency(purchaseOrder.total)}</Td>
                    <Td>{new Date(purchaseOrder.createdAt).toLocaleDateString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {active === 'receipts' && (
          receipts.length === 0 ? (
            <Empty message="No receipts recorded yet." />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Txn ID</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Quantity</Th>
                  <Th>Purchase Order</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <Td>
                      <Link href="/receipts" className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {receipt.number}
                      </Link>
                    </Td>
                    <Td>{new Date(receipt.date).toLocaleDateString()}</Td>
                    <Td><StatusBadge status={receipt.status} /></Td>
                    <Td>{receipt.quantity}</Td>
                    <Td>{receipt.purchaseOrderNumber}</Td>
                    <Td>{receipt.notes ?? '-'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {active === 'bills' && (
          bills.length === 0 ? (
            <Empty message="No bills are linked to this vendor yet." />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Txn ID</Th>
                  <Th>Date</Th>
                  <Th>Due Date</Th>
                  <Th>Status</Th>
                  <Th>Total</Th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id}>
                    <Td>
                      <Link href={`/bills/${bill.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {bill.number}
                      </Link>
                    </Td>
                    <Td>{new Date(bill.date).toLocaleDateString()}</Td>
                    <Td>{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '-'}</Td>
                    <Td><StatusBadge status={bill.status} /></Td>
                    <Td>{fmtCurrency(bill.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {active === 'bill-payments' && (
          billPayments.length === 0 ? (
            <Empty message="No bill payments are linked to this vendor yet." />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Txn ID</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Amount</Th>
                  <Th>Method</Th>
                  <Th>Reference</Th>
                  <Th>Bill</Th>
                </tr>
              </thead>
              <tbody>
                {billPayments.map((payment) => (
                  <tr key={payment.id}>
                    <Td>
                      <Link href="/bill-payments" className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {payment.number}
                      </Link>
                    </Td>
                    <Td>{new Date(payment.date).toLocaleDateString()}</Td>
                    <Td><StatusBadge status={payment.status} /></Td>
                    <Td>{fmtCurrency(payment.amount)}</Td>
                    <Td>{payment.method ?? '-'}</Td>
                    <Td>{payment.reference ?? '-'}</Td>
                    <Td>{payment.billNumber}</Td>
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

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-2 text-sm ${className}`.trim()} style={{ color: 'var(--text-secondary)' }}>
      {children}
    </td>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const styles: Record<string, { bg: string; color: string }> = {
    paid: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    approved: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    received: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    pending: { bg: 'rgba(245,158,11,0.16)', color: '#fcd34d' },
    closed: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    cancelled: { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' },
    void: { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' },
    draft: { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
  }
  const style = styles[s] ?? styles.draft
  return (
    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize" style={{ backgroundColor: style.bg, color: style.color }}>
      {status}
    </span>
  )
}
