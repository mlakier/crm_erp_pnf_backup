'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ColumnSelector from '@/components/ColumnSelector'
import DeleteButton from '@/components/DeleteButton'
import { fmtCurrency } from '@/lib/format'
import { calcLineTotal, parseMoneyValue, parseQuantity, sumMoney } from '@/lib/money'
import type { PurchaseOrderLineColumnKey } from '@/lib/purchase-order-detail-customization'

type PurchaseOrderLineItemRow = {
  id: string
  displayOrder: number
  itemRecordId: string | null
  itemId: string | null
  itemName: string | null
  description: string
  quantity: number
  receivedQuantity: number
  billedQuantity: number
  openQuantity: number
  unitPrice: number
  lineTotal: number
}

type ItemOption = {
  id: string
  itemId: string
  name: string
  unitPrice: number
  itemDrivenValues?: Partial<Pick<EditableRowState, 'description' | 'unitPrice'>>
}

type EditableRowState = {
  itemRecordId: string | null
  itemSearch: string
  description: string
  quantity: string
  unitPrice: string
  error: string
}

type DraftRowState = EditableRowState & {
  id: string
}

declare global {
  interface Window {
    __purchaseOrderLineItemSavers?: Record<string, () => Promise<{ ok: boolean; error?: string }>>
    __transactionLineItemSavers?: Record<string, () => Promise<{ ok: boolean; error?: string }>>
  }
}

const COLUMN_DEFINITIONS = [
  { id: 'line', label: 'Line', locked: true },
  { id: 'item-id', label: 'Item Id', locked: true },
  { id: 'description', label: 'Description', defaultVisible: true },
  { id: 'quantity', label: 'Qty', defaultVisible: true },
  { id: 'received-qty', label: "Rec'd Qty", defaultVisible: true },
  { id: 'open-qty', label: 'Open Qty', defaultVisible: true },
  { id: 'billed-qty', label: 'Billed Qty', defaultVisible: true },
  { id: 'unit-price', label: 'Unit Price', defaultVisible: true },
  { id: 'line-total', label: 'Line Total', defaultVisible: true },
] as const

const EDIT_COLUMN_DEFINITION = { id: 'actions', label: 'Actions', locked: true } as const

const COLUMN_LAYOUT: Record<
  PurchaseOrderLineColumnKey,
  { align?: 'left' | 'center' | 'right'; width?: number; pinned?: boolean }
> = {
  line: { align: 'center', width: 72, pinned: true },
  'item-id': { width: 132, pinned: true },
  description: {},
  quantity: { align: 'right' },
  'received-qty': { align: 'right' },
  'billed-qty': { align: 'right' },
  'open-qty': { align: 'right' },
  'unit-price': { align: 'right' },
  'line-total': { align: 'right' },
}

const HEADER_TOOLTIPS: Record<string, string> = {
  line: 'Sequential line number for this purchase order.',
  'item-id': 'Search and select the linked item using Item ID or Item Name.',
  description: 'Description of the goods or services being purchased on this line.',
  quantity: 'Ordered quantity for this line item.',
  'received-qty': 'Derived received quantity for this line based on total receipts recorded against the purchase order.',
  'billed-qty': 'Derived billed quantity for this line based on total billed quantities recorded against related bills.',
  'open-qty': 'Derived remaining open quantity for this line based on ordered quantity less received quantity.',
  'unit-price': 'Price per unit for this purchase order line.',
  'line-total': 'Extended line amount calculated from quantity and unit price.',
}

function buildItemSelectionUpdates(item: ItemOption): Partial<EditableRowState> {
  return {
    itemRecordId: item.id,
    itemSearch: item.itemId,
    description: item.itemDrivenValues?.description ?? item.name,
    unitPrice: item.itemDrivenValues?.unitPrice ?? String(item.unitPrice ?? 0),
    error: '',
  }
}

