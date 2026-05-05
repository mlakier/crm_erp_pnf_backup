'use client'

import Link from 'next/link'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import TransactionRelatedDocumentsTabs, { RelatedDocumentsStatusBadge } from '@/components/TransactionRelatedDocumentsTabs'

type PurchaseRequisition = {
  id: string
  number: string
  status: string
  total: number
  currencyCode?: string | null
  title?: string | null
  priority?: string | null
  createdAt: string
}

type Receipt = {
  id: string
  number: string
  date: string
  status: string
  quantity: number
  notes: string | null
  createdAt?: string | null
}

type Bill = {
  id: string
  number: string
  status: string
  total: number
  currencyCode?: string | null
  date: string
  dueDate: string | null
  notes?: string | null
}

type BillPayment = {
  id: string
  number: string
  amount: number
  currencyCode?: string | null
  date: string
  method: string | null
  status: string
  billNumber: string
  reference?: string | null
}

export default function PurchaseOrderRelatedDocuments({
  requisitions,
  receipts,
  bills,
  billPayments,
  moneySettings,
  embedded = false,
  showDisplayControl = true,
}: {
  requisitions: PurchaseRequisition[]
  receipts: Receipt[]
  bills: Bill[]
  billPayments: BillPayment[]
  moneySettings?: Parameters<typeof fmtCurrency>[2]
  embedded?: boolean
  showDisplayControl?: boolean
}) {
  const formatAmount = (value: number, currencyCode?: string | null) =>
    fmtCurrency(value, currencyCode ?? undefined, moneySettings)
  return (
    <TransactionRelatedDocumentsTabs
      embedded={embedded}
      showDisplayControl={showDisplayControl}
      defaultActiveKey="purchase-requisitions"
      tabs={[
        {
          key: 'purchase-requisitions',
          label: 'Purchase Requisitions',
          count: requisitions.length,
          tone: 'upstream',
          emptyMessage: 'No purchase requisition is linked to this purchase order yet.',
          headers: ['Txn ID', 'Status', 'Total', 'Created', 'Priority', 'Title'],
          rows: requisitions.map((requisition) => ({
            id: requisition.id,
            cells: [
              <Link key="link" href={`/purchase-requisitions/${requisition.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {requisition.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={requisition.status} />,
              formatAmount(requisition.total, requisition.currencyCode),
              fmtDocumentDate(requisition.createdAt, moneySettings),
              requisition.priority ?? '-',
              requisition.title ?? '-',
            ],
            filterValues: [
              requisition.number,
              requisition.status,
              formatAmount(requisition.total, requisition.currencyCode),
              fmtDocumentDate(requisition.createdAt, moneySettings),
              requisition.priority ?? '-',
              requisition.title ?? '-',
            ],
          })),
        },
        {
          key: 'receipts',
          label: 'Receipts',
          count: receipts.length,
          tone: 'downstream',
          emptyMessage: 'No receipts recorded yet.',
          headers: ['Txn ID', 'Status', 'Date', 'Quantity', 'Notes'],
          rows: receipts.map((receipt) => ({
            id: receipt.id,
            cells: [
              <Link key="link" href={`/receipts/${receipt.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {receipt.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={receipt.status} />,
              fmtDocumentDate(receipt.date, moneySettings),
              receipt.quantity,
              receipt.notes ?? '-',
            ],
            filterValues: [
              receipt.number,
              receipt.status,
              fmtDocumentDate(receipt.date, moneySettings),
              String(receipt.quantity),
              receipt.notes ?? '-',
            ],
          })),
        },
        {
          key: 'bills',
          label: 'Bills',
          count: bills.length,
          tone: 'downstream',
          emptyMessage: 'No bills are linked to this purchase order yet.',
          headers: ['Txn ID', 'Status', 'Total', 'Date', 'Due Date', 'Notes'],
          rows: bills.map((bill) => ({
            id: bill.id,
            cells: [
              <Link key="link" href={`/bills/${bill.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {bill.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={bill.status} />,
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
          emptyMessage: 'No bill payments are linked to bills for this purchase order yet.',
          headers: ['Txn ID', 'Status', 'Amount', 'Date', 'Bill', 'Method', 'Reference'],
          rows: billPayments.map((payment) => ({
            id: payment.id,
            cells: [
              <Link key="link" href={`/bill-payments/${payment.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {payment.number}
              </Link>,
              <RelatedDocumentsStatusBadge key="status" status={payment.status} />,
              formatAmount(payment.amount, payment.currencyCode),
              fmtDocumentDate(payment.date, moneySettings),
              payment.billNumber,
              payment.method ?? '-',
              payment.reference ?? '-',
            ],
            filterValues: [
              payment.number,
              payment.status,
              formatAmount(payment.amount, payment.currencyCode),
              fmtDocumentDate(payment.date, moneySettings),
              payment.billNumber,
              payment.method ?? '-',
              payment.reference ?? '-',
            ],
          })),
        },
      ]}
    />
  )
}
