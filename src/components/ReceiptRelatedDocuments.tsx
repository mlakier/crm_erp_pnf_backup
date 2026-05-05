'use client'

import Link from 'next/link'
import TransactionRelatedDocumentsTabs, {
  RelatedDocumentsStatusBadge,
  type TransactionRelatedDocumentsTab,
} from '@/components/TransactionRelatedDocumentsTabs'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'

export default function ReceiptRelatedDocuments({
  purchaseRequisitions,
  purchaseOrders,
  bills,
  billPayments,
  moneySettings,
  embedded = false,
  showDisplayControl = true,
  defaultCurrencyCode,
}: {
  purchaseRequisitions: Array<{
    id: string
    number: string
    status: string
    total: number
    createdAt: string | Date
    currencyCode?: string | null
  }>
  purchaseOrders: Array<{
    id: string
    number: string
    status: string
    total: number
    createdAt: string | Date
    currencyCode?: string | null
  }>
  bills: Array<{
    id: string
    number: string
    date: string | Date
    dueDate: string | Date | null
    status: string
    total: number
    notes: string | null
    currencyCode?: string | null
  }>
  billPayments: Array<{
    id: string
    number: string
    date: string | Date
    status: string
    amount: number
    reference: string | null
    billNumber: string
    currencyCode?: string | null
  }>
  moneySettings?: Parameters<typeof fmtCurrency>[2]
  embedded?: boolean
  showDisplayControl?: boolean
  defaultCurrencyCode?: string | null
}) {
  const formatAmount = (value: number, currencyCode?: string | null) =>
    fmtCurrency(value, currencyCode ?? defaultCurrencyCode ?? undefined, moneySettings)
  const tabs: TransactionRelatedDocumentsTab[] = [
    {
      key: 'purchase-requisitions',
      label: 'Purchase Requisitions',
      count: purchaseRequisitions.length,
      tone: 'upstream',
      emptyMessage: 'No related purchase requisitions.',
      headers: ['TXN ID', 'STATUS', 'TOTAL', 'CREATED'],
      rows: purchaseRequisitions.map((req) => ({
        id: req.id,
        cells: [
          <Link key={`${req.id}-number`} href={`/purchase-requisitions/${req.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
            {req.number}
          </Link>,
          <RelatedDocumentsStatusBadge key={`${req.id}-status`} status={req.status} />,
          formatAmount(req.total, req.currencyCode),
          fmtDocumentDate(req.createdAt, moneySettings),
        ],
        filterValues: [
          req.number,
          req.status,
          formatAmount(req.total, req.currencyCode),
          fmtDocumentDate(req.createdAt, moneySettings),
        ],
      })),
    },
    {
      key: 'purchase-orders',
      label: 'Purchase Orders',
      count: purchaseOrders.length,
      tone: 'upstream',
      emptyMessage: 'No related purchase orders.',
      headers: ['TXN ID', 'STATUS', 'TOTAL', 'CREATED'],
      rows: purchaseOrders.map((po) => ({
        id: po.id,
        cells: [
          <Link key={`${po.id}-number`} href={`/purchase-orders/${po.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
            {po.number}
          </Link>,
          <RelatedDocumentsStatusBadge key={`${po.id}-status`} status={po.status} />,
          formatAmount(po.total, po.currencyCode),
          fmtDocumentDate(po.createdAt, moneySettings),
        ],
        filterValues: [
          po.number,
          po.status,
          formatAmount(po.total, po.currencyCode),
          fmtDocumentDate(po.createdAt, moneySettings),
        ],
      })),
    },
    {
      key: 'bills',
      label: 'Bills',
      count: bills.length,
      tone: 'downstream',
      emptyMessage: 'No related bills yet.',
      headers: ['TXN ID', 'STATUS', 'TOTAL', 'BILL DATE', 'DUE DATE', 'NOTES'],
      rows: bills.map((bill) => ({
        id: bill.id,
        cells: [
          <Link key={`${bill.id}-number`} href={`/bills/${bill.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
            {bill.number}
          </Link>,
          <RelatedDocumentsStatusBadge key={`${bill.id}-status`} status={bill.status} />,
          formatAmount(bill.total, bill.currencyCode),
          fmtDocumentDate(bill.date, moneySettings),
          bill.dueDate ? fmtDocumentDate(bill.dueDate, moneySettings) : '-',
          bill.notes ?? '-',
        ],
        filterValues: [
          bill.number,
          bill.status,
          formatAmount(bill.total, bill.currencyCode),
          fmtDocumentDate(bill.date, moneySettings),
          bill.dueDate ? fmtDocumentDate(bill.dueDate, moneySettings) : '-',
          bill.notes ?? '-',
        ],
      })),
    },
    {
      key: 'bill-payments',
      label: 'Bill Payments',
      count: billPayments.length,
      tone: 'downstream',
      emptyMessage: 'No related bill payments yet.',
      headers: ['TXN ID', 'STATUS', 'AMOUNT', 'DATE', 'BILL', 'REFERENCE'],
      rows: billPayments.map((payment) => ({
        id: payment.id,
        cells: [
          <Link key={`${payment.id}-number`} href={`/bill-payments/${payment.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
            {payment.number}
          </Link>,
          <RelatedDocumentsStatusBadge key={`${payment.id}-status`} status={payment.status} />,
          formatAmount(payment.amount, payment.currencyCode),
          fmtDocumentDate(payment.date, moneySettings),
          payment.billNumber,
          payment.reference ?? '-',
        ],
        filterValues: [
          payment.number,
          payment.status,
          formatAmount(payment.amount, payment.currencyCode),
          fmtDocumentDate(payment.date, moneySettings),
          payment.billNumber,
          payment.reference ?? '-',
        ],
      })),
    },
  ]

  return <TransactionRelatedDocumentsTabs tabs={tabs} embedded={embedded} showDisplayControl={showDisplayControl} />
}
