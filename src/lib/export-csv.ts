import { exportDataToCSV } from '@/lib/export-data'

export function exportTableToCSV(tableId: string, fileName: string = 'export') {
  const table = document.querySelector<HTMLTableElement>(`table[id="${tableId}"]`)
  if (!table) {
    console.error(`Table with ID "${tableId}" not found`)
    return
  }

  const thead = table.tHead
  const tbody = table.tBodies[0]
  if (!thead || !tbody) {
    console.error('Table structure is invalid')
    return
  }

  const headerCells = Array.from(thead.rows[0].cells)
  const headers = headerCells.map((cell) => {
    const text = cell.textContent?.replace(/\s*[↑↓↕]$/, '').trim() ?? ''
    return text
  })

  const rows = Array.from(tbody.rows)
    .filter((row) => row.style.display !== 'none' && row.querySelector('td[data-column]'))
    .map((row) => {
      return Array.from(row.cells)
        .slice(0, headers.length)
        .map((cell) => cell.textContent?.trim() ?? '')
    })

  exportDataToCSV({ headers, rows }, fileName)
}