export default function PurchaseOrderLineItemsSection({
  rows,
  editing,
  purchaseOrderId,
  userId,
  itemOptions,
  lineColumns,
  draftMode,
  onDraftRowsChange,
  lineItemApiBasePath = '/api/purchase-order-line-items',
  deleteResource = 'purchase-order-line-items',
  parentIdFieldName = 'purchaseOrderId',
  sectionTitle = 'Line Items',
  emptyMessage = 'No line items yet.',
  tableId = 'purchase-order-line-items',
  allowAddLines = editing,
}: {
  rows: PurchaseOrderLineItemRow[]
  editing: boolean
  purchaseOrderId: string
  userId: string
  itemOptions: ItemOption[]
  lineColumns?: Array<{ id: PurchaseOrderLineColumnKey; label: string }>
  draftMode?: boolean
  onDraftRowsChange?: (
    rows: Array<{
      itemId: string | null
      description: string
      quantity: number
      unitPrice: number
      lineTotal: number
      displayOrder: number
    }>
  ) => void
  lineItemApiBasePath?: string
  deleteResource?: string
  parentIdFieldName?: string
  sectionTitle?: string
  emptyMessage?: string
  tableId?: string
  allowAddLines?: boolean
}) {
  const [editableRows, setEditableRows] = useState<Record<string, EditableRowState>>({})
  const [draftRows, setDraftRows] = useState<DraftRowState[]>([])
  const [rowOrder, setRowOrder] = useState<string[]>(() => rows.map((row) => row.id))
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const itemOptionLabelById = useMemo(
    () => new Map(itemOptions.map((item) => [item.id, `${item.itemId} - ${item.name}`])),
    [itemOptions]
  )

  const orderedVisibleLineColumns = useMemo(
    () =>
      (lineColumns && lineColumns.length > 0 ? lineColumns : [...COLUMN_DEFINITIONS])
        .filter((column) => COLUMN_DEFINITIONS.some((definition) => definition.id === column.id)),
    [lineColumns]
  )

  const columns = editing
    ? [...orderedVisibleLineColumns, EDIT_COLUMN_DEFINITION]
    : orderedVisibleLineColumns

  const orderedRows = useMemo(() => {
    if (!editing) return rows
    const byId = new Map(rows.map((row) => [row.id, row]))
    const normalizedOrder = [
      ...rowOrder.filter((id) => byId.has(id)),
      ...rows.map((row) => row.id).filter((id) => !rowOrder.includes(id)),
    ]
    return normalizedOrder.map((id) => byId.get(id)).filter((row): row is PurchaseOrderLineItemRow => Boolean(row))
  }, [editing, rowOrder, rows])

  const displayRows = useMemo(
    () =>
      orderedRows.map((row) => {
        const state = editableRows[row.id]
        if (!editing) return row

        const quantity = parseQuantity(state?.quantity ?? row.quantity, 1, 1)
        const unitPrice = parseMoneyValue(state?.unitPrice ?? row.unitPrice)
        const lineTotal = calcLineTotal(quantity, unitPrice)
        const selectedItem =
          state?.itemRecordId != null ? itemOptions.find((item) => item.id === state.itemRecordId) : null

        return {
          ...row,
          itemRecordId: state?.itemRecordId ?? row.itemRecordId,
          itemId: selectedItem?.itemId ?? row.itemId,
          itemName: selectedItem?.name ?? row.itemName,
          description: state?.description ?? row.description,
          quantity,
          unitPrice,
          lineTotal,
          billedQuantity: row.billedQuantity,
          openQuantity: Math.max(0, quantity - row.receivedQuantity),
        }
      }),
    [editing, editableRows, orderedRows, itemOptions]
  )

  const draftRowsForSave = useMemo(
    () =>
      draftRows.map((row, index) => {
        const quantity = parseQuantity(row.quantity, 1, 1)
        const unitPrice = parseMoneyValue(row.unitPrice)
        return {
          itemId: row.itemRecordId,
          description: row.description,
          quantity,
          unitPrice,
          lineTotal: calcLineTotal(quantity, unitPrice),
          displayOrder: rows.length + index,
        }
      }),
    [draftRows, rows.length]
  )
  const total = sumMoney([...displayRows, ...draftRowsForSave].map((row) => row.lineTotal))
  const totalCount = rows.length + draftRows.length

  function getExistingRowState(row: PurchaseOrderLineItemRow): EditableRowState {
    return editableRows[row.id] ?? {
      itemRecordId: row.itemRecordId,
      itemSearch:
        row.itemRecordId && itemOptionLabelById.get(row.itemRecordId)
          ? itemOptionLabelById.get(row.itemRecordId) ?? ''
          : row.itemId && row.itemName
            ? `${row.itemId} - ${row.itemName}`
            : row.itemId ?? '',
      description: row.description,
      quantity: String(row.quantity),
      unitPrice: String(row.unitPrice),
      error: '',
    }
  }

  function updateExistingRow(row: PurchaseOrderLineItemRow, updates: Partial<EditableRowState>) {
    const current = getExistingRowState(row)
    setEditableRows((prev) => ({
      ...prev,
      [row.id]: {
        ...current,
        ...updates,
      },
    }))
  }

  const persistExistingRow = useCallback(async (row: PurchaseOrderLineItemRow, state: EditableRowState, displayOrder: number) => {
    try {
      const response = await fetch(`${lineItemApiBasePath}?id=${encodeURIComponent(row.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: state.itemRecordId,
          description: state.description,
          quantity: state.quantity,
          unitPrice: state.unitPrice,
          displayOrder,
          userId,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        const error = body?.error || 'Unable to save line item'
        setEditableRows((prev) => ({
          ...prev,
          [row.id]: {
            ...state,
            error,
          },
        }))
        return { ok: false as const, error }
      }

      return { ok: true as const }
    } catch {
      const error = 'Unable to save line item'
      setEditableRows((prev) => ({
        ...prev,
        [row.id]: {
          ...state,
          error,
        },
      }))
      return { ok: false as const, error }
    }
  }, [lineItemApiBasePath, userId])

  function addDraftRow() {
    setDraftRows((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${prev.length}`,
        itemRecordId: null,
        itemSearch: '',
        description: '',
        quantity: '1',
        unitPrice: '',
        error: '',
      },
    ])
  }

  function updateDraftRow(draftId: string, updates: Partial<DraftRowState>) {
    setDraftRows((prev) => prev.map((row) => (row.id === draftId ? { ...row, ...updates } : row)))
  }

  const persistDraftRow = useCallback(async (state: DraftRowState, displayOrder: number) => {
    try {
      const response = await fetch(lineItemApiBasePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [parentIdFieldName]: purchaseOrderId,
          itemId: state.itemRecordId,
          description: state.description,
          quantity: state.quantity,
          unitPrice: state.unitPrice,
          displayOrder,
          userId,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        const error = body?.error || 'Unable to add line item'
        updateDraftRow(state.id, { error })
        return { ok: false as const, error }
      }

      return { ok: true as const }
    } catch {
      const error = 'Unable to add line item'
      updateDraftRow(state.id, { error })
      return { ok: false as const, error }
    }
  }, [lineItemApiBasePath, parentIdFieldName, purchaseOrderId, userId])

  function cancelDraftRow(draftId: string) {
    setDraftRows((prev) => prev.filter((row) => row.id !== draftId))
  }

  function moveRowBefore(targetRowId: string) {
    if (!draggedRowId || draggedRowId === targetRowId) return
    setRowOrder((prev) => {
      const withoutDragged = prev.filter((id) => id !== draggedRowId)
      const targetIndex = withoutDragged.indexOf(targetRowId)
      if (targetIndex === -1) return prev
      const next = [...withoutDragged]
      next.splice(targetIndex, 0, draggedRowId)
      return next
    })
  }

  useEffect(() => {
    if (!editing || draftMode) return

    async function saveAllLineItems() {
      const changedRows = orderedRows
        .map((row, index) => ({ row, state: editableRows[row.id], displayOrder: index }))
        .filter(
          (entry): entry is { row: PurchaseOrderLineItemRow; state: EditableRowState; displayOrder: number } => Boolean(entry.state)
        )

      for (const { row, state, displayOrder } of changedRows) {
        const result = await persistExistingRow(row, { ...state, error: '' }, displayOrder)
        if (!result.ok) return result
      }

      for (const [index, draftRow] of draftRows.entries()) {
        const result = await persistDraftRow({ ...draftRow, error: '' }, orderedRows.length + index)
        if (!result.ok) return result
      }

      return { ok: true as const }
    }

    window.__purchaseOrderLineItemSavers = window.__purchaseOrderLineItemSavers ?? {}
    window.__purchaseOrderLineItemSavers[purchaseOrderId] = saveAllLineItems
    window.__transactionLineItemSavers = window.__transactionLineItemSavers ?? {}
    window.__transactionLineItemSavers[purchaseOrderId] = saveAllLineItems

    return () => {
      if (window.__purchaseOrderLineItemSavers) {
        delete window.__purchaseOrderLineItemSavers[purchaseOrderId]
      }
      if (window.__transactionLineItemSavers) {
        delete window.__transactionLineItemSavers[purchaseOrderId]
      }
    }
  }, [draftMode, draftRows, editableRows, editing, orderedRows, persistDraftRow, persistExistingRow, purchaseOrderId])

  useEffect(() => {
    if (!draftMode) return
    onDraftRowsChange?.(draftRowsForSave)
  }, [draftMode, draftRowsForSave, onDraftRowsChange])

  return (
    <div
      className="mb-6 overflow-hidden rounded-xl border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-6 py-4"
        style={{ borderColor: 'var(--border-muted)' }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-white">{sectionTitle}</h2>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-md px-1.5 py-0.5 text-xs"
            style={{ color: 'var(--text-muted)' }}
            aria-label={expanded ? 'Collapse Line Items' : 'Expand Line Items'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {editing && allowAddLines ? (
            <button
              type="button"
              onClick={addDraftRow}
              className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              Add Line
            </button>
          ) : null}
          <span className="text-xs font-semibold text-white">Total {fmtCurrency(total)}</span>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: 'rgba(59,130,246,0.18)',
              color: 'var(--accent-primary-strong)',
            }}
          >
            {totalCount}
          </span>
          <ColumnSelector tableId={tableId} columns={columns.map((column) => ({ ...column }))} />
        </div>
      </div>

      {!expanded ? null : rows.length === 0 && draftRows.length === 0 ? (
        <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          {emptyMessage}
        </p>
      ) : (
        <>
          <div id={tableId} className="overflow-x-auto overflow-y-visible" data-column-selector-table={tableId}>
            <table className="min-w-[1200px] w-full" data-disable-filter-sort="true">
              <thead>
                <tr>
                  {orderedVisibleLineColumns.map((column) => {
                    const layout = COLUMN_LAYOUT[column.id]
                    const pinnedLeft = getPinnedLeft(orderedVisibleLineColumns, column.id)
                    return (
                      <HeaderCell
                        key={column.id}
                        columnId={column.id}
                        align={layout.align}
                        pinned={layout.pinned}
                        left={pinnedLeft}
                        width={layout.width}
                      >
                        <HeaderLabel label={column.label} tooltip={HEADER_TOOLTIPS[column.id]} />
                      </HeaderCell>
                    )
                  })}
                  {editing ? <HeaderCell columnId="actions" align="right">Actions</HeaderCell> : null}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, index) => {
                  const state = getExistingRowState(row)

                  return (
                    <tr
                      key={row.id}
                      style={index < displayRows.length - 1 || draftRows.length > 0 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
                      onDragOver={(event) => {
                        if (!editing || !draggedRowId) return
                        event.preventDefault()
                      }}
                      onDrop={(event) => {
                        if (!editing || !draggedRowId) return
                        event.preventDefault()
                        moveRowBefore(row.id)
                        setDraggedRowId(null)
                      }}
                    >
                      {orderedVisibleLineColumns.map((column) => {
                        const layout = COLUMN_LAYOUT[column.id]
                        const pinnedLeft = getPinnedLeft(orderedVisibleLineColumns, column.id)
                        return (
                          <BodyCell
                            key={column.id}
                            columnId={column.id}
                            align={layout.align}
                            pinned={layout.pinned}
                            left={pinnedLeft}
                            width={layout.width}
                          >
                            {renderLineCell({
                              columnId: column.id,
                              row,
                              rowIndex: index,
                              editing,
                              state,
                              updateExistingRow,
                              itemOptions,
                            })}
                          </BodyCell>
                        )
                      })}
                      {editing ? (
                        <BodyCell columnId="actions" align="right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              draggable
                              onDragStart={() => setDraggedRowId(row.id)}
                              onDragEnd={() => setDraggedRowId(null)}
                              className="rounded-md border px-2 py-1 text-xs"
                              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                              title="Drag to reorder line"
                            >
                              {'\u2630'}
                            </button>
                            {!draftMode ? <DeleteButton resource={deleteResource} id={row.id} /> : null}
                          </div>
                        </BodyCell>
                      ) : null}
                    </tr>
                  )
                })}
                {editing
                  ? draftRows.map((draftRow, draftIndex) => {
                      const quantity = parseQuantity(draftRow.quantity, 1, 1)
                      const lineTotal = calcLineTotal(quantity, draftRow.unitPrice)
                      const lineNumber = rows.length + draftIndex + 1

                      return (
                        <tr
                          key={draftRow.id}
                          style={{
                            borderTop: rows.length > 0 || draftIndex > 0 ? '1px solid var(--border-muted)' : undefined,
                          }}
                        >
                          {orderedVisibleLineColumns.map((column) => {
                            const layout = COLUMN_LAYOUT[column.id]
                            const pinnedLeft = getPinnedLeft(orderedVisibleLineColumns, column.id)
                            return (
                              <BodyCell
                                key={column.id}
                                columnId={column.id}
                                align={layout.align}
                                pinned={layout.pinned}
                                left={pinnedLeft}
                                width={layout.width}
                              >
                                {renderDraftLineCell({
                                  columnId: column.id,
                                  lineNumber,
                                  quantity,
                                  lineTotal,
                                  draftRow,
                                  updateDraftRow,
                                  itemOptions,
                                })}
                              </BodyCell>
                            )
                          })}
                          <BodyCell columnId="actions" align="right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => cancelDraftRow(draftRow.id)}
                                className="rounded-md border px-2 py-1 text-xs font-medium"
                                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                              >
                                Cancel
                              </button>
                            </div>
                            {draftRow.error ? (
                              <p className="mt-1 text-right text-xs" style={{ color: 'var(--danger)' }}>
                                {draftRow.error}
                              </p>
                            ) : null}
                          </BodyCell>
                        </tr>
                      )
                    })
                  : null}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--border-muted)' }}>
                  {orderedVisibleLineColumns.map((column) => {
                    const layout = COLUMN_LAYOUT[column.id]
                    const pinnedLeft = getPinnedLeft(orderedVisibleLineColumns, column.id)
                    return (
                      <FooterCell
                        key={column.id}
                        columnId={column.id}
                        align={layout.align}
                        pinned={layout.pinned}
                        left={pinnedLeft}
                        width={layout.width}
                      >
                        {column.id === 'line' ? (
                          <span className="font-semibold text-white">Total</span>
                        ) : column.id === 'line-total' ? (
                          <span className="font-semibold text-white">{fmtCurrency(total)}</span>
                        ) : null}
                      </FooterCell>
                    )
                  })}
                  {editing ? <FooterCell columnId="actions" align="right" /> : null}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function getPinnedLeft(
  visibleColumns: Array<{ id: PurchaseOrderLineColumnKey }>,
  columnId: PurchaseOrderLineColumnKey
) {
  let offset = 0
  for (const column of visibleColumns) {
    if (column.id === columnId) break
    if (COLUMN_LAYOUT[column.id].pinned) {
      offset += COLUMN_LAYOUT[column.id].width ?? 120
    }
  }
  return offset
}

function renderLineCell({
  columnId,
  row,
  rowIndex,
  editing,
  state,
  updateExistingRow,
  itemOptions,
}: {
  columnId: PurchaseOrderLineColumnKey
  row: PurchaseOrderLineItemRow
  rowIndex: number
  editing: boolean
  state: EditableRowState
  updateExistingRow: (row: PurchaseOrderLineItemRow, updates: Partial<EditableRowState>) => void
  itemOptions: ItemOption[]
}) {
  switch (columnId) {
    case 'line':
      return rowIndex + 1
    case 'item-id':
      return editing ? (
        <ItemLookupInput
          value={state.itemSearch}
          itemOptions={itemOptions}
          onChange={(value) => {
            updateExistingRow(row, {
              itemRecordId: null,
              itemSearch: value,
              error: '',
            })
          }}
          onSelect={(item) => {
            updateExistingRow(row, buildItemSelectionUpdates(item))
          }}
        />
      ) : (
        row.itemId ?? '-'
      )
    case 'description':
      return editing ? (
        <div className="space-y-1">
          <input
            value={state.description}
            onChange={(event) => updateExistingRow(row, { description: event.target.value, error: '' })}
            disabled={state.itemRecordId != null}
            className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
          {state.error ? (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>
              {state.error}
            </p>
          ) : null}
        </div>
      ) : (
        <span style={{ color: 'var(--text-secondary)' }}>{row.description}</span>
      )
    case 'quantity':
      return editing ? (
        <input
          type="number"
          min="1"
          value={state.quantity}
          onChange={(event) => updateExistingRow(row, { quantity: event.target.value, error: '' })}
          className="w-20 rounded-md border bg-transparent px-2 py-1.5 text-right text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
      ) : (
        row.quantity
      )
    case 'received-qty':
      return row.receivedQuantity
    case 'billed-qty':
      return row.billedQuantity
    case 'open-qty':
      return row.openQuantity
    case 'unit-price':
      return editing ? (
        <input
          type="number"
          min="0"
          step="0.01"
          value={state.unitPrice}
          onChange={(event) => updateExistingRow(row, { unitPrice: event.target.value, error: '' })}
          className="w-28 rounded-md border bg-transparent px-2 py-1.5 text-right text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
      ) : (
        fmtCurrency(row.unitPrice)
      )
    case 'line-total':
      return <span className="font-semibold text-white">{fmtCurrency(row.lineTotal)}</span>
    default:
      return null
  }
}

function renderDraftLineCell({
  columnId,
  lineNumber,
  quantity,
  lineTotal,
  draftRow,
  updateDraftRow,
  itemOptions,
}: {
  columnId: PurchaseOrderLineColumnKey
  lineNumber: number
  quantity: number
  lineTotal: number
  draftRow: DraftRowState
  updateDraftRow: (draftId: string, updates: Partial<DraftRowState>) => void
  itemOptions: ItemOption[]
}) {
  switch (columnId) {
    case 'line':
      return lineNumber
    case 'item-id':
      return (
        <ItemLookupInput
          value={draftRow.itemSearch}
          itemOptions={itemOptions}
          onChange={(value) => {
            updateDraftRow(draftRow.id, {
              itemRecordId: null,
              itemSearch: value,
              error: '',
            })
          }}
          onSelect={(item) => {
            updateDraftRow(draftRow.id, buildItemSelectionUpdates(item))
          }}
        />
      )
    case 'description':
      return (
        <input
          value={draftRow.description}
          onChange={(event) => updateDraftRow(draftRow.id, { description: event.target.value, error: '' })}
          disabled={draftRow.itemRecordId != null}
          placeholder="Description"
          className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
      )
    case 'quantity':
      return (
        <input
          type="number"
          min="1"
          value={draftRow.quantity}
          onChange={(event) => updateDraftRow(draftRow.id, { quantity: event.target.value, error: '' })}
          className="w-20 rounded-md border bg-transparent px-2 py-1.5 text-right text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
      )
    case 'received-qty':
      return 0
    case 'billed-qty':
      return 0
    case 'open-qty':
      return quantity
    case 'unit-price':
      return (
        <input
          type="number"
          min="0"
          step="0.01"
          value={draftRow.unitPrice}
          onChange={(event) => updateDraftRow(draftRow.id, { unitPrice: event.target.value, error: '' })}
          className="w-28 rounded-md border bg-transparent px-2 py-1.5 text-right text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
      )
    case 'line-total':
      return <span className="font-semibold text-white">{fmtCurrency(lineTotal)}</span>
    default:
      return null
  }
}

function HeaderLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <FieldTooltip content={tooltip} />
    </span>
  )
}

