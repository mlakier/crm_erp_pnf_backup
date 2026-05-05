'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import DeleteButton from '@/components/DeleteButton'
import SearchableSelect from '@/components/SearchableSelect'
import { fmtCurrency } from '@/lib/format'
import { calcLineTotal, parseMoneyValue, parseQuantity, sumMoney } from '@/lib/money'
import type { PurchaseOrderLineColumnKey } from '@/lib/purchase-order-detail-customization'

type TransactionLineColumnKey = PurchaseOrderLineColumnKey | 'notes' | 'line-type' | 'expense-account'

type PurchaseOrderLineItemRow = {
  id: string
  displayOrder: number
  lineType?: 'item' | 'expense'
  itemRecordId: string | null
  itemId: string | null
  itemName: string | null
  expenseAccountRecordId?: string | null
  expenseAccountId?: string | null
  expenseAccountName?: string | null
  description: string
  notes?: string | null
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

type AccountOption = {
  id: string
  accountId: string
  accountNumber?: string | null
  name: string
}

type EditableRowState = {
  lineType: 'item' | 'expense'
  itemRecordId: string | null
  itemSearch: string
  expenseAccountRecordId: string | null
  expenseAccountSearch: string
  description: string
  notes: string
  quantity: string
  unitPrice: string
  error: string
}

type DraftRowState = EditableRowState & {
  id: string
}

type LineWidthMode = 'auto' | 'compact' | 'normal' | 'wide'
type LineDisplayMode = 'label' | 'idAndLabel' | 'id'
type LineDropdownSortMode = 'id' | 'label'
type LineSectionSettings = {
  fontSize?: 'xs' | 'sm'
}
type LineColumnSettings = Partial<Record<
  TransactionLineColumnKey,
  {
    widthMode?: LineWidthMode
    showColumnMode?: 'always' | 'itemOnly' | 'expenseOnly'
    editDisplay?: LineDisplayMode
    viewDisplay?: LineDisplayMode
    dropdownDisplay?: LineDisplayMode
    dropdownSort?: LineDropdownSortMode
  }
>>

declare global {
  interface Window {
    __purchaseOrderLineItemSavers?: Record<string, () => Promise<{ ok: boolean; error?: string }>>
    __transactionLineItemSavers?: Record<string, () => Promise<{ ok: boolean; error?: string }>>
  }
}

const COLUMN_DEFINITIONS = [
  { id: 'line', label: 'Line', locked: true },
  { id: 'line-type', label: 'Line Type', defaultVisible: true },
  { id: 'item-id', label: 'Item Id', locked: true },
  { id: 'expense-account', label: 'Expense Account', defaultVisible: true },
  { id: 'description', label: 'Description', defaultVisible: true },
  { id: 'quantity', label: 'Qty', defaultVisible: true },
  { id: 'received-qty', label: "Rec'd Qty", defaultVisible: true },
  { id: 'open-qty', label: 'Open Qty', defaultVisible: true },
  { id: 'billed-qty', label: 'Billed Qty', defaultVisible: true },
  { id: 'unit-price', label: 'Unit Price', defaultVisible: true },
  { id: 'line-total', label: 'Line Total', defaultVisible: true },
  { id: 'notes', label: 'Notes', defaultVisible: true },
] as const

const BASE_COLUMN_LAYOUT: Record<
  TransactionLineColumnKey,
  { align?: 'left' | 'center' | 'right'; width?: number; pinned?: boolean }
> = {
  line: { align: 'center', width: 72, pinned: true },
  'line-type': { width: 140 },
  'item-id': { width: 240, pinned: true },
  'expense-account': { width: 240 },
  description: { width: 280 },
  quantity: { align: 'right' },
  'received-qty': { align: 'right' },
  'billed-qty': { align: 'right' },
  'open-qty': { align: 'right' },
  'unit-price': { align: 'right', width: 120 },
  'line-total': { align: 'right', width: 150 },
  notes: { width: 220 },
}

const AUTO_FIT_COLUMN_LIMITS: Partial<Record<TransactionLineColumnKey, { min: number; max: number }>> = {
  'item-id': { min: 180, max: 520 },
  'expense-account': { min: 120, max: 520 },
  description: { min: 140, max: 420 },
  notes: { min: 160, max: 420 },
}

const FIXED_WIDTH_COLUMNS: Partial<Record<TransactionLineColumnKey, number>> = {
  line: 56,
  'line-type': 120,
  quantity: 72,
  'received-qty': 88,
  'billed-qty': 88,
  'open-qty': 88,
  'unit-price': 120,
  'line-total': 140,
}

const HEADER_TOOLTIPS: Record<string, string> = {
  line: 'Sequential line number for this purchase order.',
  'line-type': 'Controls whether the line is item-driven or posts directly to an expense account.',
  'item-id': 'Search and select the linked item using Item ID or Item Name.',
  'expense-account': 'Search and select the posting expense account for expense-type lines.',
  description: 'Description of the goods or services being purchased on this line.',
  quantity: 'Ordered quantity for this line item.',
  'received-qty': 'Derived received quantity for this line based on total receipts recorded against the purchase order.',
  'billed-qty': 'Derived billed quantity for this line based on total billed quantities recorded against related bills.',
  'open-qty': 'Derived remaining open quantity for this line based on ordered quantity less received quantity.',
  'unit-price': 'Price per unit for this purchase order line.',
  'line-total': 'Extended line amount calculated from quantity and unit price.',
  notes: 'Additional internal notes captured for this line.',
}

function buildItemSelectionUpdates(item: ItemOption): Partial<EditableRowState> {
  return {
    lineType: 'item',
    itemRecordId: item.id,
    itemSearch: item.itemId,
    expenseAccountRecordId: null,
    expenseAccountSearch: '',
    description: item.itemDrivenValues?.description ?? item.name,
    unitPrice: item.itemDrivenValues?.unitPrice ?? String(item.unitPrice ?? 0),
    error: '',
  }
}

function buildExpenseAccountSelectionUpdates(account: AccountOption): Partial<EditableRowState> {
  return {
    lineType: 'expense',
    itemRecordId: null,
    itemSearch: '',
    expenseAccountRecordId: account.id,
    expenseAccountSearch: account.accountNumber ?? account.accountId,
    error: '',
  }
}

function formatLookupValue(
  id: string | null | undefined,
  label: string | null | undefined,
  mode: LineDisplayMode,
) {
  if (mode === 'id') return id ?? label ?? ''
  if (mode === 'label') return label ?? id ?? ''
  if (id && label) return `${id} - ${label}`
  return id ?? label ?? ''
}

function getLookupSortValue(option: { value: string; label: string }, mode: LineDropdownSortMode) {
  return (mode === 'label' ? option.label : option.value).toLowerCase()
}

function estimateAutoFitWidth({
  values,
  min,
  max,
}: {
  values: Array<string | null | undefined>
  min: number
  max: number
}) {
  const longestLength = values.reduce((currentMax, value) => {
    const normalized = String(value ?? '').trim()
    return normalized.length > currentMax ? normalized.length : currentMax
  }, 0)

  if (longestLength === 0) return min

  const estimated = Math.round(longestLength * 6.7 + 24)
  return Math.max(min, Math.min(max, estimated))
}

function estimateEditableControlWidth({
  value,
  min,
  max,
  fallback,
}: {
  value: string | null | undefined
  min: number
  max: number
  fallback: string
}) {
  const normalized = (value && value.trim()) || fallback
  const estimated = Math.round(normalized.length * 6.7 + 28)
  return Math.max(min, Math.min(max, estimated))
}

export default function TransactionLineItemsSection({
  rows,
  editing,
  purchaseOrderId,
  userId,
  itemOptions,
  lineColumns,
  lineSettings,
  lineColumnCustomization,
  draftMode,
  initialDraftRows,
  onDraftRowsChange,
  lineItemApiBasePath = '/api/purchase-order-line-items',
  deleteResource = 'purchase-order-line-items',
  parentIdFieldName = 'purchaseOrderId',
  sectionTitle = 'Line Items',
  emptyMessage = 'No line items yet.',
  tableId = 'purchase-order-line-items',
  allowAddLines = editing,
  accountOptions = [],
  currencyCode,
}: {
  rows: PurchaseOrderLineItemRow[]
  editing: boolean
  purchaseOrderId: string
  userId: string
  itemOptions: ItemOption[]
  lineColumns?: Array<{ id: TransactionLineColumnKey; label: string }>
  lineSettings?: LineSectionSettings
  lineColumnCustomization?: LineColumnSettings
  draftMode?: boolean
  initialDraftRows?: Array<{
    lineType: 'item' | 'expense'
    itemId: string | null
    expenseAccountId?: string | null
    description: string
    notes?: string | null
    quantity: number
    unitPrice: number
    lineTotal: number
    displayOrder: number
  }>
  onDraftRowsChange?: (
    rows: Array<{
      lineType: 'item' | 'expense'
      itemId: string | null
      expenseAccountId?: string | null
      description: string
      notes?: string | null
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
  accountOptions?: AccountOption[]
  currencyCode?: string | null
}) {
  const [editableRows, setEditableRows] = useState<Record<string, EditableRowState>>({})
  const [draftRows, setDraftRows] = useState<DraftRowState[]>(
    () =>
      (initialDraftRows ?? []).map((row, index) => {
        const linkedItem = row.lineType === 'expense' ? null : itemOptions.find((item) => item.id === row.itemId)
        const linkedAccount =
          row.lineType === 'expense' && row.expenseAccountId
            ? accountOptions.find((account) => account.id === row.expenseAccountId)
            : null
        return {
          id: `draft-initial-${index}`,
          lineType: row.lineType,
          itemRecordId: row.lineType === 'expense' ? null : row.itemId,
          itemSearch: linkedItem ? formatLookupValue(linkedItem.itemId, linkedItem.name, lineColumnCustomization?.['item-id']?.editDisplay ?? 'idAndLabel') : '',
          expenseAccountRecordId: row.lineType === 'expense' ? row.expenseAccountId ?? null : null,
          expenseAccountSearch: linkedAccount ? formatLookupValue(linkedAccount.accountNumber ?? linkedAccount.accountId, linkedAccount.name, lineColumnCustomization?.['expense-account']?.editDisplay ?? 'idAndLabel') : '',
          description: row.description,
          notes: row.notes ?? '',
          quantity: String(row.quantity),
          unitPrice: String(row.unitPrice),
          error: '',
        }
      }),
  )
  const [rowOrder, setRowOrder] = useState<string[]>(() => rows.map((row) => row.id))
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const lineFontSize = lineSettings?.fontSize ?? 'sm'
  const tableFontSize = lineFontSize === 'xs' ? '0.75rem' : '0.875rem'
  const tableInputClass = lineFontSize === 'xs' ? 'text-xs' : 'text-sm'

  const baseVisibleLineColumns = useMemo(
    () =>
      (lineColumns && lineColumns.length > 0 ? lineColumns : [...COLUMN_DEFINITIONS])
        .filter((column) => COLUMN_DEFINITIONS.some((definition) => definition.id === column.id)),
    [lineColumns]
  )

  const activeLineTypes = useMemo(() => {
    const types = new Set<'item' | 'expense'>()

    for (const row of rows) {
      const nextType = editableRows[row.id]?.lineType ?? row.lineType ?? 'item'
      types.add(nextType)
    }

    for (const draftRow of draftRows) {
      types.add(draftRow.lineType)
    }

    if (types.size === 0) types.add('item')
    return types
  }, [draftRows, editableRows, rows])

  const orderedVisibleLineColumns = useMemo(() => {
    const hasItemLines = activeLineTypes.has('item')
    const hasExpenseLines = activeLineTypes.has('expense')

    return baseVisibleLineColumns.filter((column) => {
      const showColumnMode = lineColumnCustomization?.[column.id]?.showColumnMode ?? 'always'
      if (showColumnMode === 'itemOnly' && !hasItemLines) return false
      if (showColumnMode === 'expenseOnly' && !hasExpenseLines) return false
      return true
    })
  }, [activeLineTypes, baseVisibleLineColumns, lineColumnCustomization])

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
        const selectedExpenseAccount =
          state?.expenseAccountRecordId != null
            ? accountOptions.find((account) => account.id === state.expenseAccountRecordId)
            : null

        return {
          ...row,
          lineType: state?.lineType ?? row.lineType ?? 'item',
          itemRecordId: state?.itemRecordId ?? row.itemRecordId,
          itemId: selectedItem?.itemId ?? row.itemId,
          itemName: selectedItem?.name ?? row.itemName,
          expenseAccountRecordId: state?.expenseAccountRecordId ?? row.expenseAccountRecordId,
          expenseAccountId: selectedExpenseAccount?.accountNumber ?? selectedExpenseAccount?.accountId ?? row.expenseAccountId,
          expenseAccountName: selectedExpenseAccount?.name ?? row.expenseAccountName,
          description: state?.description ?? row.description,
          notes: state?.notes ?? row.notes ?? '',
          quantity,
          unitPrice,
          lineTotal,
          billedQuantity: row.billedQuantity,
          openQuantity: Math.max(0, quantity - row.receivedQuantity),
        }
      }),
    [accountOptions, editing, editableRows, orderedRows, itemOptions]
  )

  const draftRowsForSave = useMemo(
    () =>
      draftRows.map((row, index) => {
        const quantity = parseQuantity(row.quantity, 1, 1)
        const unitPrice = parseMoneyValue(row.unitPrice)
        return {
          lineType: row.lineType,
          itemId: row.itemRecordId,
          expenseAccountId: row.expenseAccountRecordId,
          description: row.description,
          notes: row.notes || null,
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

  const columnAutoWidths = useMemo(() => {
    const widths: Partial<Record<TransactionLineColumnKey, number>> = {}
    const itemDisplayMode = editing
      ? lineColumnCustomization?.['item-id']?.editDisplay ?? 'idAndLabel'
      : lineColumnCustomization?.['item-id']?.viewDisplay ?? 'idAndLabel'
    const accountDisplayMode = editing
      ? lineColumnCustomization?.['expense-account']?.editDisplay ?? 'idAndLabel'
      : lineColumnCustomization?.['expense-account']?.viewDisplay ?? 'idAndLabel'

    for (const [columnId, limits] of Object.entries(AUTO_FIT_COLUMN_LIMITS) as Array<
      [TransactionLineColumnKey, { min: number; max: number }]
    >) {
      const values: Array<string | null | undefined> = [COLUMN_DEFINITIONS.find((column) => column.id === columnId)?.label]

      for (const row of displayRows) {
        switch (columnId) {
          case 'line':
            values.push(String(row.displayOrder))
            break
          case 'line-type':
            values.push(row.lineType === 'expense' ? 'Expense' : 'Item')
            break
          case 'item-id':
            values.push(row.lineType === 'expense' ? '' : formatLookupValue(row.itemId, row.itemName, itemDisplayMode))
            break
          case 'expense-account':
            values.push(
              row.lineType === 'expense'
                ? formatLookupValue(row.expenseAccountId, row.expenseAccountName, accountDisplayMode)
                : '-',
            )
            break
          case 'description':
            values.push(row.description)
            break
          case 'quantity':
            values.push(String(row.quantity))
            break
          case 'received-qty':
            values.push(String(row.receivedQuantity))
            break
          case 'billed-qty':
            values.push(String(row.billedQuantity))
            break
          case 'open-qty':
            values.push(String(row.openQuantity))
            break
          case 'unit-price':
            values.push(fmtCurrency(row.unitPrice, currencyCode ?? undefined))
            break
          case 'line-total':
            values.push(fmtCurrency(row.lineTotal, currencyCode ?? undefined))
            break
          case 'notes':
            values.push(row.notes ?? '-')
            break
        }
      }

      for (const draftRow of draftRows) {
        switch (columnId) {
          case 'line':
            values.push(String(rows.length + 1))
            break
          case 'line-type':
            values.push(draftRow.lineType === 'expense' ? 'Expense' : 'Item')
            break
          case 'item-id':
            values.push(draftRow.lineType === 'expense' ? '' : draftRow.itemSearch || 'Select or search item')
            break
          case 'expense-account':
            values.push(
              draftRow.lineType === 'expense'
                ? draftRow.expenseAccountSearch || 'Select expense account'
                : '-',
            )
            break
          case 'description':
            values.push(draftRow.description || 'Description')
            break
          case 'quantity':
            values.push(String(parseQuantity(draftRow.quantity, 1, 1)))
            break
          case 'received-qty':
          case 'billed-qty':
            values.push('0')
            break
          case 'open-qty':
            values.push(String(parseQuantity(draftRow.quantity, 1, 1)))
            break
          case 'unit-price':
            values.push(fmtCurrency(parseMoneyValue(draftRow.unitPrice), currencyCode ?? undefined))
            break
          case 'line-total':
            values.push(fmtCurrency(calcLineTotal(parseQuantity(draftRow.quantity, 1, 1), draftRow.unitPrice), currencyCode ?? undefined))
            break
          case 'notes':
            values.push(draftRow.notes || 'Notes')
            break
        }
      }

      widths[columnId] = estimateAutoFitWidth({
        values,
        min: limits.min,
        max: limits.max,
      })
    }

    return widths
  }, [currencyCode, displayRows, draftRows, editing, lineColumnCustomization, rows.length])

  const getColumnLayout = useCallback(
    (columnId: TransactionLineColumnKey) => {
      const base = BASE_COLUMN_LAYOUT[columnId]
      const widthMode = lineColumnCustomization?.[columnId]?.widthMode ?? 'auto'
      const contentWidth = columnAutoWidths[columnId]
      const baseWidth = FIXED_WIDTH_COLUMNS[columnId] ?? contentWidth ?? base.width
      const width =
        widthMode === 'auto'
          ? baseWidth ?? 120
          : widthMode === 'compact'
            ? Math.max(72, Math.round((baseWidth ?? 140) * 0.7))
            : widthMode === 'wide'
              ? Math.round((baseWidth ?? 140) * 1.35)
              : baseWidth

      return { ...base, width, pinned: false }
    },
    [columnAutoWidths, lineColumnCustomization],
  )

  function getExistingRowState(row: PurchaseOrderLineItemRow): EditableRowState {
    return editableRows[row.id] ?? {
      lineType: row.lineType ?? 'item',
      itemRecordId: row.itemRecordId,
      itemSearch: formatLookupValue(
        row.itemId,
        row.itemName,
        lineColumnCustomization?.['item-id']?.editDisplay ?? 'idAndLabel',
      ),
      expenseAccountRecordId: row.expenseAccountRecordId ?? null,
      expenseAccountSearch: formatLookupValue(
        row.expenseAccountId,
        row.expenseAccountName,
        lineColumnCustomization?.['expense-account']?.editDisplay ?? 'idAndLabel',
      ),
      description: row.description,
      notes: row.notes ?? '',
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
          lineType: state.lineType,
          itemId: state.itemRecordId,
          expenseAccountId: state.expenseAccountRecordId,
          description: state.description,
          notes: state.notes || null,
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
        lineType: 'item',
        itemRecordId: null,
        itemSearch: '',
        expenseAccountRecordId: null,
        expenseAccountSearch: '',
        description: '',
        notes: '',
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
          lineType: state.lineType,
          itemId: state.itemRecordId,
          expenseAccountId: state.expenseAccountRecordId,
          description: state.description,
          notes: state.notes || null,
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
      className="relative z-0 mb-6 overflow-hidden rounded-xl border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
    >
      <div
        className="relative z-30 flex items-center justify-between gap-3 border-b px-6 py-4"
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
          <span className="text-xs font-semibold text-white">Total {fmtCurrency(total, currencyCode ?? undefined)}</span>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: 'rgba(59,130,246,0.18)',
              color: 'var(--accent-primary-strong)',
            }}
          >
            {totalCount}
          </span>
        </div>
      </div>

      {!expanded ? null : rows.length === 0 && draftRows.length === 0 ? (
        <p className={`px-6 py-4 ${tableInputClass}`} style={{ color: 'var(--text-muted)' }}>
          {emptyMessage}
        </p>
      ) : (
        <>
          <div id={tableId} className="relative z-0 overflow-x-auto overflow-y-hidden" data-column-selector-table={tableId}>
            <table className="min-w-max w-max" data-disable-filter-sort="true" data-line-items-table="true" style={{ fontSize: tableFontSize }}>
              <thead>
                <tr>
                  {orderedVisibleLineColumns.map((column) => {
                    const layout = getColumnLayout(column.id)
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
                        const layout = getColumnLayout(column.id)
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
                              accountOptions,
                              lineColumnCustomization,
                              currencyCode,
                              tableInputClass,
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
                            const layout = getColumnLayout(column.id)
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
                                  accountOptions,
                                  lineColumnCustomization,
                                  currencyCode,
                                  tableInputClass,
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
                    const layout = getColumnLayout(column.id)
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
                          <span className="font-semibold text-white">{fmtCurrency(total, currencyCode ?? undefined)}</span>
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
  visibleColumns: Array<{ id: TransactionLineColumnKey }>,
  columnId: TransactionLineColumnKey
) {
  let offset = 0
  for (const column of visibleColumns) {
    if (column.id === columnId) break
    if (BASE_COLUMN_LAYOUT[column.id].pinned) {
      offset += BASE_COLUMN_LAYOUT[column.id].width ?? 120
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
  accountOptions,
  lineColumnCustomization,
  currencyCode,
  tableInputClass,
}: {
  columnId: TransactionLineColumnKey
  row: PurchaseOrderLineItemRow
  rowIndex: number
  editing: boolean
  state: EditableRowState
  updateExistingRow: (row: PurchaseOrderLineItemRow, updates: Partial<EditableRowState>) => void
  itemOptions: ItemOption[]
  accountOptions: AccountOption[]
  lineColumnCustomization?: LineColumnSettings
  currencyCode?: string | null
  tableInputClass: string
}) {
  const itemEditDisplay = lineColumnCustomization?.['item-id']?.editDisplay ?? 'idAndLabel'
  const itemViewDisplay = lineColumnCustomization?.['item-id']?.viewDisplay ?? 'idAndLabel'
  const itemDropdownDisplay = lineColumnCustomization?.['item-id']?.dropdownDisplay ?? 'idAndLabel'
  const itemDropdownSort = lineColumnCustomization?.['item-id']?.dropdownSort ?? 'id'
  const accountEditDisplay = lineColumnCustomization?.['expense-account']?.editDisplay ?? 'idAndLabel'
  const accountViewDisplay = lineColumnCustomization?.['expense-account']?.viewDisplay ?? 'idAndLabel'
  const accountDropdownDisplay = lineColumnCustomization?.['expense-account']?.dropdownDisplay ?? 'idAndLabel'
  const accountDropdownSort = lineColumnCustomization?.['expense-account']?.dropdownSort ?? 'id'
  const fullItemValue = formatLookupValue(row.itemId, row.itemName, 'idAndLabel')
  const fullAccountValue = formatLookupValue(row.expenseAccountId, row.expenseAccountName, 'idAndLabel')
  const itemInputWidth = estimateEditableControlWidth({
    value: state.itemSearch,
    min: 260,
    max: 640,
    fallback: 'Select or search item',
  })
  const expenseAccountInputWidth = estimateEditableControlWidth({
    value: state.expenseAccountSearch,
    min: 180,
    max: 560,
    fallback: 'Select expense account',
  })
  const descriptionInputWidth = estimateEditableControlWidth({
    value: state.description,
    min: 240,
    max: 560,
    fallback: 'Description',
  })
  const notesInputWidth = estimateEditableControlWidth({
    value: state.notes,
    min: 180,
    max: 420,
    fallback: 'Notes',
  })
  switch (columnId) {
    case 'line':
      return rowIndex + 1
    case 'line-type':
      return editing ? (
        <div className="w-28">
          <SearchableSelect
            selectedValue={state.lineType}
            options={[
              { value: 'item', label: 'Item', searchText: 'item' },
              { value: 'expense', label: 'Expense', searchText: 'expense' },
            ]}
            placeholder="Select line type"
            searchPlaceholder="Search line type"
            dropdownWidthMode="trigger"
            textClassName={tableInputClass}
            onSelect={(value) => {
              const nextType = value === 'expense' ? 'expense' : 'item'
              updateExistingRow(row, nextType === 'expense'
                ? {
                    lineType: 'expense',
                    itemRecordId: null,
                    itemSearch: '',
                    error: '',
                  }
                : {
                    lineType: 'item',
                    expenseAccountRecordId: null,
                    expenseAccountSearch: '',
                    error: '',
                  })
            }}
          />
        </div>
      ) : (
        row.lineType === 'expense' ? 'Expense' : 'Item'
      )
    case 'item-id':
      if (state.lineType === 'expense') return null
      return editing ? (
        <ItemLookupInput
          value={state.itemSearch}
          widthPx={itemInputWidth}
          itemOptions={itemOptions}
          dropdownDisplay={itemDropdownDisplay}
          dropdownSort={itemDropdownSort}
          inputClassName={tableInputClass}
          onChange={(value) => {
            updateExistingRow(row, {
              itemRecordId: null,
              itemSearch: value,
              error: '',
            })
          }}
          onSelect={(item) => {
            updateExistingRow(row, {
              ...buildItemSelectionUpdates(item),
              itemSearch: formatLookupValue(item.itemId, item.name, itemEditDisplay),
            })
          }}
        />
      ) : (
        <span className="block whitespace-nowrap" title={fullItemValue || '-'}>
          {formatLookupValue(row.itemId, row.itemName, itemViewDisplay) || '-'}
        </span>
      )
    case 'expense-account':
      if (editing) {
        if (state.lineType !== 'expense') {
          return <span style={{ color: 'var(--text-muted)' }}>-</span>
        }
        return (
          <LookupInput
            value={state.expenseAccountSearch}
            widthPx={expenseAccountInputWidth}
            options={accountOptions.map((account) => ({
              id: account.id,
              value: account.accountNumber ?? account.accountId,
              label: account.name,
            }))}
            dropdownDisplay={accountDropdownDisplay}
            dropdownSort={accountDropdownSort}
            inputClassName={tableInputClass}
            placeholder="Select expense account"
            onChange={(value) => {
              updateExistingRow(row, {
                expenseAccountRecordId: null,
                expenseAccountSearch: value,
                error: '',
              })
            }}
            onSelect={(account) => {
              updateExistingRow(row, {
                ...buildExpenseAccountSelectionUpdates({
                  id: account.id,
                  accountId: account.value,
                  accountNumber: account.value,
                  name: account.label,
                }),
                expenseAccountSearch: formatLookupValue(account.value, account.label, accountEditDisplay),
              })
            }}
          />
        )
      }
      return (
        <span className="block whitespace-nowrap" title={fullAccountValue || '-'}>
          {row.lineType === 'expense' ? formatLookupValue(row.expenseAccountId, row.expenseAccountName, accountViewDisplay) || '-' : '-'}
        </span>
      )
    case 'description':
      return editing ? (
        <div className="inline-flex flex-col items-start space-y-1">
          <input
            value={state.description}
            onChange={(event) => updateExistingRow(row, { description: event.target.value, error: '' })}
            disabled={state.lineType === 'item' && state.itemRecordId != null}
            title={state.description}
            className={`rounded-md border bg-transparent px-2 py-1.5 text-white ${tableInputClass}`}
            style={{ borderColor: 'var(--border-muted)', width: `${descriptionInputWidth}px` }}
          />
          {state.error ? (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>
              {state.error}
            </p>
          ) : null}
        </div>
      ) : (
        <span className="block whitespace-nowrap" title={row.description} style={{ color: 'var(--text-secondary)' }}>{row.description}</span>
      )
    case 'notes':
      return editing ? (
        <input
          value={state.notes}
          onChange={(event) => updateExistingRow(row, { notes: event.target.value, error: '' })}
          title={state.notes}
          className={`rounded-md border bg-transparent px-2 py-1.5 text-white ${tableInputClass}`}
          style={{ borderColor: 'var(--border-muted)', width: `${notesInputWidth}px` }}
        />
      ) : (
        <span className="block whitespace-nowrap" title={row.notes ?? '-'} style={{ color: 'var(--text-secondary)' }}>{row.notes ?? '-'}</span>
      )
    case 'quantity':
      return editing ? (
        <input
          type="number"
          min="1"
          value={state.quantity}
          onChange={(event) => updateExistingRow(row, { quantity: event.target.value, error: '' })}
          className={`w-20 rounded-md border bg-transparent px-2 py-1.5 text-right text-white ${tableInputClass}`}
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
          className={`w-28 rounded-md border bg-transparent px-2 py-1.5 text-right text-white ${tableInputClass}`}
          style={{ borderColor: 'var(--border-muted)' }}
        />
      ) : (
        fmtCurrency(row.unitPrice, currencyCode ?? undefined)
      )
    case 'line-total':
      return <span className="font-semibold text-white">{fmtCurrency(row.lineTotal, currencyCode ?? undefined)}</span>
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
  accountOptions,
  lineColumnCustomization,
  currencyCode,
  tableInputClass,
}: {
  columnId: TransactionLineColumnKey
  lineNumber: number
  quantity: number
  lineTotal: number
  draftRow: DraftRowState
  updateDraftRow: (draftId: string, updates: Partial<DraftRowState>) => void
  itemOptions: ItemOption[]
  accountOptions: AccountOption[]
  lineColumnCustomization?: LineColumnSettings
  currencyCode?: string | null
  tableInputClass: string
}) {
  const itemEditDisplay = lineColumnCustomization?.['item-id']?.editDisplay ?? 'idAndLabel'
  const itemDropdownDisplay = lineColumnCustomization?.['item-id']?.dropdownDisplay ?? 'idAndLabel'
  const itemDropdownSort = lineColumnCustomization?.['item-id']?.dropdownSort ?? 'id'
  const accountEditDisplay = lineColumnCustomization?.['expense-account']?.editDisplay ?? 'idAndLabel'
  const accountDropdownDisplay = lineColumnCustomization?.['expense-account']?.dropdownDisplay ?? 'idAndLabel'
  const accountDropdownSort = lineColumnCustomization?.['expense-account']?.dropdownSort ?? 'id'
  const itemInputWidth = estimateEditableControlWidth({
    value: draftRow.itemSearch,
    min: 260,
    max: 640,
    fallback: 'Select or search item',
  })
  const expenseAccountInputWidth = estimateEditableControlWidth({
    value: draftRow.expenseAccountSearch,
    min: 180,
    max: 560,
    fallback: 'Select expense account',
  })
  const descriptionInputWidth = estimateEditableControlWidth({
    value: draftRow.description,
    min: 240,
    max: 560,
    fallback: 'Description',
  })
  const notesInputWidth = estimateEditableControlWidth({
    value: draftRow.notes,
    min: 180,
    max: 420,
    fallback: 'Notes',
  })
  switch (columnId) {
    case 'line':
      return lineNumber
    case 'line-type':
      return (
        <div className="w-28">
          <SearchableSelect
            selectedValue={draftRow.lineType}
            options={[
              { value: 'item', label: 'Item', searchText: 'item' },
              { value: 'expense', label: 'Expense', searchText: 'expense' },
            ]}
            placeholder="Select line type"
            searchPlaceholder="Search line type"
            dropdownWidthMode="trigger"
            textClassName={tableInputClass}
            onSelect={(value) => {
              const nextType = value === 'expense' ? 'expense' : 'item'
              updateDraftRow(
                draftRow.id,
                nextType === 'expense'
                  ? {
                      lineType: 'expense',
                      itemRecordId: null,
                      itemSearch: '',
                      error: '',
                    }
                  : {
                      lineType: 'item',
                      expenseAccountRecordId: null,
                      expenseAccountSearch: '',
                      error: '',
                    },
              )
            }}
          />
        </div>
      )
    case 'item-id':
      if (draftRow.lineType === 'expense') return null
      return (
        <ItemLookupInput
          value={draftRow.itemSearch}
          widthPx={itemInputWidth}
          itemOptions={itemOptions}
          dropdownDisplay={itemDropdownDisplay}
          dropdownSort={itemDropdownSort}
          inputClassName={tableInputClass}
          onChange={(value) => {
            updateDraftRow(draftRow.id, {
              itemRecordId: null,
              itemSearch: value,
              error: '',
            })
          }}
          onSelect={(item) => {
            updateDraftRow(draftRow.id, {
              ...buildItemSelectionUpdates(item),
              itemSearch: formatLookupValue(item.itemId, item.name, itemEditDisplay),
            })
          }}
        />
      )
    case 'expense-account':
      if (draftRow.lineType !== 'expense') {
        return <span style={{ color: 'var(--text-muted)' }}>-</span>
      }
      return (
        <LookupInput
          value={draftRow.expenseAccountSearch}
          widthPx={expenseAccountInputWidth}
          options={accountOptions.map((account) => ({
            id: account.id,
            value: account.accountNumber ?? account.accountId,
            label: account.name,
          }))}
          dropdownDisplay={accountDropdownDisplay}
          dropdownSort={accountDropdownSort}
          inputClassName={tableInputClass}
          placeholder="Select expense account"
          onChange={(value) => {
            updateDraftRow(draftRow.id, {
              expenseAccountRecordId: null,
              expenseAccountSearch: value,
              error: '',
            })
          }}
          onSelect={(account) => {
            updateDraftRow(draftRow.id, {
              ...buildExpenseAccountSelectionUpdates({
                id: account.id,
                accountId: account.value,
                accountNumber: account.value,
                name: account.label,
              }),
              expenseAccountSearch: formatLookupValue(account.value, account.label, accountEditDisplay),
            })
          }}
        />
      )
    case 'description':
      return (
        <input
          value={draftRow.description}
          onChange={(event) => updateDraftRow(draftRow.id, { description: event.target.value, error: '' })}
          disabled={draftRow.lineType === 'item' && draftRow.itemRecordId != null}
          placeholder="Description"
          title={draftRow.description}
          className={`rounded-md border bg-transparent px-2 py-1.5 text-white ${tableInputClass}`}
          style={{ borderColor: 'var(--border-muted)', width: `${descriptionInputWidth}px` }}
        />
      )
    case 'notes':
      return (
        <input
          value={draftRow.notes}
          onChange={(event) => updateDraftRow(draftRow.id, { notes: event.target.value, error: '' })}
          placeholder="Notes"
          title={draftRow.notes}
          className={`rounded-md border bg-transparent px-2 py-1.5 text-white ${tableInputClass}`}
          style={{ borderColor: 'var(--border-muted)', width: `${notesInputWidth}px` }}
        />
      )
    case 'quantity':
      return (
        <input
          type="number"
          min="1"
          value={draftRow.quantity}
          onChange={(event) => updateDraftRow(draftRow.id, { quantity: event.target.value, error: '' })}
          className={`w-20 rounded-md border bg-transparent px-2 py-1.5 text-right text-white ${tableInputClass}`}
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
          className={`w-28 rounded-md border bg-transparent px-2 py-1.5 text-right text-white ${tableInputClass}`}
          style={{ borderColor: 'var(--border-muted)' }}
        />
      )
    case 'line-total':
      return <span className="font-semibold text-white">{fmtCurrency(lineTotal, currencyCode ?? undefined)}</span>
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
      className={`px-4 py-3 ${getAlignClassName(align)}`}
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
      className={`px-4 py-3 ${getAlignClassName(align)}`}
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

type LookupOption = {
  id: string
  value: string
  label: string
}

function LookupInput({
  value,
  widthPx,
  options,
  dropdownDisplay,
  dropdownSort,
  inputClassName,
  placeholder,
  onChange,
  onSelect,
}: {
  value: string
  widthPx?: number
  options: LookupOption[]
  dropdownDisplay: LineDisplayMode
  dropdownSort: LineDropdownSortMode
  inputClassName: string
  placeholder: string
  onChange: (value: string) => void
  onSelect: (option: LookupOption) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [showAllOnOpen, setShowAllOnOpen] = useState(false)
  const [blurRequest, setBlurRequest] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const selectedOptionRef = useRef<HTMLButtonElement | null>(null)
  const [dropdownStyle, setDropdownStyle] = useState<{
    bottom: number
    left: number
    minWidth: number
    maxWidth: number
  } | null>(null)

  useEffect(() => {
    if (!open || !inputRef.current) return

    function updatePosition() {
      if (!inputRef.current) return
      const rect = inputRef.current.getBoundingClientRect()
      const maxWidth = window.innerWidth - 32
      setDropdownStyle({
        bottom: Math.max(window.innerHeight - rect.top + 4, 8),
        left: Math.max(16, rect.left),
        minWidth: rect.width + 120,
        maxWidth,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, query])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
        setShowAllOnOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const sorted = [...options]
      .sort((left, right) =>
        getLookupSortValue(left, dropdownSort).localeCompare(getLookupSortValue(right, dropdownSort), undefined, {
          sensitivity: 'base',
          numeric: true,
        })
      )
    if (showAllOnOpen && !normalizedQuery) return sorted
    if (!normalizedQuery) return sorted
    return sorted.filter((option) => `${option.value} ${option.label}`.toLowerCase().includes(normalizedQuery))
  }, [dropdownSort, options, query, showAllOnOpen])

  useEffect(() => {
    if (!open) return
    selectedOptionRef.current?.scrollIntoView({ block: 'nearest' })
  }, [open, query, value])

  useEffect(() => {
    if (blurRequest === 0) return
    if (!inputRef.current) return
    inputRef.current.blur()
    requestAnimationFrame(() => {
      if (inputRef.current) inputRef.current.scrollLeft = 0
    })
  }, [blurRequest])

  return (
    <div ref={containerRef} className="relative inline-block" style={widthPx ? { width: `${widthPx}px` } : undefined}>
      <div className="relative">
        <input
          ref={inputRef}
          value={open ? (showAllOnOpen && !query ? value : query) : value}
          onFocus={() => {
            setOpen(true)
            setQuery('')
            setShowAllOnOpen(true)
          }}
          onMouseDown={() => {
            if (open) return
            setOpen(true)
            setQuery('')
            setShowAllOnOpen(true)
          }}
          onClick={() => {
            if (open) return
            setOpen(true)
            setQuery('')
            setShowAllOnOpen(true)
          }}
          onChange={(event) => {
            const nextQuery = event.target.value
            setQuery(nextQuery)
            onChange(nextQuery)
            setOpen(true)
            setShowAllOnOpen(false)
          }}
          placeholder={placeholder}
          title={value || placeholder}
          className={`block rounded-md border bg-transparent px-2.5 py-1.5 pr-8 text-white ${inputClassName}`}
          style={{
            width: widthPx ? `${widthPx}px` : undefined,
            borderColor: 'var(--border-muted)',
            color: 'white',
            backgroundColor: 'var(--card-elevated)',
            colorScheme: 'dark',
            WebkitTextFillColor: 'white',
          }}
        />
        <button
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
            const nextOpen = !open
            setOpen(nextOpen)
            if (nextOpen) {
              setQuery('')
              setShowAllOnOpen(true)
              inputRef.current?.focus()
            } else {
              setShowAllOnOpen(false)
            }
          }}
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center rounded-r-md"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Toggle item options"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 7 5 5 5-5" />
          </svg>
        </button>
      </div>
      {open && filtered.length > 0 && dropdownStyle
        ? createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[200] max-h-60 overflow-y-auto rounded-md border shadow-2xl"
              style={{
                bottom: dropdownStyle.bottom,
                left: dropdownStyle.left,
                minWidth: dropdownStyle.minWidth,
                width: 'max-content',
                maxWidth: dropdownStyle.maxWidth,
                borderColor: 'var(--border-muted)',
                backgroundColor: 'var(--card-elevated)',
              }}
            >
              {filtered.map((option) => (
                <button
                  key={option.id}
                  ref={option.value === value ? selectedOptionRef : null}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onSelect(option)
                    setQuery(formatLookupValue(option.value, option.label, dropdownDisplay))
                    setOpen(false)
                    setShowAllOnOpen(false)
                    setBlurRequest((current) => current + 1)
                  }}
                  className={`block w-full whitespace-nowrap px-2.5 py-1.5 text-left hover:bg-white/5 ${inputClassName}`}
                  style={{
                    color: option.value === value ? 'white' : 'var(--text-secondary)',
                    backgroundColor: option.value === value ? 'rgba(59,130,246,0.18)' : 'transparent',
                  }}
                  title={formatLookupValue(option.value, option.label, 'idAndLabel')}
                >
                  <span className="block truncate whitespace-nowrap">
                    {formatLookupValue(option.value, option.label, dropdownDisplay)}
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

function ItemLookupInput({
  value,
  widthPx,
  itemOptions,
  dropdownDisplay,
  dropdownSort,
  inputClassName,
  onChange,
  onSelect,
}: {
  value: string
  widthPx?: number
  itemOptions: ItemOption[]
  dropdownDisplay: LineDisplayMode
  dropdownSort: LineDropdownSortMode
  inputClassName: string
  onChange: (value: string) => void
  onSelect: (item: ItemOption) => void
}) {
  return (
    <LookupInput
      value={value}
      widthPx={widthPx}
      options={itemOptions.map((item) => ({
        id: item.id,
        value: item.itemId,
        label: item.name,
      }))}
      dropdownDisplay={dropdownDisplay}
      dropdownSort={dropdownSort}
      inputClassName={inputClassName}
      placeholder="Select or search item"
      onChange={onChange}
      onSelect={(option) => {
        const selected = itemOptions.find((item) => item.id === option.id)
        if (selected) onSelect(selected)
      }}
    />
  )
}
