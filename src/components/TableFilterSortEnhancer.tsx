'use client'

import { useEffect } from 'react'

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

function getPinnedColumnIds(table: HTMLTableElement): string[] {
  const headerCells = Array.from(table.tHead?.rows[0]?.cells ?? [])
  return headerCells
    .map((cell) => cell.getAttribute('data-column') ?? '')
    .filter((columnId) => columnId && columnId !== 'actions')
    .slice(0, 2)
}

function enforcePinnedColumns(table: HTMLTableElement) {
  const pinnedColumnIds = getPinnedColumnIds(table)
  if (pinnedColumnIds.length === 0) return

  let leftOffset = 0

  for (const [index, columnId] of pinnedColumnIds.entries()) {
    const headerCell = table.tHead?.rows[0]?.querySelector<HTMLTableCellElement>(`th[data-column="${columnId}"]`)
    if (!headerCell) continue

    const measuredWidth = Math.ceil(headerCell.getBoundingClientRect().width)
    const fallbackWidth = index === 0 ? 120 : 180
    const columnWidth = Math.max(measuredWidth, fallbackWidth)
    const left = `${leftOffset}px`

    setImportantStyles(headerCell, {
      display: 'table-cell',
      visibility: 'visible',
      position: 'sticky',
      left,
      'z-index': '20',
      'min-width': `${columnWidth}px`,
      'background-color': 'var(--card)',
    })

    const filterCell = table.tHead?.querySelector<HTMLTableCellElement>(`tr[data-filter-row] th[data-column="${columnId}"]`)
    if (filterCell) {
      setImportantStyles(filterCell, {
        display: 'table-cell',
        visibility: 'visible',
        position: 'sticky',
        left,
        'z-index': '20',
        'min-width': `${columnWidth}px`,
        'background-color': 'var(--card)',
      })
    }

    const dataCells = table.querySelectorAll<HTMLTableCellElement>(`td[data-column="${columnId}"]`)
    for (const cell of dataCells) {
      setImportantStyles(cell, {
        display: 'table-cell',
        visibility: 'visible',
        position: 'sticky',
        left,
        'z-index': '10',
        'min-width': `${columnWidth}px`,
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
    filterCell.className = 'px-2 py-2'
    filterCell.style.backgroundColor = 'var(--card)'
    if (columnId) filterCell.setAttribute('data-column', columnId)

    if (!columnId || columnId === 'actions') {
      filterRow.appendChild(filterCell)
      continue
    }

    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Filter'
    input.className = 'w-full rounded-md border bg-transparent px-2 py-1 text-xs text-white'
    input.style.borderColor = 'var(--border-muted)'
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

    const originalLabel = headerCell.textContent?.trim() ?? ''
    const labelSpan = document.createElement('span')
    labelSpan.textContent = `${originalLabel} ↕`
    headerCell.textContent = ''
    headerCell.appendChild(labelSpan)
    headerCell.style.cursor = 'pointer'

    headerCell.addEventListener('click', () => {
      const state = TABLE_STATE.get(table)
      if (!state) return

      if (state.sortColumn === columnId) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        state.sortColumn = columnId
        state.sortDirection = 'asc'
      }

      for (const cell of headerCells) {
        const id = cell.getAttribute('data-column')
        if (!id || id === 'actions') continue
        const text = cell.textContent?.replace(/\s*[↑↓↕]$/, '') ?? ''
        const marker = state.sortColumn === id ? (state.sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'
        cell.textContent = `${text}${marker}`
      }

      applyTableState(table)
    })
  }

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

    // Fallback for tables not enhanced yet.
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

function enhanceLiveSearchForm(form: HTMLFormElement) {
  if (form.dataset.liveSearchEnhanced === 'true') return

  const searchInput = form.querySelector<HTMLInputElement>('input[name="q"]')
  if (!searchInput) return

  const submitButtons = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="submit"]'))
  for (const button of submitButtons) {
    const label = (button.textContent ?? '').trim().toLowerCase()
    if (label === 'apply' || label === 'search' || submitButtons.length === 1) {
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
        window.location.reload()
      }
      return
    }

    window.location.assign(nextUrl)
  }

  const syncUrlWithoutReload = () => {
    const params = buildSearchParams()
    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl === currentUrl) return
    window.history.replaceState(null, '', nextUrl)
  }

  const handleLiveInput = () => {
    applyMainSearchToTables(form, searchInput.value)
    syncUrlWithoutReload()
  }

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      applyMainSearchToTables(form, searchInput.value)
      navigateIfChanged(true)
    }
  })

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    applyMainSearchToTables(form, searchInput.value)
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
      applyMainSearchToTables(form, '')
      const pageInput = form.querySelector<HTMLInputElement>('input[name="page"]')
      if (pageInput) pageInput.value = '1'
    })
  }

  applyMainSearchToTables(form, searchInput.value)

  form.dataset.liveSearchEnhanced = 'true'
}

export default function TableFilterSortEnhancer() {
  useEffect(() => {
    const run = () => {
      const tables = document.querySelectorAll<HTMLTableElement>('[data-column-selector-table] table')
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
          enhanceLiveSearchForm(form)
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
  }, [])

  return null
}