function HeaderCell({
  children,
  columnId,
  align = 'left',
  pinned,
  left,
  width,
}: {
  children: React.ReactNode
  columnId: string
  align?: 'left' | 'center' | 'right'
  pinned?: boolean
  left?: number
  width?: number
}) {
  return (
    <th
      data-column={columnId}
      className={`px-4 py-2 text-xs font-medium uppercase tracking-wide ${getAlignClassName(align)}`}
      style={{
        color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border-muted)',
        backgroundColor: 'var(--card)',
        ...(pinned ? getPinnedStyle(left ?? 0, width ?? 120, 20) : width ? { minWidth: width, width } : {}),
      }}
    >
      {children}
    </th>
  )
}

function BodyCell({
  children,
  columnId,
  align = 'left',
  pinned,
  left,
  width,
}: {
  children?: React.ReactNode
  columnId: string
  align?: 'left' | 'center' | 'right'
  pinned?: boolean
  left?: number
  width?: number
}) {
  return (
    <td
      data-column={columnId}
      className={`px-4 py-3 text-sm ${getAlignClassName(align)}`}
      style={{
        color: 'var(--text-secondary)',
        ...(pinned ? getPinnedStyle(left ?? 0, width ?? 120, 10) : width ? { minWidth: width, width } : {}),
      }}
    >
      {children}
    </td>
  )
}

