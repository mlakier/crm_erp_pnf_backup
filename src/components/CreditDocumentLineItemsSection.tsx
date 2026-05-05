import Link from 'next/link'
import {
  RecordDetailCell,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import type {
  CreditDocumentLineColumnCustomization,
  CreditDocumentLineColumnKey,
  CreditDocumentLineSettings,
} from '@/lib/credit-document-detail-customization-shared'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'

type CreditDocumentLineRow = {
  id: string
  itemHref?: string | null
  itemReference: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export default function CreditDocumentLineItemsSection({
  title,
  rows,
  currencyCode,
  moneySettings,
  lineSettings,
  visibleColumns,
  lineColumnCustomization,
}: {
  title: string
  rows: CreditDocumentLineRow[]
  currencyCode?: string | null
  moneySettings: Parameters<typeof fmtCurrency>[2]
  lineSettings?: CreditDocumentLineSettings
  visibleColumns?: Array<{ id: CreditDocumentLineColumnKey; label: string }>
  lineColumnCustomization?: Record<CreditDocumentLineColumnKey, CreditDocumentLineColumnCustomization>
}) {
  const columns =
    visibleColumns ?? [
      { id: 'db-id', label: 'Line DB Id' },
      { id: 'item', label: 'Item' },
      { id: 'description', label: 'Description' },
      { id: 'quantity', label: 'Qty' },
      { id: 'unit-price', label: 'Unit Price' },
      { id: 'line-total', label: 'Line Total' },
      { id: 'notes', label: 'Notes' },
      { id: 'created-at', label: 'Created' },
      { id: 'updated-at', label: 'Last Modified' },
    ] satisfies Array<{ id: CreditDocumentLineColumnKey; label: string }>
  const tableTextClass = lineSettings?.fontSize === 'xs' ? 'text-xs' : 'text-sm'

  function renderCell(row: CreditDocumentLineRow, columnId: CreditDocumentLineColumnKey) {
    switch (columnId) {
      case 'db-id':
        return row.id
      case 'item':
        return row.itemHref ? (
          <Link href={row.itemHref} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
            {row.itemReference}
          </Link>
        ) : (
          row.itemReference
        )
      case 'description':
        return row.description || '-'
      case 'quantity':
        return row.quantity
      case 'unit-price':
        return fmtCurrency(row.unitPrice, currencyCode ?? undefined, moneySettings)
      case 'line-total':
        return fmtCurrency(row.lineTotal, currencyCode ?? undefined, moneySettings)
      case 'notes':
        return row.notes?.trim() || '-'
      case 'created-at':
        return fmtDocumentDate(row.createdAt, moneySettings)
      case 'updated-at':
        return fmtDocumentDate(row.updatedAt, moneySettings)
      default:
        return '-'
    }
  }

  function getCellClassName(columnId: CreditDocumentLineColumnKey) {
    if (columnId === 'quantity' || columnId === 'unit-price' || columnId === 'line-total') return `text-right ${tableTextClass}`
    if (columnId === 'notes') return `max-w-[240px] whitespace-pre-wrap break-words ${tableTextClass}`
    return tableTextClass
  }

  function getColumnStyle(columnId: CreditDocumentLineColumnKey) {
    const widthMode = lineColumnCustomization?.[columnId]?.widthMode
    if (widthMode === 'compact') return { width: '1%', whiteSpace: 'nowrap' as const }
    if (widthMode === 'normal') return { minWidth: '120px' }
    if (widthMode === 'wide') return { minWidth: '220px' }
    return undefined
  }

  return (
    <RecordDetailSection
      title={title}
      count={rows.length}
      summary={rows.length ? `${rows.length} line${rows.length === 1 ? '' : 's'}` : undefined}
      collapsible
    >
      <table className="min-w-full">
        <thead>
          <tr>
            {columns.map((column) => (
              <RecordDetailHeaderCell
                key={column.id}
                style={getColumnStyle(column.id)}
                className={
                  column.id === 'quantity' || column.id === 'unit-price' || column.id === 'line-total'
                    ? 'text-right'
                    : undefined
                }
              >
                {column.label}
              </RecordDetailHeaderCell>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No line items yet.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={row.id}
                style={index < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
              >
                {columns.map((column) => (
                  <RecordDetailCell key={column.id} className={getCellClassName(column.id)} style={getColumnStyle(column.id)}>
                    {renderCell(row, column.id)}
                  </RecordDetailCell>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </RecordDetailSection>
  )
}
