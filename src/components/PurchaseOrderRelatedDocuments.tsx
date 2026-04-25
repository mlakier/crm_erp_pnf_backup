'use client'

import Link from 'next/link'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import TransactionRelatedDocumentsTabs, { RelatedDocumentsStatusBadge } from '@/components/TransactionRelatedDocumentsTabs'

type PurchaseRequisition = {
  id: string
  number: string
  status: string
  total: number
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
  date: string
  dueDate: string | null
  notes?: string | null
}

type BillPayment = {
  id: string
  number: string
  amount: number
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
}: {
  requisitions: PurchaseRequisition[]
  receipts: Receipt[]
  bills: Bill[]
  billPayments: BillPayment[]
}) {
  return (
    <TransactionRelatedDocumentsTabs
      defaultActiveKey="purchase-requisitions"
      tabs={[
        {
          key: 'purchase-requisitions',
          label: 'Purchase Requisitions',
          count: requisitions.length,
          tone: 'upstream',
          emptyMessage: 'No purchase requisition is linked to this purchase order yet.',
          headers: ['Txn ID', 'Created', 'Status', 'Total', 'Priority', 'Title'],
          rows: requisitions.map((requisition) => ({
            id: requisition.id,
            cells: [
              <Link key="link" href={`/purchase-requisitions/${requisition.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {requisition.number}
              </Link>,
              fmtDocumentDate(requisition.createdAt),
              <RelatedDocumentsStatusBadge key="status" status={requisition.status} />,
              fmtCurrency(requisition.total),
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
          headers: ['Txn ID', 'Date', 'Status', 'Quantity', 'Notes', 'Created'],
          rows: receipts.map((receipt) => ({
            id: receipt.id,
            cells: [
              <Link key="link" href="/receipts" className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {receipt.number}
              </Link>,
              fmtDocumentDate(receipt.date),
              <RelatedDocumentsStatusBadge key="status" status={receipt.status} />,
              receipt.quantity,
              receipt.notes ?? '-',
              receipt.createdAt ? fmtDocumentDate(receipt.createdAt) : '-',
            ],
          })),
        },
        {
          key: 'bills',
          label: 'Bills',
          count: bills.length,
          tone: 'downstream',
          emptyMessage: 'No bills are linked to this purchase order yet.',
          headers: ['Txn ID', 'Date', 'Due Date', 'Status', 'Total', 'Notes'],
          rows: bills.map((bill) => ({
            id: bill.id,
            cells: [
              <Link key="link" href={`/bills/${bill.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {bill.number}
              </Link>,
              fmtDocumentDate(bill.date),
              bill.dueDate ? fmtDocumentDate(bill.dueDate) : '-',
              <RelatedDocumentsStatusBadge key="status" status={bill.status} />,
              fmtCurrency(bill.total),
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
          headers: ['Txn ID', 'Date', 'Status', 'Amount', 'Method', 'Reference', 'Bill'],
          rows: billPayments.map((payment) => ({
            id: payment.id,
            cells: [
              <Link key="link" href="/bill-payments" className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                {payment.number}
              </Link>,
              fmtDocumentDate(payment.date),
              <RelatedDocumentsStatusBadge key="status" status={payment.status} />,
              fmtCurrency(payment.amount),
              payment.method ?? '-',
              payment.reference ?? '-',
              payment.billNumber,
            ],
          })),
        },
      ]}
    />
  )
}