function FooterCell({
  children,
  columnId,
  align = 'left',
  pinned,
  left,
  width,
}: {
  children?: React.ReactNode
  columnId: string
  align?: 'left' | 'center' | 'right'
  pinned?: boolean
  left?: number
  width?: number
}) {
  return (
    <td
      data-column={columnId}
      className={`px-4 py-3 text-sm ${getAlignClassName(align)}`}
      style={{
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--card-elevated)',
        ...(pinned
          ? {
              ...getPinnedStyle(left ?? 0, width ?? 120, 15),
            }
          : width
            ? { minWidth: width, width }
            : {}),
      }}
    >
      {children}
    </td>
  )
}

function getAlignClassName(align: 'left' | 'center' | 'right') {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

function getPinnedStyle(left: number, width: number, zIndex: number) {
  return {
    position: 'sticky' as const,
    left,
    zIndex,
    minWidth: width,
    width,
    boxShadow: '1px 0 0 0 var(--border-muted)',
  }
}

function FieldTooltip({ content }: { content: string }) {
  return (
    <span className="inline-flex">
      <span
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border text-[10px] font-semibold"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}
        aria-label={content}
        title={content}
      >
        ?
      </span>
    </span>
  )
}

function ItemLookupInput({
  value,
  itemOptions,
  onChange,
  onSelect,
}: {
  value: string
  itemOptions: ItemOption[]
  onChange: (value: string) => void
  onSelect: (item: ItemOption) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const [dropdownStyle, setDropdownStyle] = useState<{ bottom: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (!open || !inputRef.current) return

    function updatePosition() {
      if (!inputRef.current) return
      const rect = inputRef.current.getBoundingClientRect()
      const desiredWidth = Math.max(rect.width + 220, 420)
      setDropdownStyle({
        bottom: Math.max(window.innerHeight - rect.top + 4, 8),
        left: Math.max(16, Math.min(rect.left, window.innerWidth - desiredWidth - 16)),
        width: Math.min(desiredWidth, window.innerWidth - 32),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase()
    if (!query) return itemOptions.slice(0, 12)
    return itemOptions.filter((item) => `${item.itemId} ${item.name}`.toLowerCase().includes(query)).slice(0, 12)
  }, [itemOptions, value])

  return (
    <div ref={containerRef} className="relative z-50">
      <input
        ref={inputRef}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        placeholder="Search item"
        className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
        style={{
          borderColor: 'var(--border-muted)',
          color: 'white',
          backgroundColor: 'var(--card-elevated)',
          colorScheme: 'dark',
          WebkitTextFillColor: 'white',
        }}
      />
      {open && filtered.length > 0 && dropdownStyle
        ? createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[200] max-h-52 overflow-y-auto rounded-md border shadow-2xl"
              style={{
                bottom: dropdownStyle.bottom,
                left: dropdownStyle.left,
                width: dropdownStyle.width,
                borderColor: 'var(--border-muted)',
                backgroundColor: 'var(--card-elevated)',
              }}
            >
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onSelect(item)
                    setOpen(false)
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="font-medium text-white">{item.itemId}</span>
                  <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
                    {item.name}
                  </span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
