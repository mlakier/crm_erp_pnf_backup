import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type ExportDataset = {
  headers: string[]
  rows: string[][]
}

function getFileTimestamp() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  return `${datePart}_${timePart}`
}

function escapeCsvValue(value: string): string {
  const normalized = value.replace(/\r?\n|\r/g, ' ')
  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

export function buildExportFileName(fileName: string, extension: string) {
  const timestamp = getFileTimestamp()
  return `${fileName.replace(new RegExp(`\\.${extension}$`), '')}_${timestamp}.${extension}`
}

export function exportDataToCSV(dataset: ExportDataset, fileName: string = 'export') {
  const csvLines = [dataset.headers, ...dataset.rows].map((line) => line.map(escapeCsvValue).join(','))
  const csvContent = csvLines.join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = buildExportFileName(fileName, 'csv')
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportDataToExcel(dataset: ExportDataset, fileName: string = 'export') {
  const worksheetData = [dataset.headers, ...dataset.rows]
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  const colWidths = dataset.headers.map((header, idx) => {
    const maxLength = Math.max(header.length, ...dataset.rows.map((row) => (row[idx] ?? '').length))
    return { wch: Math.min(maxLength + 2, 50) }
  })
  worksheet['!cols'] = colWidths

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
  XLSX.writeFile(workbook, buildExportFileName(fileName, 'xlsx'))
}

export function exportDataToPDF(dataset: ExportDataset, fileName: string = 'export') {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  autoTable(pdf, {
    head: [dataset.headers],
    body: dataset.rows,
    startY: 10,
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
    },
    margin: { top: 10, right: 8, bottom: 10, left: 8 },
  })

  pdf.save(buildExportFileName(fileName, 'pdf'))
}
