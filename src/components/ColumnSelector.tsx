'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ColumnOption = {
  id: string
  label: string
  defaultVisible?: boolean
  locked?: boolean
}

type SavedColumnView = {
  id: string
  name: string
  columnIds: string[]
  columnOrder: string[]
  isDefault: boolean
}

const BUILT_IN_VIEW_ID = '__built-in-default'
const CUSTOM_VIEW_ID = '__custom'

function loadOrder(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((value: unknown): value is string => typeof value === 'string')
  } catch {
    // Ignore invalid saved preferences.
  }
  return []
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
  const [savedViews, setSavedViews] = useState<SavedColumnView[]>([])
  const [selectedViewId, setSelectedViewId] = useState(BUILT_IN_VIEW_ID)
  const [viewName, setViewName] = useState('')
  const [viewStatus, setViewStatus] = useState<string | null>(null)
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
  const validColumnIds = useMemo(() => new Set(columns.map((column) => column.id)), [columns])
  const explicitDefaultColumns = useMemo(() => columns.filter((column) => column.defaultVisible !== undefined), [columns])
  const defaultHiddenColumns = useMemo(() => {
    if (explicitDefaultColumns.length === 0) return []

    return columns
      .filter((column) => !lockedColumnIds.has(column.id) && column.defaultVisible === false)
      .map((column) => column.id)
  }, [columns, explicitDefaultColumns.length, lockedColumnIds])

  const storageKey = `column-selector:${tableId}`
  const orderStorageKey = `column-order:${tableId}`

  const sanitizeHiddenColumns = useCallback((rawValue: unknown): string[] => {
    if (!Array.isArray(rawValue)) return []

    const next: string[] = []
    const seen = new Set<string>()
    for (const value of rawValue) {
      if (typeof value !== 'string') continue
      const id = value.trim()
      if (!id || !validColumnIds.has(id) || lockedColumnIds.has(id) || seen.has(id)) continue
      seen.add(id)
      next.push(id)
    }

    return next
  }, [lockedColumnIds, validColumnIds])

  const sanitizeOrder = useCallback((rawValue: unknown): string[] => {
    if (!Array.isArray(rawValue)) return []

    const next: string[] = []
    const seen = new Set<string>()
    for (const value of rawValue) {
      if (typeof value !== 'string') continue
      const id = value.trim()
      if (!id || !validColumnIds.has(id) || lockedColumnIds.has(id) || seen.has(id)) continue
      seen.add(id)
      next.push(id)
    }

    return next
  }, [lockedColumnIds, validColumnIds])

  const persistColumnState = useCallback((nextHiddenColumns: string[], nextColumnOrder: string[]) => {
    setHiddenColumns(nextHiddenColumns)
    setColumnOrder(nextColumnOrder)
    window.localStorage.setItem(storageKey, JSON.stringify(nextHiddenColumns))
    window.localStorage.setItem(orderStorageKey, JSON.stringify(nextColumnOrder))
  }, [orderStorageKey, storageKey])

  const applyBuiltInDefault = useCallback((persist = true) => {
    setSelectedViewId(BUILT_IN_VIEW_ID)
    setViewName('')
    if (persist) {
      persistColumnState(defaultHiddenColumns, [])
    } else {
      setHiddenColumns(defaultHiddenColumns)
      setColumnOrder([])
    }
  }, [defaultHiddenColumns, persistColumnState])

  const applyView = useCallback((view: SavedColumnView, persist = true) => {
    const visibleIds = new Set(view.columnIds.filter((id) => validColumnIds.has(id)))
    const nextHidden = columns
      .filter((column) => !lockedColumnIds.has(column.id) && !visibleIds.has(column.id))
      .map((column) => column.id)
    const nextOrder = sanitizeOrder(view.columnOrder)

    setSelectedViewId(view.id)
    setViewName(view.name)
    if (persist) {
      persistColumnState(nextHidden, nextOrder)
    } else {
      setHiddenColumns(nextHidden)
      setColumnOrder(nextOrder)
    }
  }, [columns, lockedColumnIds, persistColumnState, sanitizeOrder, validColumnIds])

  const syncFromStorage = useCallback((includeEmptyOrder = true) => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        setHiddenColumns(defaultHiddenColumns)
      } else {
        const parsed = JSON.parse(raw)
        const next = sanitizeHiddenColumns(parsed)
        setHiddenColumns(next)
        const nextRaw = JSON.stringify(next)
        if (nextRaw !== raw) window.localStorage.setItem(storageKey, nextRaw)
      }
    } catch {
      setHiddenColumns(defaultHiddenColumns)
    }

    const order = sanitizeOrder(loadOrder(window.localStorage.getItem(orderStorageKey)))
    if (includeEmptyOrder || order.length > 0) setColumnOrder(order)
  }, [defaultHiddenColumns, orderStorageKey, sanitizeHiddenColumns, sanitizeOrder, storageKey])

  const loadSavedViews = useCallback(async (options: { applyDefault?: boolean } = {}) => {
    const response = await fetch(`/api/list-views?tableId=${encodeURIComponent(tableId)}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load views')
    const data = await response.json() as { views?: SavedColumnView[] }
    const views = Array.isArray(data.views) ? data.views : []
    setSavedViews(views)

    if (options.applyDefault) {
      const defaultView = views.find((view) => view.isDefault)
      if (defaultView) {
        applyView(defaultView, false)
      } else {
        applyBuiltInDefault(false)
      }
    }

    return views
  }, [applyBuiltInDefault, applyView, tableId])

  useEffect(() => {
    let cancelled = false

    async function loadViews() {
      try {
        if (cancelled) return
        await loadSavedViews({ applyDefault: true })
      } catch {
        if (!cancelled) syncFromStorage(false)
      }
    }

    loadViews()
    return () => {
      cancelled = true
    }
  }, [loadSavedViews, syncFromStorage])

  useEffect(() => {
    function handleStorage() {
      syncFromStorage()
    }

    function handleCustomizationUpdate(event: Event) {
      const detail = (event as CustomEvent<{ tableId?: string }>).detail
      if (!detail || detail.tableId === tableId) {
        syncFromStorage()
      }
    }

    window.addEventListener('column-selector:updated', handleCustomizationUpdate as EventListener)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('column-selector:updated', handleCustomizationUpdate as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [syncFromStorage, tableId])

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
    const dropdownWidth = 384
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

  const sortableColumns = useMemo(() => {
    const nonLocked = columns.filter((column) => !lockedColumnIds.has(column.id))
    if (columnOrder.length === 0) return nonLocked
    const colMap = new Map(nonLocked.map((column) => [column.id, column]))
    const ordered: ColumnOption[] = []
    for (const id of columnOrder) {
      const column = colMap.get(id)
      if (column) {
        ordered.push(column)
        colMap.delete(id)
      }
    }
    for (const column of nonLocked) {
      if (colMap.has(column.id)) ordered.push(column)
    }
    return ordered
  }, [columns, columnOrder, lockedColumnIds])

  useEffect(() => {
    const tableContainer = document.querySelector(`[data-column-selector-table="${tableId}"]`)
    if (!tableContainer) return
    const tableElement = tableContainer

    const pinnedStartIds = columns.slice(0, 2).map((column) => column.id)
    const pinnedEndIds = columns.filter((column, index) => index >= 2 && lockedColumnIds.has(column.id)).map((column) => column.id)
    const nonLockedIds = sortableColumns.map((column) => column.id)
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
        if (cell) {
          fragment.appendChild(cell)
          cellsByCol.delete(colId)
        }
      }
      for (const cell of cells) {
        const colId = cell.getAttribute('data-column')
        if (colId && cellsByCol.has(colId)) fragment.appendChild(cell)
      }
      row.appendChild(fragment)
    }

    function reorderAll() {
      if (isReordering) return
      isReordering = true
      tableElement.querySelectorAll('tr').forEach(reorderRow)
      setTimeout(() => {
        isReordering = false
      }, 0)
    }

    reorderAll()

    const observer = new MutationObserver(reorderAll)
    observer.observe(tableElement, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [tableId, columns, lockedColumnIds, sortableColumns])

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

  const countableColumns = useMemo(
    () => columns.filter((column) => !['actions', 'created', 'last-modified'].includes(column.id)),
    [columns],
  )
  const visibleCount = countableColumns.filter((column) => !hiddenColumns.includes(column.id)).length
  const totalCount = countableColumns.length

  function toggleColumn(column: ColumnOption) {
    if (lockedColumnIds.has(column.id)) return

    const nextHidden = hiddenColumns.includes(column.id)
      ? hiddenColumns.filter((id) => id !== column.id)
      : [...hiddenColumns, column.id]

    setSelectedViewId(CUSTOM_VIEW_ID)
    persistColumnState(nextHidden, columnOrder)
  }

  function resetColumns() {
    window.localStorage.removeItem(storageKey)
    window.localStorage.removeItem(orderStorageKey)
    applyBuiltInDefault()
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
    const ids = sortableColumns.map((column) => column.id)
    const [moved] = ids.splice(dragIndex, 1)
    ids.splice(index, 0, moved)
    setSelectedViewId(CUSTOM_VIEW_ID)
    persistColumnState(hiddenColumns, ids)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  async function saveView() {
    const name = viewName.trim()
    if (!name) {
      setViewStatus('Name the view before saving.')
      return
    }

    const columnIds = columns.filter((column) => !hiddenColumns.includes(column.id)).map((column) => column.id)
    const columnOrder = sortableColumns.map((column) => column.id)
    setViewStatus('Saving...')

    try {
      const response = await fetch('/api/list-views', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          name,
          columnIds,
          columnOrder,
          isDefault: false,
        }),
      })

      if (!response.ok) throw new Error('Failed to save view')
      const data = await response.json() as { view: SavedColumnView }
      const saved = data.view
      setSavedViews((current) => {
        const withoutSaved = current.filter((view) => view.id !== saved.id && view.name !== saved.name)
        return [...withoutSaved, saved].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))
      })
      setSelectedViewId(saved.id)
      setViewName(saved.name)
      setViewStatus('Saved.')
      loadSavedViews().catch(() => {
        setViewStatus('Saved. Refresh to reload all views.')
      })
    } catch {
      setViewStatus('Could not save this view.')
    }
  }

  async function deleteView(view: SavedColumnView) {
    setViewStatus(`Deleting ${view.name}...`)

    try {
      const response = await fetch('/api/list-views', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: view.id, tableId }),
      })

      if (!response.ok) throw new Error('Failed to delete view')
      setSavedViews((current) => current.filter((entry) => entry.id !== view.id))
      if (selectedViewId === view.id) applyBuiltInDefault()
      setViewStatus('Deleted.')
    } catch {
      setViewStatus('Could not delete this view.')
    }
  }

  async function setDefaultView(view: SavedColumnView | null) {
    setViewStatus('Updating default...')

    try {
      const response = await fetch('/api/list-views', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: view?.id ?? null, tableId }),
      })

      if (!response.ok) throw new Error('Failed to update default')
      setSavedViews((current) => current.map((entry) => ({ ...entry, isDefault: view?.id === entry.id })))
      if (view) {
        applyView({ ...view, isDefault: true })
      } else {
        applyBuiltInDefault()
      }
      setViewStatus('Default updated.')
    } catch {
      setViewStatus('Could not update the default view.')
    }
  }

  return (
    <div className="relative shrink-0" ref={containerRef}>
      {styleMarkup ? <style>{styleMarkup}</style> : null}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex w-40 shrink-0 items-center justify-between rounded-md border px-3 py-2 text-sm font-medium"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
      >
        <span>Columns</span>
        <span aria-hidden="true">({visibleCount} of {totalCount})</span>
      </button>

      {open && dropdownPos
        ? createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-50 max-h-[36rem] w-96 overflow-y-auto rounded-xl border p-4 shadow-2xl"
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

              <div className="mb-4 space-y-3 rounded-lg border p-3" style={{ borderColor: 'var(--border-muted)' }}>
                <div className="grid grid-cols-[1fr_4rem_2rem] gap-2 px-2 text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>
                  <span>View name</span>
                  <span className="text-center">Default</span>
                  <span className="text-center">Del</span>
                </div>
                <div className="space-y-1">
                  <div
                    className="grid grid-cols-[1fr_4rem_2rem] items-center gap-2 rounded-md border px-2 py-1.5"
                    style={{ borderColor: selectedViewId === BUILT_IN_VIEW_ID ? 'var(--accent-primary-strong)' : 'var(--border-muted)' }}
                  >
                    <button
                      type="button"
                      onClick={() => applyBuiltInDefault()}
                      className="min-w-0 truncate text-left text-sm"
                      style={{ color: selectedViewId === BUILT_IN_VIEW_ID ? 'var(--accent-primary-strong)' : 'var(--text-secondary)' }}
                    >
                      Built-in default
                    </button>
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={!savedViews.some((view) => view.isDefault)}
                        onChange={() => setDefaultView(null)}
                        className="h-4 w-4"
                      />
                    </div>
                    <span aria-hidden="true" />
                  </div>

                  {savedViews.map((view) => (
                    <div
                      key={view.id}
                      className="grid grid-cols-[1fr_4rem_2rem] items-center gap-2 rounded-md border px-2 py-1.5"
                      style={{ borderColor: selectedViewId === view.id ? 'var(--accent-primary-strong)' : 'var(--border-muted)' }}
                    >
                      <button
                        type="button"
                        onClick={() => applyView(view)}
                        className="min-w-0 truncate text-left text-sm"
                        style={{ color: selectedViewId === view.id ? 'var(--accent-primary-strong)' : 'var(--text-secondary)' }}
                      >
                        {view.name}
                      </button>
                      <div className="flex justify-center">
                        <input
                          type="checkbox"
                          checked={view.isDefault}
                          onChange={() => setDefaultView(view)}
                          className="h-4 w-4"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteView(view)}
                        className="h-6 w-6 shrink-0 rounded border text-xs font-semibold"
                        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}
                        aria-label={`Delete ${view.name} view`}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    value={viewName}
                    onChange={(event) => setViewName(event.target.value)}
                    placeholder="View name"
                    className="min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                  <button
                    type="button"
                    onClick={saveView}
                    className="shrink-0 rounded-md border px-3 py-2 text-sm font-medium"
                    style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                  >
                    Save
                  </button>
                </div>

                {viewStatus ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{viewStatus}</p> : null}
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
                      onDragOver={(event) => handleDragOver(event, index)}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={handleDragEnd}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 transition-colors"
                      style={{
                        borderColor: isDragOver ? 'var(--accent-primary-strong)' : 'var(--border-muted)',
                        opacity: isDragging ? 0.5 : 1,
                        cursor: 'grab',
                      }}
                    >
                      <span className="text-xs select-none" style={{ color: 'var(--text-muted)' }} aria-hidden>::</span>
                      <label className="flex flex-1 cursor-pointer items-center justify-between">
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
