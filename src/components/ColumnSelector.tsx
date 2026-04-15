'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const fixedColumnIds = useMemo(() => new Set(columns.slice(0, 2).map((column) => column.id)), [columns])
  const lockedColumnIds = useMemo(
    () => new Set(columns.filter((column) => column.locked).map((column) => column.id).concat(Array.from(fixedColumnIds))),
    [columns, fixedColumnIds],
  )

  const storageKey = `column-selector:${tableId}`
  const orderStorageKey = `column-order:${tableId}`

  // Non-locked columns in current drag order
  const sortableColumns = useMemo(() => {
    const nonLocked = columns.filter((c) => !lockedColumnIds.has(c.id))
    if (columnOrder.length === 0) return nonLocked
    const colMap = new Map(nonLocked.map((c) => [c.id, c]))
    const ordered: ColumnOption[] = []
    for (const id of columnOrder) {
      const col = colMap.get(id)
      if (col) { ordered.push(col); colMap.delete(id) }
    }
    for (const col of nonLocked) {
      if (colMap.has(col.id)) ordered.push(col)
    }
    return ordered
  }, [columns, columnOrder, lockedColumnIds])

  function sanitizeHiddenColumns(rawValue: unknown): string[] {
    if (!Array.isArray(rawValue)) return []

    const next: string[] = []
    const seen = new Set<string>()
    for (const value of rawValue) {
      if (typeof value !== 'string') continue
      const id = value.trim()
      if (!id || lockedColumnIds.has(id) || seen.has(id)) continue
      seen.add(id)
      next.push(id)
    }

    return next
  }

  function loadOrder(raw: string | null): string[] {
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter((v: unknown): v is string => typeof v === 'string')
    } catch { /* ignore */ }
    return []
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        const next = sanitizeHiddenColumns(parsed)
        setHiddenColumns(next)
        const nextRaw = JSON.stringify(next)
        if (nextRaw !== raw) window.localStorage.setItem(storageKey, nextRaw)
      }
    } catch {
      // Ignore invalid saved preferences.
    }
    const order = loadOrder(window.localStorage.getItem(orderStorageKey))
    if (order.length > 0) setColumnOrder(order)
  }, [lockedColumnIds, storageKey, orderStorageKey, tableId])

  useEffect(() => {
    function syncFromStorage() {
      try {
        const raw = window.localStorage.getItem(storageKey)
        if (!raw) {
          setHiddenColumns([])
        } else {
          const parsed = JSON.parse(raw)
          const next = sanitizeHiddenColumns(parsed)
          setHiddenColumns(next)
          const nextRaw = JSON.stringify(next)
          if (nextRaw !== raw) window.localStorage.setItem(storageKey, nextRaw)
        }
      } catch {
        // Ignore invalid saved preferences.
      }
      const order = loadOrder(window.localStorage.getItem(orderStorageKey))
      setColumnOrder(order)
    }

    function handleCustomizationUpdate(event: Event) {
      const detail = (event as CustomEvent<{ tableId?: string }>).detail
      if (!detail || detail.tableId === tableId) {
        syncFromStorage()
      }
    }

    window.addEventListener('column-selector:updated', handleCustomizationUpdate as EventListener)
    window.addEventListener('storage', syncFromStorage)
    return () => {
      window.removeEventListener('column-selector:updated', handleCustomizationUpdate as EventListener)
      window.removeEventListener('storage', syncFromStorage)
    }
  }, [lockedColumnIds, storageKey, orderStorageKey, tableId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
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

  const updateDropdownPos = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const dropdownWidth = 288 // w-72 = 18rem = 288px
    const viewportWidth = window.innerWidth
    let left = rect.left
    if (left + dropdownWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - dropdownWidth - 8)
    }
    setDropdownPos({
      top: rect.bottom + 8,
      left,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updateDropdownPos()
    window.addEventListener('scroll', updateDropdownPos, true)
    window.addEventListener('resize', updateDropdownPos)
    return () => {
      window.removeEventListener('scroll', updateDropdownPos, true)
      window.removeEventListener('resize', updateDropdownPos)
    }
  }, [open, updateDropdownPos])

  // Reorder table DOM columns to match stored order
  useEffect(() => {
    const tableContainer = document.querySelector(`[data-column-selector-table="${tableId}"]`)
    if (!tableContainer) return

    // First 2 columns are pinned at start; other locked columns (e.g. Actions) pin at end
    const pinnedStartIds = columns.slice(0, 2).map((c) => c.id)
    const pinnedEndIds = columns.filter((c, i) => i >= 2 && lockedColumnIds.has(c.id)).map((c) => c.id)
    const nonLockedIds = columnOrder.length > 0
      ? columnOrder
      : columns.filter((c) => !lockedColumnIds.has(c.id)).map((c) => c.id)
    const fullOrder = [...pinnedStartIds, ...nonLockedIds, ...pinnedEndIds]

    let isReordering = false

    function reorderRow(row: Element) {
      const cells = Array.from(row.children) as HTMLElement[]
      if (cells.length <= 1) return
      if (cells[0]?.getAttribute('colspan')) return

      const cellsByCol = new Map<string, HTMLElement>()
      for (const cell of cells) {
        const colId = cell.getAttribute('data-column')
        if (colId) cellsByCol.set(colId, cell)
      }

      const fragment = document.createDocumentFragment()
      for (const colId of fullOrder) {
        const cell = cellsByCol.get(colId)
        if (cell) { fragment.appendChild(cell); cellsByCol.delete(colId) }
      }
      // Append any remaining cells not in the order
      for (const cell of cells) {
        const colId = cell.getAttribute('data-column')
        if (colId && cellsByCol.has(colId)) fragment.appendChild(cell)
      }
      row.appendChild(fragment)
    }

    function reorderAll() {
      if (isReordering) return
      isReordering = true
      tableContainer!.querySelectorAll('tr').forEach(reorderRow)
      setTimeout(() => { isReordering = false }, 0)
    }

    reorderAll()

    const observer = new MutationObserver(reorderAll)
    observer.observe(tableContainer, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [columnOrder, tableId, columns, lockedColumnIds])

  const visibleCount = columns.filter((column) => !lockedColumnIds.has(column.id) && !hiddenColumns.includes(column.id)).length

  const styleMarkup = useMemo(() => {
    if (hiddenColumns.length === 0) return ''

    return hiddenColumns
      .filter((columnId) => !lockedColumnIds.has(columnId))
      .map(
        (columnId) =>
          `[data-column-selector-table="${tableId}"] [data-column="${columnId}"] { display: none; }`,
      )
      .join('\n')
  }, [hiddenColumns, lockedColumnIds, tableId])

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
    window.localStorage.removeItem(orderStorageKey)
    setHiddenColumns([])
    setColumnOrder([])
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const ids = sortableColumns.map((c) => c.id)
    const [moved] = ids.splice(dragIndex, 1)
    ids.splice(index, 0, moved)
    setColumnOrder(ids)
    window.localStorage.setItem(orderStorageKey, JSON.stringify(ids))
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="relative" ref={containerRef}>
      {styleMarkup ? <style>{styleMarkup}</style> : null}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-md border px-3 py-2 text-sm font-medium"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
      >
        Columns ({visibleCount})
      </button>

      {open && dropdownPos
        ? createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-50 w-72 rounded-xl border p-4 shadow-2xl max-h-96 overflow-y-auto"
              style={{
                top: dropdownPos.top,
                left: dropdownPos.left,
                backgroundColor: 'var(--card-elevated)',
                borderColor: 'var(--border-muted)',
              }}
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
            {sortableColumns.map((column, index) => {
              const checked = !hiddenColumns.includes(column.id)
              const isDragging = dragIndex === index
              const isDragOver = dragOverIndex === index && dragIndex !== index
              return (
                <div
                  key={column.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 transition-colors"
                  style={{
                    borderColor: isDragOver ? 'var(--accent-primary-strong)' : 'var(--border-muted)',
                    opacity: isDragging ? 0.5 : 1,
                    cursor: 'grab',
                  }}
                >
                  <span className="text-xs select-none" style={{ color: 'var(--text-muted)' }} aria-hidden>⠿</span>
                  <label className="flex flex-1 items-center justify-between cursor-pointer">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {column.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleColumn(column)}
                      className="h-4 w-4"
                    />
                  </label>
                </div>
              )
            })}
          </div>
        </div>,
        document.body,
      )
      : null}
    </div>
  )
}
