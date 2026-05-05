'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  type SavedSearchFieldOption,
  getSavedSearchMetadataStorageKey,
  type SavedSearchLinkedResultSource,
  type SavedSearchColumnOption,
  type SavedSearchDefinitionState,
  type SavedSearchFilterDefinition,
  type SavedSearchTableMetadata,
} from '@/lib/saved-search-metadata'
import type { SavedSearchBuiltInBaseline } from '@/lib/saved-search-builtins-store'

type SavedColumnView = {
  id: string
  name: string
  columnIds: string[]
  columnOrder: string[]
  filterState?: SavedSearchDefinitionState
  availableFilterIds?: string[]
  isDefault: boolean
}

const BUILT_IN_VIEW_ID = '__built-in-default'
function ensureLockedColumnVisibility(visibleColumnIds: string[], columns: SavedSearchColumnOption[]) {
  const lockedIds = columns.filter((column) => column.locked || column.id === 'actions').map((column) => column.id)
  const seen = new Set<string>()
  const next: string[] = []

  for (const id of [...lockedIds, ...visibleColumnIds]) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }

  return next
}

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

function buildDefaultTitle(tableId: string) {
  return tableId
    .replace(/-list$/i, '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

const BUILT_IN_DEFAULT_VISIBLE_COUNT = 8

function subscribeToLocationChange(callback: () => void) {
  if (typeof window === 'undefined') return () => {}

  const handler = () => callback()
  window.addEventListener('popstate', handler)
  window.addEventListener('column-selector:updated', handler as EventListener)
  return () => {
    window.removeEventListener('popstate', handler)
    window.removeEventListener('column-selector:updated', handler as EventListener)
  }
}

function getCurrentViewIdSnapshot() {
  if (typeof window === 'undefined') return ''
  try {
    return new URLSearchParams(window.location.search).get('view')?.trim() ?? ''
  } catch {
    return ''
  }
}

export default function ColumnSelector({
  tableId,
  columns,
  enableReordering = true,
  title,
  basePath,
  filterDefinitions = [],
  criteriaFields,
  resultFields,
  linkedResultSources,
}: {
  tableId: string
  columns: SavedSearchColumnOption[]
  enableReordering?: boolean
  title?: string
  basePath?: string
  filterDefinitions?: SavedSearchFilterDefinition[]
  criteriaFields?: SavedSearchFieldOption[]
  resultFields?: SavedSearchFieldOption[]
  linkedResultSources?: SavedSearchLinkedResultSource[]
}) {
  const pathname = usePathname()
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [activeAddedLinkedFieldIds, setActiveAddedLinkedFieldIds] = useState<string[]>([])
  const currentViewId = useSyncExternalStore(subscribeToLocationChange, getCurrentViewIdSnapshot, () => '')
  const fixedEndColumnIds = useMemo(
    () => new Set(columns.filter((column) => column.id === 'actions').map((column) => column.id)),
    [columns],
  )
  const lockedColumnIds = useMemo(
    () =>
      new Set(
        columns
          .filter((column) => column.locked)
          .map((column) => column.id)
          .concat(Array.from(fixedEndColumnIds)),
      ),
    [columns, fixedEndColumnIds],
  )
  const validColumnIds = useMemo(() => new Set(columns.map((column) => column.id)), [columns])
  const explicitDefaultColumns = useMemo(() => columns.filter((column) => column.defaultVisible !== undefined), [columns])
  const defaultHiddenColumns = useMemo(() => {
    if (explicitDefaultColumns.length === 0) return []

    const lockedIdsThatCountTowardBuiltIn = Array.from(lockedColumnIds).filter((id) => id !== 'actions')
    const maxUnlockedVisible = Math.max(0, BUILT_IN_DEFAULT_VISIBLE_COUNT - lockedIdsThatCountTowardBuiltIn.length)
    const allowedVisibleIds = new Set(
      columns
        .filter((column) => !lockedColumnIds.has(column.id) && column.id !== 'actions' && column.defaultVisible !== false)
        .slice(0, maxUnlockedVisible)
        .map((column) => column.id),
    )

    return columns
      .filter((column) => !lockedColumnIds.has(column.id) && !allowedVisibleIds.has(column.id))
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
    if (persist) {
      persistColumnState(defaultHiddenColumns, [])
    } else {
      setHiddenColumns(defaultHiddenColumns)
      setColumnOrder([])
    }
    setActiveAddedLinkedFieldIds([])
  }, [defaultHiddenColumns, persistColumnState])

  const applyView = useCallback((view: SavedColumnView, persist = true) => {
    const ensuredVisibleColumnIds = ensureLockedColumnVisibility(view.columnIds, columns).filter((id) => validColumnIds.has(id))
    const visibleIds = new Set(ensuredVisibleColumnIds)
    const nextHidden = columns
      .filter((column) => !lockedColumnIds.has(column.id) && !visibleIds.has(column.id))
      .map((column) => column.id)
    const nextOrder = sanitizeOrder(view.columnOrder)
    const nextAddedLinkedFieldIds = view.filterState?.results?.addedLinkedFieldIds ?? []

    if (persist) {
      persistColumnState(nextHidden, nextOrder)
    } else {
      setHiddenColumns(nextHidden)
      setColumnOrder(nextOrder)
    }
    setActiveAddedLinkedFieldIds(nextAddedLinkedFieldIds)
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

  const loadSavedViews = useCallback(async (options: { applyDefault?: boolean; requestedViewId?: string } = {}) => {
    const response = await fetch(`/api/list-views?tableId=${encodeURIComponent(tableId)}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to load views')
    const data = await response.json() as { views?: SavedColumnView[]; builtInBaseline?: SavedSearchBuiltInBaseline | null }
    const views = Array.isArray(data.views) ? data.views : []

    if (options.applyDefault) {
      if (options.requestedViewId === BUILT_IN_VIEW_ID) {
        if (data.builtInBaseline) {
          const ensuredVisibleColumnIds = ensureLockedColumnVisibility(data.builtInBaseline.columnIds, columns).filter((id) => validColumnIds.has(id))
          const visibleIds = new Set(ensuredVisibleColumnIds)
          const nextHidden = columns
            .filter((column) => !lockedColumnIds.has(column.id) && !visibleIds.has(column.id))
            .map((column) => column.id)
          const nextOrder = sanitizeOrder(data.builtInBaseline.columnOrder)
          setHiddenColumns(nextHidden)
          setColumnOrder(nextOrder)
          setActiveAddedLinkedFieldIds(data.builtInBaseline.filterState?.results?.addedLinkedFieldIds ?? [])
        } else {
          applyBuiltInDefault(false)
        }
        return views
      }
      const requestedView = options.requestedViewId
        ? views.find((view) => view.id === options.requestedViewId) ?? null
        : null
      const defaultView = views.find((view) => view.isDefault)
      const activeView = requestedView ?? defaultView
      if (activeView) {
        applyView(activeView, false)
      } else if (data.builtInBaseline) {
        const ensuredVisibleColumnIds = ensureLockedColumnVisibility(data.builtInBaseline.columnIds, columns).filter((id) => validColumnIds.has(id))
        const visibleIds = new Set(ensuredVisibleColumnIds)
        const nextHidden = columns
          .filter((column) => !lockedColumnIds.has(column.id) && !visibleIds.has(column.id))
          .map((column) => column.id)
        const nextOrder = sanitizeOrder(data.builtInBaseline.columnOrder)
        setHiddenColumns(nextHidden)
        setColumnOrder(nextOrder)
        setActiveAddedLinkedFieldIds(data.builtInBaseline.filterState?.results?.addedLinkedFieldIds ?? [])
      } else {
        applyBuiltInDefault(false)
      }
    }

    return views
  }, [applyBuiltInDefault, applyView, columns, lockedColumnIds, sanitizeOrder, tableId, validColumnIds])

  useEffect(() => {
    let cancelled = false

    async function loadViews() {
      try {
        if (cancelled) return
        await loadSavedViews({ applyDefault: true, requestedViewId: currentViewId })
      } catch {
        if (!cancelled) syncFromStorage(false)
      }
    }

    loadViews()
    return () => {
      cancelled = true
    }
  }, [currentViewId, loadSavedViews, syncFromStorage])

  useEffect(() => {
    function handleStorage() {
      syncFromStorage()
    }

    function handleCustomizationUpdate(event: Event) {
      const detail = (event as CustomEvent<{ tableId?: string }>).detail
      if (!detail || detail.tableId === tableId) {
        loadSavedViews({ applyDefault: true, requestedViewId: currentViewId }).catch(() => syncFromStorage())
      }
    }

    window.addEventListener('column-selector:updated', handleCustomizationUpdate as EventListener)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('column-selector:updated', handleCustomizationUpdate as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [currentViewId, loadSavedViews, syncFromStorage, tableId])

  useEffect(() => {
    const metadata: SavedSearchTableMetadata = {
      tableId,
      title: title?.trim() || buildDefaultTitle(tableId),
      basePath: basePath?.trim() || pathname || '/',
      columns,
      filters: filterDefinitions,
      criteriaFields,
      resultFields,
      linkedResultSources,
    }
    window.localStorage.setItem(
      getSavedSearchMetadataStorageKey(tableId),
      JSON.stringify(metadata),
    )
  }, [basePath, columns, criteriaFields, filterDefinitions, linkedResultSources, pathname, resultFields, tableId, title])

  const sortableColumns = useMemo(() => {
    const nonLocked = columns.filter((column) => !lockedColumnIds.has(column.id))
    if (columnOrder.length === 0) return nonLocked
    const colMap = new Map(nonLocked.map((column) => [column.id, column]))
    const ordered: SavedSearchColumnOption[] = []
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
  }, [columnOrder, columns, lockedColumnIds])

  useEffect(() => {
    if (!enableReordering) return

    const tableContainer = document.querySelector(`[data-column-selector-table="${tableId}"]`)
    if (!tableContainer) return
    const tableElement = tableContainer.querySelector('table')
    if (!tableElement) return
    const activeTableElement = tableElement

    const lockedStartIds = columns
      .filter((column) => column.locked && !fixedEndColumnIds.has(column.id))
      .map((column) => column.id)
      .filter((id) => !hiddenColumns.includes(id))
    const pinnedEndIds = columns.filter((column) => fixedEndColumnIds.has(column.id)).map((column) => column.id)
    const nonLockedIds = sortableColumns.map((column) => column.id)
    const fullOrder = [...lockedStartIds, ...nonLockedIds, ...pinnedEndIds]

    let isReordering = false

    function reorderRow(row: Element) {
      const cells = Array.from(row.children) as HTMLElement[]
      if (cells.length <= 1) return
      if (cells[0]?.getAttribute('colspan')) return

      const currentOrder = cells.map((cell) => cell.getAttribute('data-column') ?? '')
      const nextOrder = fullOrder.filter((columnId) => currentOrder.includes(columnId))
      const remainingOrder = currentOrder.filter((columnId) => columnId && !nextOrder.includes(columnId))
      const desiredOrder = [...nextOrder, ...remainingOrder]
      const orderChanged =
        desiredOrder.length === currentOrder.length
        && desiredOrder.some((columnId, index) => columnId !== currentOrder[index])

      if (!orderChanged) return

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
      activeTableElement.querySelectorAll('tr').forEach(reorderRow)
      setTimeout(() => {
        isReordering = false
      }, 0)
    }

    reorderAll()

    let frameId: number | null = null
    const scheduleReorder = () => {
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(() => {
        frameId = null
        reorderAll()
      })
    }

    const observer = new MutationObserver(scheduleReorder)
    observer.observe(tableElement, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [columns, enableReordering, fixedEndColumnIds, hiddenColumns, lockedColumnIds, sortableColumns, tableId])

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
    () => {
      const linkedFieldMap = new Map(
        (linkedResultSources ?? []).flatMap((source) => source.fields.map((field) => [field.id, field] as const)),
      )
      const activeLinkedFields = activeAddedLinkedFieldIds
        .map((id) => linkedFieldMap.get(id))
        .filter((field): field is SavedSearchFieldOption => Boolean(field))
      const universe = (resultFields?.length ? [...resultFields, ...activeLinkedFields] : columns).filter((column) => column.id !== 'actions')
      const seen = new Set<string>()
      return universe.filter((column) => {
        if (seen.has(column.id)) return false
        seen.add(column.id)
        return true
      })
    },
    [activeAddedLinkedFieldIds, columns, linkedResultSources, resultFields],
  )
  const visibleCount = countableColumns.filter((column) => !hiddenColumns.includes(column.id)).length
  const totalCount = countableColumns.length
  const editorHref = useMemo(() => {
    const next = new URLSearchParams()
    if (currentViewId) next.set('view', currentViewId)
    const query = next.toString()
    return query
      ? `/saved-searches/${encodeURIComponent(tableId)}?${query}`
      : `/saved-searches/${encodeURIComponent(tableId)}`
  }, [currentViewId, tableId])

  return (
    <div className="relative shrink-0">
      {styleMarkup ? <style>{styleMarkup}</style> : null}
      <Link
        href={editorHref}
        className="inline-flex w-40 shrink-0 items-center justify-between rounded-md border px-3 py-2 text-sm font-medium"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
      >
        <span>Columns</span>
        <span aria-hidden="true">({visibleCount} of {totalCount})</span>
      </Link>
    </div>
  )
}
