'use client'

import { useEffect, useMemo, useState } from 'react'
import { RecordDetailCell, RecordDetailEmptyState, RecordDetailHeaderCell, RecordDetailSection } from '@/components/RecordDetailPanels'

export type FulfillmentLineOption = {
  id: string
  lineNumber: number
  itemId: string | null
  itemName: string | null
  description: string
  orderedQuantity: number
  alreadyFulfilledQuantity: number
  openQuantity: number
}

export type FulfillmentLineRow = {
  id: string
  salesOrderLineItemId: string | null
  lineNumber: number
  itemId: string | null
  itemName: string | null
  description: string
  orderedQuantity: number
  alreadyFulfilledQuantity: number
  openQuantity: number
  fulfillmentQuantity: number
  notes: string
}

export default function FulfillmentLineItemsSection({
  rows,
  editing,
  lineOptions,
  onChange,
  title = 'Fulfillment Lines',
  remoteConfig,
  visibleColumnIds,
  allowAddLines = editing,
}: {
  rows: FulfillmentLineRow[]
  editing?: boolean
  lineOptions: FulfillmentLineOption[]
  onChange?: (rows: FulfillmentLineRow[]) => void
  title?: string
  remoteConfig?: {
    fulfillmentId: string
    userId?: string | null
    apiBasePath?: string
  }
  visibleColumnIds?: Array<'line' | 'item-id' | 'description' | 'ordered-qty' | 'fulfilled-qty' | 'open-qty' | 'notes'>
  allowAddLines?: boolean
}) {
  const [localRows, setLocalRows] = useState<FulfillmentLineRow[]>(rows)
  const [savingRowId, setSavingRowId] = useState<string | null>(null)
  const apiBasePath = remoteConfig?.apiBasePath ?? '/api/fulfillment-lines'

  useEffect(() => {
    setLocalRows(rows)
  }, [rows])

  useEffect(() => {
    onChange?.(localRows)
  }, [localRows, onChange])

  const availableOptions = useMemo(() => {
    const selectedIds = new Set(localRows.map((row) => row.salesOrderLineItemId).filter(Boolean))
    return lineOptions.filter((option) => !selectedIds.has(option.id))
  }, [lineOptions, localRows])

  function toRow(option: FulfillmentLineOption): FulfillmentLineRow {
    return {
      id: `draft-${option.id}`,
      salesOrderLineItemId: option.id,
      lineNumber: option.lineNumber,
      itemId: option.itemId,
      itemName: option.itemName,
      description: option.description,
      orderedQuantity: option.orderedQuantity,
      alreadyFulfilledQuantity: option.alreadyFulfilledQuantity,
      openQuantity: option.openQuantity,
      fulfillmentQuantity: 0,
      notes: '',
    }
  }

  function addLine() {
    const next = availableOptions[0]
    if (!next) return
    if (!remoteConfig) {
      setLocalRows((prev) => [...prev, toRow(next)])
      return
    }

    void (async () => {
      setSavingRowId(`draft-${next.id}`)
      try {
        const response = await fetch(apiBasePath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fulfillmentId: remoteConfig.fulfillmentId,
            salesOrderLineItemId: next.id,
            quantity: Math.min(1, next.openQuantity),
            notes: '',
            userId: remoteConfig.userId ?? null,
          }),
        })
        if (!response.ok) return
        const created = (await response.json()) as { id: string }
        setLocalRows((prev) => [
          ...prev,
          {
            ...toRow(next),
            id: created.id,
            fulfillmentQuantity: Math.min(1, next.openQuantity),
          },
        ])
      } finally {
        setSavingRowId(null)
      }
    })()
  }

  function removeLine(id: string) {
    if (!remoteConfig || id.startsWith('draft-')) {
      setLocalRows((prev) => prev.filter((row) => row.id !== id))
      return
    }

    void (async () => {
      setSavingRowId(id)
      try {
        const response = await fetch(`${apiBasePath}?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        })
        if (!response.ok) return
        setLocalRows((prev) => prev.filter((row) => row.id !== id))
      } finally {
        setSavingRowId(null)
      }
    })()
  }

  function updateRow(id: string, patch: Partial<FulfillmentLineRow>) {
    setLocalRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row
        const next = { ...row, ...patch }
        if (patch.fulfillmentQuantity !== undefined) {
          const parsed = Number(patch.fulfillmentQuantity)
          next.fulfillmentQuantity = Number.isFinite(parsed) ? Math.max(0, Math.min(row.openQuantity, Math.trunc(parsed))) : 0
        }
        return next
      }),
    )
  }

  function swapLineOption(id: string, salesOrderLineItemId: string) {
    const option = lineOptions.find((candidate) => candidate.id === salesOrderLineItemId)
    if (!option) return
    setLocalRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              salesOrderLineItemId: option.id,
              lineNumber: option.lineNumber,
              itemId: option.itemId,
              itemName: option.itemName,
              description: option.description,
              orderedQuantity: option.orderedQuantity,
              alreadyFulfilledQuantity: option.alreadyFulfilledQuantity,
              openQuantity: option.openQuantity,
              fulfillmentQuantity: Math.min(row.fulfillmentQuantity, option.openQuantity),
            }
          : row,
      ),
    )
    if (remoteConfig && !id.startsWith('draft-')) {
      void persistRow(id, {
        salesOrderLineItemId: option.id,
      })
    }
  }

  async function persistRow(
    id: string,
    patch: Partial<{
      salesOrderLineItemId: string | null
      fulfillmentQuantity: number
      notes: string
    }>,
  ) {
    if (!remoteConfig || id.startsWith('draft-')) return
    const row = localRows.find((candidate) => candidate.id === id)
    if (!row) return
    setSavingRowId(id)
    try {
      await fetch(`${apiBasePath}?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesOrderLineItemId: patch.salesOrderLineItemId ?? row.salesOrderLineItemId,
          quantity: patch.fulfillmentQuantity ?? row.fulfillmentQuantity,
          notes: patch.notes ?? row.notes,
          userId: remoteConfig.userId ?? null,
        }),
      })
    } finally {
      setSavingRowId(null)
    }
  }

  const totalQuantity = localRows.reduce((sum, row) => sum + row.fulfillmentQuantity, 0)
  const columns =
    visibleColumnIds ?? ['line', 'item-id', 'description', 'ordered-qty', 'open-qty', 'fulfilled-qty', 'notes']

  return (
    <RecordDetailSection
      title={title}
      count={localRows.length}
      summary={editing ? `Fulfilled Qty ${totalQuantity}` : undefined}
      actions={
        editing ? (
          <button
            type="button"
            onClick={addLine}
            disabled={!allowAddLines || availableOptions.length === 0}
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Add Line
          </button>
        ) : null
      }
    >
      {localRows.length === 0 ? (
        <RecordDetailEmptyState message={editing ? 'Add one or more sales order lines to fulfill.' : 'No fulfillment lines yet.'} />
      ) : (
        <table className="min-w-full">
          <thead>
            <tr>
              {columns.includes('line') ? <RecordDetailHeaderCell>Line</RecordDetailHeaderCell> : null}
              {columns.includes('item-id') ? <RecordDetailHeaderCell>Item Id</RecordDetailHeaderCell> : null}
              {columns.includes('description') ? <RecordDetailHeaderCell>Description</RecordDetailHeaderCell> : null}
              {columns.includes('ordered-qty') ? <RecordDetailHeaderCell>Ordered Qty</RecordDetailHeaderCell> : null}
              {columns.includes('open-qty') ? <RecordDetailHeaderCell>Open Qty</RecordDetailHeaderCell> : null}
              {columns.includes('fulfilled-qty') ? <RecordDetailHeaderCell>Fulfilled Qty</RecordDetailHeaderCell> : null}
              {columns.includes('notes') ? <RecordDetailHeaderCell>Notes</RecordDetailHeaderCell> : null}
              {editing ? <RecordDetailHeaderCell>Actions</RecordDetailHeaderCell> : null}
            </tr>
          </thead>
          <tbody>
            {localRows.map((row, index) => (
              <tr
                key={row.id}
                style={index < localRows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
              >
                {columns.includes('line') ? <RecordDetailCell>
                  {editing ? (
                    <select
                      value={row.salesOrderLineItemId ?? ''}
                      onChange={(event) => swapLineOption(row.id, event.target.value)}
                      className="w-full rounded-md border bg-transparent px-2 py-2 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    >
                      <option value="" style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                        Select line
                      </option>
                      {[...lineOptions]
                        .filter((option) => option.id === row.salesOrderLineItemId || availableOptions.some((available) => available.id === option.id))
                        .map((option) => (
                          <option key={option.id} value={option.id} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                            {`Line ${option.lineNumber}`}
                          </option>
                        ))}
                    </select>
                  ) : (
                    row.lineNumber
                  )}
                </RecordDetailCell> : null}
                {columns.includes('item-id') ? <RecordDetailCell>{row.itemId ?? '-'}</RecordDetailCell> : null}
                {columns.includes('description') ? <RecordDetailCell>{row.description || '-'}</RecordDetailCell> : null}
                {columns.includes('ordered-qty') ? <RecordDetailCell>{row.orderedQuantity}</RecordDetailCell> : null}
                {columns.includes('open-qty') ? <RecordDetailCell>{row.openQuantity}</RecordDetailCell> : null}
                {columns.includes('fulfilled-qty') ? <RecordDetailCell>
                  {editing ? (
                    <input
                      type="number"
                      min={0}
                      max={row.openQuantity}
                      value={row.fulfillmentQuantity}
                      onChange={(event) => updateRow(row.id, { fulfillmentQuantity: Number(event.target.value) })}
                      onBlur={() => {
                        void persistRow(row.id, { fulfillmentQuantity: row.fulfillmentQuantity })
                      }}
                      className="w-24 rounded-md border bg-transparent px-2 py-2 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  ) : (
                    row.fulfillmentQuantity
                  )}
                </RecordDetailCell> : null}
                {columns.includes('notes') ? <RecordDetailCell>
                  {editing ? (
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(event) => updateRow(row.id, { notes: event.target.value })}
                      onBlur={() => {
                        void persistRow(row.id, { notes: row.notes })
                      }}
                      className="w-full rounded-md border bg-transparent px-2 py-2 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  ) : (
                    row.notes || '-'
                  )}
                </RecordDetailCell> : null}
                {editing ? (
                  <RecordDetailCell>
                    <button
                      type="button"
                      onClick={() => removeLine(row.id)}
                      disabled={savingRowId === row.id}
                      className="rounded-md border px-2 py-1 text-xs"
                      style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                    >
                      {savingRowId === row.id ? 'Saving...' : 'Remove'}
                    </button>
                  </RecordDetailCell>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </RecordDetailSection>
  )
}
