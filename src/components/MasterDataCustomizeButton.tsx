'use client'

import { useEffect, useMemo, useState } from 'react'
import CreateModalButton from '@/components/CreateModalButton'

type CustomizeColumn = {
  id: string
  label: string
  locked?: boolean
}

export default function MasterDataCustomizeButton({
  tableId,
  columns,
  title,
}: {
  tableId: string
  columns: CustomizeColumn[]
  title: string
}) {
  return (
    <CreateModalButton
      buttonLabel="Customize"
      title={`Customize ${title}`}
      buttonClassName="!text-sm"
      buttonStyle={{ backgroundColor: 'transparent', border: '1px solid var(--border-muted)' }}
      modalWidthClassName="max-w-6xl"
    >
      <MasterDataCustomizeForm tableId={tableId} columns={columns} title={title} />
    </CreateModalButton>
  )
}

function MasterDataCustomizeForm({
  tableId,
  columns,
  title,
  onSuccess,
  onCancel,
}: {
  tableId: string
  columns: CustomizeColumn[]
  title: string
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const storageKey = useMemo(() => `column-selector:${tableId}`, [tableId])
  const fixedColumnIds = useMemo(() => new Set(columns.slice(0, 2).map((column) => column.id)), [columns])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      setHiddenColumns(
        parsed.filter((value): value is string => typeof value === 'string' && !fixedColumnIds.has(value)),
      )
    } catch {
      // Ignore malformed local preferences.
    }
  }, [fixedColumnIds, storageKey])

  function toggleColumn(column: CustomizeColumn) {
    const locked = column.locked || fixedColumnIds.has(column.id)
    if (locked) return

    if (hiddenColumns.includes(column.id)) {
      setHiddenColumns(hiddenColumns.filter((id) => id !== column.id))
      return
    }

    setHiddenColumns([...hiddenColumns, column.id])
  }

  function saveCustomization() {
    const sanitized = hiddenColumns.filter((columnId) => !fixedColumnIds.has(columnId))
    window.localStorage.setItem(storageKey, JSON.stringify(sanitized))
    window.dispatchEvent(new CustomEvent('column-selector:updated', { detail: { tableId } }))
    onSuccess?.()
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
        <h3 className="text-sm font-semibold text-white">{title} field customization</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Choose which columns are visible by default on this page.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Field Name</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Field Type</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Field Id</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Show</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Required</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Sourcing (List Fields)</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Default Value</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Column Order</th>
                <th className="px-2 py-2 text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Drag</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((column, index) => {
                const checked = !hiddenColumns.includes(column.id)
                const locked = column.locked === true || fixedColumnIds.has(column.id)
                const dragLocked = index < 2

                return (
                  <tr key={column.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{column.label}</td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Column</td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{column.id}</td>
                    <td className="px-2 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={() => toggleColumn(column)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{locked ? 'Yes' : 'No'}</td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>-</td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>-</td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{index + 1}</td>
                    <td className="px-2 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {dragLocked ? (
                        '-'
                      ) : (
                        <button
                          type="button"
                          className="inline-flex h-6 w-7 items-center justify-center rounded border"
                          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}
                          disabled
                          aria-label="Drag handle"
                        >
                          {'\u2630'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={saveCustomization}
          className="rounded-md px-3 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          Save customization
        </button>
      </div>
    </div>
  )
}
