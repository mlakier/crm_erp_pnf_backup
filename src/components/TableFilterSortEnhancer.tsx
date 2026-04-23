'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type SortDirection = 'asc' | 'desc'
type TableState = {
  filters: Record<string, string>
  sortColumn: string | null
  sortDirection: SortDirection
}

const TABLE_STATE = new WeakMap<HTMLTableElement, TableState>()

function setImportantStyles(element: HTMLElement, styles: Record<string, string>) {
  for (const [property, value] of Object.entries(styles)) {
    element.style.setProperty(property, value, 'important')
  }
}

function removeStyles(element: HTMLElement, properties: string[]) {
  for (const property of properties) {
    element.style.removeProperty(property)
  }
}

function getPinnedColumnIds(table: HTMLTableElement): string[] {
  const headerCells = Array.from(table.tHead?.rows[0]?.cells ?? [])
  return headerCells
    .map((cell) => cell.getAttribute('data-column') ?? '')
    .filter((columnId) => columnId && columnId !== 'actions')
    .slice(0, 2)
}

function measureColumnWidth(cells: HTMLTableCellElement[]): number {
  return Math.max(
    1,
    ...cells.map((cell) => {
      const rectWidth = cell.getBoundingClientRect().width
      const scrollWidth = cell.scrollWidth
      return Math.ceil(Math.max(rectWidth, scrollWidth)) + 2
    }),
  )
}

function enforcePinnedColumns(table: HTMLTableElement) {
  if (table.dataset.disablePinnedColumns === 'true') return

  const pinnedColumnIds = getPinnedColumnIds(table)
  if (pinnedColumnIds.length === 0) return

  let leftOffset = 0

  for (const columnId of pinnedColumnIds) {
    const headerCell = table.tHead?.rows[0]?.querySelector<HTMLTableCellElement>(`th[data-column="${columnId}"]`)
    if (!headerCell) continue

    const filterCell = table.tHead?.querySelector<HTMLTableCellElement>(`tr[data-filter-row] th[data-column="${columnId}"]`)
    const dataCells = Array.from(table.querySelectorAll<HTMLTableCellElement>(`td[data-column="${columnId}"]`))
    const columnCells = [headerCell, ...(filterCell ? [filterCell] : []), ...dataCells]

    for (const cell of columnCells) {
      removeStyles(cell, ['width', 'min-width', 'max-width', 'overflow', 'text-overflow'])
    }

    const columnWidth = measureColumnWidth(columnCells)
    const left = `${leftOffset}px`

    setImportantStyles(headerCell, {
      display: 'table-cell',
      visibility: 'visible',
      position: 'sticky',
      left,
      width: `${columnWidth}px`,
      'min-width': `${columnWidth}px`,
      'z-index': '20',
      'background-color': 'var(--card)',
    })

    if (filterCell) {
      setImportantStyles(filterCell, {
        display: 'table-cell',
        visibility: 'visible',
        position: 'sticky',
        left,
        width: `${columnWidth}px`,
        'min-width': `${columnWidth}px`,
        'z-index': '20',
        'background-color': 'var(--card)',
      })
    }

    for (const cell of dataCells) {
      setImportantStyles(cell, {
        display: 'table-cell',
        visibility: 'visible',
        position: 'sticky',
        left,
        width: `${columnWidth}px`,
        'min-width': `${columnWidth}px`,
        'z-index': '10',
        'background-color': 'var(--card)',
      })
    }

    leftOffset += columnWidth
  }
}

function parseComparable(value: string): number | string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const numeric = Number(trimmed.replace(/[$,%\s,()]/g, '').replace(/^\+/, ''))
  if (!Number.isNaN(numeric) && /\d/.test(trimmed)) return numeric

  const date = Date.parse(trimmed)
  if (!Number.isNaN(date)) return date

  return trimmed.toLowerCase()
}

function compareValues(a: string, b: string, direction: SortDirection): number {
  const left = parseComparable(a)
  const right = parseComparable(b)

  if (left === right) return 0

  const result = left > right ? 1 : -1
  return direction === 'asc' ? result : result * -1
}

