'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { DetailTableDisplayControl, DetailTablePaginationFooter } from '@/components/DetailTablePaging'
import type { ManagedListRow } from '@/lib/manage-lists'

type DisplayOrder = 'list' | 'alpha'

export default function ManageListDetailClient({
  listKey,
  initialLabel,
  initialWhereUsed,
  initialDisplayOrder,
  initialRows,
  systemManaged,
  editing,
}: {
  listKey: string
  initialLabel: string
  initialWhereUsed: string[]
  initialDisplayOrder: DisplayOrder
  initialRows: ManagedListRow[]
  systemManaged: boolean
  editing: boolean
}) {
  const router = useRouter()
  const [label, setLabel] = useState(initialLabel)
  const [whereUsedText, setWhereUsedText] = useState(initialWhereUsed.join(', '))
  const [displayOrder, setDisplayOrder] = useState<DisplayOrder>(initialDisplayOrder)
  const [rows, setRows] = useState<ManagedListRow[]>(initialRows)
  const [newValue, setNewValue] = useState('')
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [dragRowKey, setDragRowKey] = useState<string | null>(null)
  const [dragOverRowKey, setDragOverRowKey] = useState<string | null>(null)
  const [valueQuery, setValueQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const displayRows = useMemo(
    () => displayOrder === 'alpha'
      ? [...rows].sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: 'base' }))
      : rows,
    [displayOrder, rows],
  )
  const normalizedValueQuery = valueQuery.trim().toLowerCase()
  const filteredRows = useMemo(() => {
    if (!normalizedValueQuery) return displayRows
    return displayRows.filter((row) => `${row.id} ${row.value}`.toLowerCase().includes(normalizedValueQuery))
  }, [displayRows, normalizedValueQuery])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredRows, pageSize],
  )

  useEffect(() => {
    setPage(1)
  }, [normalizedValueQuery, pageSize, displayOrder])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  function readRowsForList(body: unknown) {
    if (!body || typeof body !== 'object') return null

    const rowsByKey = (body as { rowsByKey?: unknown }).rowsByKey
    if (!rowsByKey || typeof rowsByKey !== 'object') return null

    const normalizedKey = listKey.trim().toUpperCase()
    const nextRows = (rowsByKey as Record<string, unknown>)[listKey]
      ?? (rowsByKey as Record<string, unknown>)[normalizedKey]

    return Array.isArray(nextRows) ? nextRows as ManagedListRow[] : null
  }

  async function save(nextRows = rows, message = 'List saved') {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/config/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-list',
          key: listKey,
          label,
          whereUsed: whereUsedText.split(',').map((entry) => entry.trim()).filter(Boolean),
          displayOrder,
          rows: nextRows.map((row, index) => ({ id: row.id, value: row.value, sortOrder: index })),
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body?.error ?? 'Unable to save list')
        return false
      }

      const nextRowsByKey = readRowsForList(body)
      if (nextRowsByKey) setRows(nextRowsByKey)
      setSuccess(message)
      router.refresh()
      return true
    } catch {
      setError('Unable to save list')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function addValue() {
    const value = newValue.trim()
    if (!value) {
      setError('Value cannot be empty')
      return
    }

    if (rows.some((row) => row.value.localeCompare(value, undefined, { sensitivity: 'base' }) === 0)) {
      setError('Duplicate value')
      return
    }

    const previousRows = rows
    const nextRows = [...rows, { id: '', value, sortOrder: rows.length }]
    setRows(nextRows)
    const ok = await save(nextRows, 'Value added')
    if (ok) {
      setNewValue('')
    } else {
      setRows(previousRows)
    }
  }

  function rowKey(row: ManagedListRow) {
    return row.id || `${row.sortOrder}:${row.value}`
  }

  async function saveRow(targetRow: ManagedListRow) {
    const value = editDraft.trim()
    if (!value) {
      setError('Value cannot be empty')
      return
    }

    if (rows.some((row) => row !== targetRow && row.value.localeCompare(value, undefined, { sensitivity: 'base' }) === 0)) {
      setError('Duplicate value')
      return
    }

    const previousRows = rows
    const nextRows = rows.map((row) => row === targetRow ? { ...row, value } : row)
    setRows(nextRows)
    const ok = await save(nextRows, 'Value saved')
    if (ok) {
      setEditingRowKey(null)
      setEditDraft('')
    } else {
      setRows(previousRows)
    }
  }

  async function removeValue(targetRow: ManagedListRow) {
    const previousRows = rows
    const nextRows = rows.filter((row) => row !== targetRow).map((row, rowIndex) => ({ ...row, sortOrder: rowIndex }))
    setRows(nextRows)
    const ok = await save(nextRows, 'Value removed')
    if (!ok) setRows(previousRows)
  }

  async function handleDrop(targetRow: ManagedListRow) {
    const sourceIndex = rows.findIndex((row) => rowKey(row) === dragRowKey)
    const targetIndex = rows.findIndex((row) => row === targetRow)
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
      setDragRowKey(null)
      setDragOverRowKey(null)
      return
    }

    const updated = [...rows]
    const [moved] = updated.splice(sourceIndex, 1)
    updated.splice(targetIndex, 0, moved)
    const reordered = updated.map((row, index) => ({ ...row, sortOrder: index }))
    const previousRows = rows
    setRows(reordered)
    setDragRowKey(null)
    setDragOverRowKey(null)
    const ok = await save(reordered, 'Order updated')
    if (!ok) setRows(previousRows)
  }

  if (!editing) {
    return (
      <div className="space-y-6">
        <section className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>List Details</h2>
          <dl className="mt-4 grid gap-3 md:grid-cols-2">
            <Detail label="List Key" value={listKey} />
            <Detail label="Name" value={label} />
            <Detail label="Where Used" value={initialWhereUsed.join(', ') || '-'} />
            <Detail label="Display Order" value={displayOrder === 'alpha' ? 'Alphabetical' : 'List Order'} />
            <Detail label="Type" value={systemManaged ? 'Standard' : 'Custom'} />
            <Detail label="Values" value={String(rows.length)} />
          </dl>
        </section>

        <ValuesTable
          rows={pagedRows}
          total={filteredRows.length}
          page={currentPage}
          pageSize={pageSize}
          query={valueQuery}
          onQueryChange={setValueQuery}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Edit List</h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/lists/${encodeURIComponent(listKey)}`}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={() => save(rows)}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>List Key</span>
            <input value={listKey} readOnly className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }} />
          </label>
          <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>Name</span>
            <input value={label} disabled={systemManaged} onChange={(event) => setLabel(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white disabled:opacity-60" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
          <label className="space-y-1 text-sm md:col-span-2" style={{ color: 'var(--text-secondary)' }}>
            <span>Where Used</span>
            <input value={whereUsedText} disabled={systemManaged} onChange={(event) => setWhereUsedText(event.target.value)} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white disabled:opacity-60" style={{ borderColor: 'var(--border-muted)' }} />
          </label>
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-medium">Display Order:</span>
            <button type="button" onClick={() => setDisplayOrder('alpha')} className="rounded-full px-3 py-1 text-xs font-medium" style={displayOrder === 'alpha' ? activePillStyle : inactivePillStyle}>Alphabetical</button>
            <button type="button" onClick={() => setDisplayOrder('list')} className="rounded-full px-3 py-1 text-xs font-medium" style={displayOrder === 'list' ? activePillStyle : inactivePillStyle}>List Order</button>
          </div>
        </div>

        {systemManaged ? (
          <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            Standard list names and usage are controlled by field metadata. Values and ordering can still be maintained here.
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-emerald-300">{success}</p> : null}
      </section>

      <section className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <ValuesToolbar
          query={valueQuery}
          total={filteredRows.length}
          pageSize={pageSize}
          onQueryChange={setValueQuery}
          onPageSizeChange={setPageSize}
        />
        <div className="mb-4 grid grid-cols-[160px_1fr_auto] items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Add Value</span>
          <input
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addValue()
              }
            }}
            placeholder="Type value and click Add"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
          <button type="button" onClick={addValue} disabled={saving} className="rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>
            Add
          </button>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[24px_220px_1fr_auto] gap-2 px-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            <span />
            <span>List ID</span>
            <span>Value</span>
            <span className="text-right">Actions</span>
          </div>
          {pagedRows.map((row) => {
            const key = rowKey(row)
            const canDrag = displayOrder === 'list' && !normalizedValueQuery
            const isDragOver = dragOverRowKey === key && dragRowKey !== key
            const isEditingRow = editingRowKey === key
            return (
              <div
                key={key}
                onDragOver={(event) => { if (canDrag) { event.preventDefault(); setDragOverRowKey(key) } }}
                onDrop={() => canDrag ? handleDrop(row) : undefined}
                onDragEnd={() => { setDragRowKey(null); setDragOverRowKey(null) }}
                className="grid grid-cols-[24px_220px_1fr_auto] gap-2 rounded-md transition-colors"
                style={{ borderTop: isDragOver ? '2px solid var(--accent-primary-strong)' : '2px solid transparent' }}
              >
                <span
                  draggable={canDrag}
                  onDragStart={() => setDragRowKey(key)}
                  className="flex items-center justify-center text-xs select-none"
                  style={{ color: canDrag ? 'var(--text-muted)' : 'transparent', cursor: canDrag ? 'grab' : 'default' }}
                  aria-hidden
                >
                  :
                </span>
                <input value={row.id || 'Auto-generated on save'} readOnly className="w-full rounded-md border bg-transparent px-3 py-2 text-xs" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }} />
                <input
                  value={isEditingRow ? editDraft : row.value}
                  disabled={!isEditingRow}
                  onChange={(event) => setEditDraft(event.target.value)}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white disabled:opacity-80"
                  style={{ borderColor: 'var(--border-muted)' }}
                />
                <div className="flex items-center gap-2">
                  {isEditingRow ? (
                    <>
                      <button type="button" onClick={() => saveRow(row)} disabled={saving} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">Save</button>
                      <button type="button" onClick={() => { setEditingRowKey(null); setEditDraft('') }} className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--border-muted)' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setEditingRowKey(key); setEditDraft(row.value) }} className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>Edit</button>
                      <button type="button" onClick={() => removeValue(row)} disabled={saving} className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">Remove</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <DetailTablePaginationFooter total={filteredRows.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} />
      </section>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{value || '-'}</dd>
    </div>
  )
}

function ValuesToolbar({
  query,
  total,
  pageSize,
  onQueryChange,
  onPageSizeChange,
}: {
  query: string
  total: number
  pageSize: number
  onQueryChange: (value: string) => void
  onPageSizeChange: (value: number) => void
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search all list values"
          className="min-w-64 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{total} values</span>
      </div>
      <DetailTableDisplayControl value={pageSize} onChange={onPageSizeChange} />
    </div>
  )
}

function ValuesTable({
  rows,
  total,
  page,
  pageSize,
  query,
  onQueryChange,
  onPageChange,
  onPageSizeChange,
}: {
  rows: ManagedListRow[]
  total: number
  page: number
  pageSize: number
  query: string
  onQueryChange: (value: string) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (value: number) => void
}) {
  return (
    <section className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Values</h2>
      <div className="mt-4">
        <ValuesToolbar query={query} total={total} pageSize={pageSize} onQueryChange={onQueryChange} onPageSizeChange={onPageSizeChange} />
      </div>
      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No values yet.</p>
        ) : rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[220px_1fr] gap-3 rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{row.id}</span>
            <span className="text-white">{row.value}</span>
          </div>
        ))}
      </div>
      <DetailTablePaginationFooter total={total} page={page} pageSize={pageSize} onPageChange={onPageChange} />
    </section>
  )
}

const activePillStyle = { backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }
const inactivePillStyle = { backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-muted)' }
