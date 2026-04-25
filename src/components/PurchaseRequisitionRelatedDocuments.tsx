'use client'

import Link from 'next/link'
import TransactionRelatedDocumentsTabs, {
  RelatedDocumentsStatusBadge,
  type TransactionRelatedDocumentsTab,
} from '@/components/TransactionRelatedDocumentsTabs'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'

export default function PurchaseRequisitionRelatedDocuments({
  purchaseOrders,
  moneySettings,
}: {
  purchaseOrders: Array<{
    id: string
    number: string
    status: string
    total: number
    createdAt: string
  }>
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}) {
  const tabs: TransactionRelatedDocumentsTab[] = [
    {
      key: 'purchase-orders',
      label: 'Purchase Orders',
      count: purchaseOrders.length,
      tone: 'downstream',
      emptyMessage: 'No related purchase orders yet.',
      headers: ['TXN ID', 'STATUS', 'TOTAL', 'CREATED'],
      rows: purchaseOrders.map((purchaseOrder) => ({
        id: purchaseOrder.id,
        cells: [
          <Link
            key={`${purchaseOrder.id}-number`}
            href={`/purchase-orders/${purchaseOrder.id}`}
            className="hover:underline"
            style={{ color: 'var(--accent-primary-strong)' }}
          >
            {purchaseOrder.number}
          </Link>,
          <RelatedDocumentsStatusBadge
            key={`${purchaseOrder.id}-status`}
            status={purchaseOrder.status}
          />,
          fmtCurrency(purchaseOrder.total, undefined, moneySettings),
          fmtDocumentDate(purchaseOrder.createdAt, moneySettings),
        ],
      })),
    },
  ]

  return <TransactionRelatedDocumentsTabs tabs={tabs} />
}