function ensureSortIndicator(headerCell: HTMLTableCellElement) {
  let indicator = headerCell.querySelector<HTMLSpanElement>('[data-sort-indicator="true"]')
  if (!indicator) {
    indicator = document.createElement('span')
    indicator.setAttribute('data-sort-indicator', 'true')
    indicator.style.marginLeft = '0.25rem'
    indicator.style.pointerEvents = 'none'
    indicator.style.display = 'inline-block'
    headerCell.appendChild(indicator)
  }
  return indicator
}

function updateHeaderSortIndicators(
  headerCells: HTMLTableCellElement[],
  sortColumn: string | null,
  sortDirection: SortDirection,
) {
  for (const cell of headerCells) {
    const id = cell.getAttribute('data-column')
    if (!id || id === 'actions') continue
    const indicator = ensureSortIndicator(cell)
    indicator.textContent = sortColumn === id ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'
  }
}

function applyTableState(table: HTMLTableElement) {
  const tbody = table.tBodies[0]
  if (!tbody) return

  const state = TABLE_STATE.get(table)
  if (!state) return

  const { filters, sortColumn, sortDirection } = state
  const mainSearchQuery = (table.dataset.mainSearchQuery ?? '').trim().toLowerCase()

  const rows = Array.from(tbody.rows)
  const dataRows = rows.filter((row) => row.querySelector('td[data-column]'))

  for (const row of dataRows) {
    let visible = mainSearchQuery.length === 0
      ? true
      : (row.textContent ?? '').toLowerCase().includes(mainSearchQuery)

    if (!visible) {
      row.style.display = 'none'
      continue
    }

    for (const [columnId, filterValue] of Object.entries(filters)) {
      if (!filterValue) continue
      const cell = row.querySelector<HTMLElement>(`td[data-column="${columnId}"]`)
      const text = (cell?.textContent ?? '').toLowerCase()
      if (!text.includes(filterValue.toLowerCase())) {
        visible = false
        break
      }
    }
    row.style.display = visible ? '' : 'none'
  }

  if (!sortColumn) return

  const visibleRows = dataRows.filter((row) => row.style.display !== 'none')
  visibleRows.sort((a, b) => {
    const aText = a.querySelector<HTMLElement>(`td[data-column="${sortColumn}"]`)?.textContent ?? ''
    const bText = b.querySelector<HTMLElement>(`td[data-column="${sortColumn}"]`)?.textContent ?? ''
    return compareValues(aText, bText, sortDirection)
  })

  for (const row of visibleRows) {
    tbody.appendChild(row)
  }

  enforcePinnedColumns(table)
}

function enhanceTable(table: HTMLTableElement) {
  if (table.dataset.filterSortEnhanced === 'true') {
    enforcePinnedColumns(table)
    return
  }

  const header = table.tHead
  const body = table.tBodies[0]
  if (!header || !body || header.rows.length === 0) return

  const headerRow = header.rows[0]
  const headerCells = Array.from(headerRow.cells)
  const columnIds = headerCells
    .map((cell) => cell.getAttribute('data-column') ?? '')
    .filter((value) => value.length > 0)

  if (columnIds.length === 0) return

  TABLE_STATE.set(table, {
    filters: {},
    sortColumn: null,
    sortDirection: 'asc',
  })

  const filterRow = document.createElement('tr')
  filterRow.setAttribute('data-filter-row', 'true')

  for (const headerCell of headerCells) {
    const columnId = headerCell.getAttribute('data-column')
    const filterCell = document.createElement('th')
    filterCell.className = 'px-1.5 py-1.5'
    filterCell.style.backgroundColor = 'var(--card)'
    filterCell.style.minWidth = '0'
    if (columnId) filterCell.setAttribute('data-column', columnId)

    if (!columnId || columnId === 'actions') {
      filterRow.appendChild(filterCell)
      continue
    }

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Filter'
    input.className = 'block w-[5.5rem] min-w-0 max-w-full rounded-md border bg-transparent px-2 py-1 text-[11px] leading-4 text-white'
    input.style.borderColor = 'var(--border-muted)'
    input.style.minWidth = '0'
    input.style.boxSizing = 'border-box'
    input.addEventListener('input', () => {
      const state = TABLE_STATE.get(table)
      if (!state) return
      state.filters[columnId] = input.value.trim()
      applyTableState(table)
      const form = table.closest('section')?.querySelector<HTMLFormElement>('form[method="get"]')
      if (form) updatePaginationDisplay(form)
    })
    filterCell.appendChild(input)
    filterRow.appendChild(filterCell)

    headerCell.style.cursor = 'pointer'
    ensureSortIndicator(headerCell)

    headerCell.addEventListener('click', () => {
      const state = TABLE_STATE.get(table)
      if (!state) return

      if (state.sortColumn === columnId) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        state.sortColumn = columnId
        state.sortDirection = 'asc'
      }

      updateHeaderSortIndicators(headerCells, state.sortColumn, state.sortDirection)
      applyTableState(table)
    })
  }

  updateHeaderSortIndicators(headerCells, null, 'asc')
  header.appendChild(filterRow)
  table.dataset.filterSortEnhanced = 'true'
  enforcePinnedColumns(table)
  applyTableState(table)
}

