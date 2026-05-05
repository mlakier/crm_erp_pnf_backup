'use client'

import Link from 'next/link'
import TransactionRelatedDocumentsTabs, {
  RelatedDocumentsStatusBadge,
  type TransactionRelatedDocumentsTab,
} from '@/components/TransactionRelatedDocumentsTabs'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import type { DocumentRelationshipSummary } from '@/lib/document-relationships'

export default function BillPaymentRelatedDocuments({
  purchaseRequisitions,
  purchaseOrders,
  receipts,
  bills,
  linkedDocuments = [],
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
  receipts: Array<{
    id: string
    number: string
    date: string | Date
    status: string
    quantity: number
    notes: string | null
  }>
  bills: Array<{
    id: string
    number: string
    status: string
    total: number
    date: string | Date
    dueDate: string | Date | null
    notes: string | null
    currencyCode?: string | null
  }>
  linkedDocuments?: DocumentRelationshipSummary[]
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
      key: 'receipts',
      label: 'Receipts',
      count: receipts.length,
      tone: 'upstream',
      emptyMessage: 'No related receipts.',
      headers: ['TXN ID', 'STATUS', 'DATE', 'QTY', 'NOTES'],
      rows: receipts.map((receipt) => ({
        id: receipt.id,
        cells: [
          <Link key={`${receipt.id}-number`} href={`/receipts/${receipt.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
            {receipt.number}
          </Link>,
          <RelatedDocumentsStatusBadge key={`${receipt.id}-status`} status={receipt.status} />,
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
      tone: 'upstream',
      emptyMessage: 'No related bills.',
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
      key: 'linked-documents',
      label: 'Linked Documents',
      count: linkedDocuments.length,
      tone: 'downstream',
      emptyMessage: 'No linked documents are attached to this bill payment yet.',
      headers: ['RELATIONSHIP', 'TYPE', 'TXN ID', 'STATUS', 'AMOUNT', 'DATE'],
      rows: linkedDocuments.map((document) => ({
        id: document.id,
        cells: [
          document.relationshipLabel,
          document.relatedRecordLabel,
          document.href ? (
            <Link
              key={`${document.id}-number`}
              href={document.href}
              className="hover:underline"
              style={{ color: 'var(--accent-primary-strong)' }}
            >
              {document.relatedNumber}
            </Link>
          ) : (
            document.relatedNumber
          ),
          document.relatedStatus ? <RelatedDocumentsStatusBadge key={`${document.id}-status`} status={document.relatedStatus} /> : '-',
          document.relatedAmount != null ? fmtCurrency(document.relatedAmount, defaultCurrencyCode ?? undefined, moneySettings) : '-',
          document.relatedDate ? fmtDocumentDate(document.relatedDate, moneySettings) : '-',
        ],
        filterValues: [
          document.relationshipLabel,
          document.relatedRecordLabel,
          document.relatedNumber,
          document.relatedStatus ?? '-',
          document.relatedAmount != null ? fmtCurrency(document.relatedAmount, defaultCurrencyCode ?? undefined, moneySettings) : '-',
          document.relatedDate ? fmtDocumentDate(document.relatedDate, moneySettings) : '-',
        ],
      })),
    },
  ]

  return <TransactionRelatedDocumentsTabs tabs={tabs} embedded={embedded} showDisplayControl={showDisplayControl} />
}
