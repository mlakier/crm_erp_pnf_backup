'use client'

import { useState } from 'react'
import { fmtCurrency } from '@/lib/format'
import RequisitionLineItemForm from '@/components/RequisitionLineItemForm'
import type {
  PurchaseRequisitionLineColumnCustomization,
  PurchaseRequisitionLineColumnKey,
  PurchaseRequisitionLineSettings,
} from '@/lib/purchase-requisitions-detail-customization'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'

type LineRow = {
  id: string
  lineNumber: number
  itemId: string | null
  itemName: string | null
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  notes: string | null
}

const LINE_COLUMNS: Array<{ id: PurchaseRequisitionLineColumnKey; label: string }> = [
  { id: 'line', label: 'Line' },
  { id: 'item-id', label: 'Item Id' },
  { id: 'description', label: 'Description' },
  { id: 'quantity', label: 'Qty' },
  { id: 'unit-price', label: 'Unit Price' },
  { id: 'line-total', label: 'Line Total' },
  { id: 'notes', label: 'Notes' },
]

export default function PurchaseRequisitionLineItemsSection({
  requisitionId,
  items,
  lineRows,
  currencyCode,
  moneySettings,
  lineSettings,
  lineColumns,
}: {
  requisitionId: string
  items: Array<{ id: string; itemId: string; name: string; listPrice: number }>
  lineRows: LineRow[]
  currencyCode?: string | null
  moneySettings?: Parameters<typeof fmtCurrency>[2]
  lineSettings?: PurchaseRequisitionLineSettings
  lineColumns?: Record<PurchaseRequisitionLineColumnKey, PurchaseRequisitionLineColumnCustomization>
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const orderedColumns = [...LINE_COLUMNS]
    .filter((column) => lineColumns?.[column.id]?.visible !== false)
    .sort((left, right) => (lineColumns?.[left.id]?.order ?? 0) - (lineColumns?.[right.id]?.order ?? 0))
  const valueClassName = lineSettings?.fontSize === 'xs' ? 'text-xs' : 'text-sm'
  const headerClassName = lineSettings?.fontSize === 'xs' ? 'text-[11px]' : ''

  function getWidthClass(columnId: PurchaseRequisitionLineColumnKey) {
    switch (lineColumns?.[columnId]?.widthMode) {
      case 'compact':
        return 'w-24'
      case 'normal':
        return 'w-36'
      case 'wide':
        return 'w-56'
      default:
        return ''
    }
  }

  function formatItemDisplay(line: LineRow) {
    const displayMode = lineColumns?.['item-id']?.viewDisplay ?? 'idAndLabel'
    if (displayMode === 'id') return line.itemId ?? '-'
    if (displayMode === 'label') return line.itemName ?? line.description ?? line.itemId ?? '-'
    if (line.itemId && line.itemName) return `${line.itemId} - ${line.itemName}`
    return line.itemId ?? line.itemName ?? line.description ?? '-'
  }

  function renderCellValue(line: LineRow, columnId: PurchaseRequisitionLineColumnKey) {
    switch (columnId) {
      case 'line':
        return line.lineNumber
      case 'item-id':
        return formatItemDisplay(line)
      case 'description':
        return line.description
      case 'quantity':
        return line.quantity
      case 'unit-price':
        return fmtCurrency(line.unitPrice, currencyCode ?? undefined, moneySettings)
      case 'line-total':
        return fmtCurrency(line.lineTotal, currencyCode ?? undefined, moneySettings)
      case 'notes':
        return line.notes ?? '-'
      default:
        return '-'
    }
  }

  return (
    <RecordDetailSection
      title="Purchase Requisition Line Items"
      count={lineRows.length}
      actions={
        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          {showAddForm ? 'Hide Add Line' : 'Add Line'}
        </button>
      }
    >
      {showAddForm ? (
        <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
          <RequisitionLineItemForm
            requisitionId={requisitionId}
            items={items}
            embedded
            showHeading={false}
          />
        </div>
      ) : null}
      {lineRows.length === 0 ? (
        <RecordDetailEmptyState message="No requisition lines yet." />
      ) : (
        <table className="min-w-full">
          <thead>
            <tr>
              {orderedColumns.map((column) => (
                <RecordDetailHeaderCell
                  key={column.id}
                  className={`${headerClassName} ${getWidthClass(column.id)}`.trim()}
                >
                  {column.label}
                </RecordDetailHeaderCell>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineRows.map((line, index) => (
              <tr
                key={line.id}
                id={`req-line-item-${line.id}`}
                tabIndex={-1}
                style={
                  index < lineRows.length - 1
                    ? { borderBottom: '1px solid var(--border-muted)' }
                    : undefined
                }
              >
                {orderedColumns.map((column) => (
                  <RecordDetailCell
                    key={`${line.id}-${column.id}`}
                    className={`${valueClassName} ${getWidthClass(column.id)}`.trim()}
                  >
                    {renderCellValue(line, column.id)}
                  </RecordDetailCell>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </RecordDetailSection>
  )
}