function getRelatedTables(form: HTMLFormElement): HTMLTableElement[] {
  const root = form.closest('section') ?? form.parentElement ?? document.body
  return Array.from(root.querySelectorAll<HTMLTableElement>('[data-column-selector-table] table'))
}

function updatePaginationDisplay(form: HTMLFormElement) {
  const tables = getRelatedTables(form)
  if (tables.length === 0) return

  const table = tables[0]
  const tbody = table.tBodies[0]
  if (!tbody) return

  const allDataRows = Array.from(tbody.rows).filter((row) => row.querySelector('td[data-column]'))
  const visibleRows = allDataRows.filter((row) => row.style.display !== 'none')

  const paginationDisplay = form
    .closest('section')
    ?.querySelector<HTMLParagraphElement>('p')
  if (!paginationDisplay) return

  const visibleCount = visibleRows.length
  if (visibleCount === 0) {
    paginationDisplay.textContent = 'No results'
    return
  }

  const startRow = 1
  const endRow = visibleCount
  const total = visibleCount
  paginationDisplay.textContent = `Showing ${startRow}-${endRow} of ${total}`
}

function applyMainSearchToTables(form: HTMLFormElement, query: string) {
  const tables = getRelatedTables(form)
  for (const table of tables) {
    table.dataset.mainSearchQuery = query

    if (TABLE_STATE.has(table)) {
      applyTableState(table)
      continue
    }

    const tbody = table.tBodies[0]
    if (!tbody) continue
    const rows = Array.from(tbody.rows).filter((row) => row.querySelector('td[data-column]'))
    const normalized = query.trim().toLowerCase()
    for (const row of rows) {
      const visible = normalized.length === 0 || (row.textContent ?? '').toLowerCase().includes(normalized)
      row.style.display = visible ? '' : 'none'
    }
  }
  updatePaginationDisplay(form)
}

function usesServerBackedSearch(form: HTMLFormElement) {
  return Boolean(form.querySelector<HTMLInputElement>('input[type="hidden"][name="page"]'))
    && getRelatedTables(form).length > 0
}

function clearColumnFilters(form: HTMLFormElement) {
  const tables = getRelatedTables(form)

  for (const table of tables) {
    const filterInputs = Array.from(
      table.querySelectorAll<HTMLInputElement>('thead tr[data-filter-row] input[type="text"]')
    )
    for (const input of filterInputs) {
      input.value = ''
    }

    const state = TABLE_STATE.get(table)
    if (!state) continue

    state.filters = {}
    applyTableState(table)
  }
}

