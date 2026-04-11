'use client'

import { useEffect } from 'react'

type SortDirection = 'asc' | 'desc'

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

function applyTableState(
  table: HTMLTableElement,
  filters: Record<string, string>,
  sortColumn: string | null,
  sortDirection: SortDirection,
) {
  const tbody = table.tBodies[0]
  if (!tbody) return

  const rows = Array.from(tbody.rows)
  const dataRows = rows.filter((row) => row.querySelector('td[data-column]'))

  for (const row of dataRows) {
    let visible = true
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
}

function enhanceTable(table: HTMLTableElement) {
  if (table.dataset.filterSortEnhanced === 'true') return

  const header = table.tHead
  const body = table.tBodies[0]
  if (!header || !body || header.rows.length === 0) return

  const headerRow = header.rows[0]
  const headerCells = Array.from(headerRow.cells)
  const columnIds = headerCells
    .map((cell) => cell.getAttribute('data-column') ?? '')
    .filter((value) => value.length > 0)

  if (columnIds.length === 0) return

  const filters: Record<string, string> = {}
  let sortColumn: string | null = null
  let sortDirection: SortDirection = 'asc'

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
      filters[columnId] = input.value.trim()
      applyTableState(table, filters, sortColumn, sortDirection)
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
      if (sortColumn === columnId) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        sortColumn = columnId
        sortDirection = 'asc'
      }

      for (const cell of headerCells) {
        const id = cell.getAttribute('data-column')
        if (!id || id === 'actions') continue
        const text = cell.textContent?.replace(/\s*[↑↓↕]$/, '') ?? ''
        const marker = sortColumn === id ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕'
        cell.textContent = `${text}${marker}`
      }

      applyTableState(table, filters, sortColumn, sortDirection)
    })
  }

  header.appendChild(filterRow)
  table.dataset.filterSortEnhanced = 'true'
}

export default function TableFilterSortEnhancer() {
  useEffect(() => {
    const run = () => {
      const tables = document.querySelectorAll<HTMLTableElement>('[data-column-selector-table] table')
      tables.forEach((table) => enhanceTable(table))
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
