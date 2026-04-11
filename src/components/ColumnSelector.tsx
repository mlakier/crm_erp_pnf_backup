'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type ColumnOption = {
  id: string
  label: string
  defaultVisible?: boolean
  locked?: boolean
}

export default function ColumnSelector({
  tableId,
  columns,
}: {
  tableId: string
  columns: ColumnOption[]
}) {
  const [open, setOpen] = useState(false)
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)

  const storageKey = `column-selector:${tableId}`

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      setHiddenColumns(parsed.filter((value): value is string => typeof value === 'string'))
    } catch {
      // Ignore invalid saved preferences.
    }
  }, [storageKey])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const visibleCount = columns.filter((column) => !hiddenColumns.includes(column.id)).length

  const styleMarkup = useMemo(() => {
    if (hiddenColumns.length === 0) return ''

    return hiddenColumns
      .map(
        (columnId) =>
          `[data-column-selector-table="${tableId}"] [data-column="${columnId}"] { display: none; }`,
      )
      .join('\n')
  }, [hiddenColumns, tableId])

  function toggleColumn(column: ColumnOption) {
    if (column.locked) return

    setHiddenColumns((current) => {
      const next = current.includes(column.id)
        ? current.filter((id) => id !== column.id)
        : [...current, column.id]

      window.localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  function resetColumns() {
    window.localStorage.removeItem(storageKey)
    setHiddenColumns([])
  }

  return (
    <div className="relative" ref={containerRef}>
      {styleMarkup ? <style>{styleMarkup}</style> : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-md border px-3 py-2 text-sm font-medium"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
      >
        Columns ({visibleCount})
      </button>

      {open ? (
        <div
          className="absolute right-0 z-20 mt-2 w-72 rounded-xl border p-4 shadow-xl"
          style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Visible Columns</p>
            <button
              type="button"
              onClick={resetColumns}
              className="text-xs font-medium"
              style={{ color: 'var(--accent-primary-strong)' }}
            >
              Reset
            </button>
          </div>

          <div className="space-y-2">
            {columns.map((column) => {
              const checked = !hiddenColumns.includes(column.id)
              return (
                <label
                  key={column.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                  style={{ borderColor: 'var(--border-muted)' }}
                >
                  <span className="text-sm" style={{ color: column.locked ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                    {column.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={column.locked}
                    onChange={() => toggleColumn(column)}
                    className="h-4 w-4"
                  />
                </label>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