function enhanceLiveSearchForm(form: HTMLFormElement, navigate: (url: string, options?: { force?: boolean }) => void) {
  if (form.dataset.liveSearchEnhanced === 'true') return

  const searchInput = form.querySelector<HTMLInputElement>('input[name="q"]')
  if (!searchInput) return
  const serverBackedSearch = usesServerBackedSearch(form)

  const submitButtons = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="submit"]'))
  for (const button of submitButtons) {
    const label = (button.textContent ?? '').trim().toLowerCase()
    if (!serverBackedSearch && (label === 'apply' || label === 'search' || submitButtons.length === 1)) {
      button.style.display = 'none'
      button.setAttribute('aria-hidden', 'true')
      button.tabIndex = -1
    }
  }

  const ensurePageResetsToFirst = () => {
    const pageInput = form.querySelector<HTMLInputElement>('input[name="page"]')
    if (pageInput) pageInput.value = '1'
  }

  const buildSearchParams = () => {
    ensurePageResetsToFirst()

    const params = new URLSearchParams()
    const formData = new FormData(form)
    for (const [key, value] of formData.entries()) {
      const normalized = String(value)
      if (normalized.length === 0) continue
      params.set(key, normalized)
    }

    return params
  }

  const navigateIfChanged = (force = false) => {
    const params = buildSearchParams()
    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl === currentUrl) {
      if (force) {
        navigate(nextUrl, { force: true })
      }
      return
    }

    navigate(nextUrl)
  }

  const syncUrlWithoutReload = () => {
    const params = buildSearchParams()
    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl === currentUrl) return
    window.history.replaceState(null, '', nextUrl)
  }

  let liveSearchTimer: number | undefined

  const scheduleServerSearch = () => {
    window.clearTimeout(liveSearchTimer)
    liveSearchTimer = window.setTimeout(() => navigateIfChanged(), 450)
  }

  const handleLiveInput = () => {
    if (serverBackedSearch) {
      scheduleServerSearch()
      return
    }

    applyMainSearchToTables(form, searchInput.value)
    syncUrlWithoutReload()
  }

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      window.clearTimeout(liveSearchTimer)
      if (!serverBackedSearch) {
        applyMainSearchToTables(form, searchInput.value)
      }
      navigateIfChanged(true)
    }
  })

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    window.clearTimeout(liveSearchTimer)
    if (!serverBackedSearch) {
      applyMainSearchToTables(form, searchInput.value)
    }
    navigateIfChanged(true)
  })

  searchInput.addEventListener('input', handleLiveInput)

  const changeFields = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('select[name], input[name]'))
    .filter((field) => field.name !== 'q' && field.type !== 'hidden')

  for (const field of changeFields) {
    field.addEventListener('change', () => navigateIfChanged())
  }

  const resetLinks = Array.from(form.querySelectorAll<HTMLAnchorElement>('a'))
  for (const link of resetLinks) {
    if ((link.textContent ?? '').trim().toLowerCase() !== 'reset') continue

    link.addEventListener('click', () => {
      searchInput.value = ''
      clearColumnFilters(form)
      if (!serverBackedSearch) {
        applyMainSearchToTables(form, '')
      }
      const pageInput = form.querySelector<HTMLInputElement>('input[name="page"]')
      if (pageInput) pageInput.value = '1'
    })
  }

  if (!serverBackedSearch) {
    applyMainSearchToTables(form, searchInput.value)
  }

  form.dataset.liveSearchEnhanced = 'true'
}

export default function TableFilterSortEnhancer() {
  const router = useRouter()

  useEffect(() => {
    const navigate = (url: string, options?: { force?: boolean }) => {
      if (options?.force) {
        router.refresh()
        return
      }
      router.replace(url, { scroll: false })
    }

    const run = () => {
      const tables = Array.from(
        document.querySelectorAll<HTMLTableElement>('[data-column-selector-table] table')
      ).filter((table) => table.dataset.disableFilterSort !== 'true')
      tables.forEach((table) => {
        try {
          enhanceTable(table)
        } catch (error) {
          console.error('Table enhancement failed', error)
        }
      })

      const forms = document.querySelectorAll<HTMLFormElement>('form')
      forms.forEach((form) => {
        if (!form.querySelector('input[name="q"]')) return

        try {
          enhanceLiveSearchForm(form, navigate)
        } catch (error) {
          console.error('Live search enhancement failed', error)
        }
      })
    }

    run()

    const observer = new MutationObserver(() => run())
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
    }
  }, [router])

  return null
}
