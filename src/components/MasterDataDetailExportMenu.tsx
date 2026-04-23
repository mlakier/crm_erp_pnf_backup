'use client'

import { useEffect, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

type ExportField = {
  label: string
  value: string
  type?: string
  multiple?: boolean
  options?: Array<{ value: string; label: string }>
}

type ExportSection = {
  title: string
  fields: ExportField[]
}

function formatDateForFile(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'master-data-detail'
}

function escapeCsvValue(value: string) {
  const normalized = value.replace(/\r?\n|\r/g, ' ')
  if (/[",]/.test(normalized)) return `"${normalized.replace(/"/g, '""')}"`
  return normalized
}

function splitMultiValue(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function displayValue(field: ExportField) {
  const value = field.value ?? ''
  if (field.type === 'checkbox') return value === 'true' ? 'Yes' : 'No'
  if (field.type === 'select') {
    const optionLabels = Object.fromEntries((field.options ?? []).map((option) => [option.value, option.label]))
    if (field.multiple) {
      const labels = splitMultiValue(value).map((entry) => optionLabels[entry] ?? entry).filter(Boolean)
      return labels.length > 0 ? labels.join(', ') : '-'
    }
    return optionLabels[value] ?? (value || '-')
  }
  return value || '-'
}

function flattenSections(sections: ExportSection[]) {
  return sections.flatMap((section) =>
    section.fields.map((field) => ({
      Section: section.title,
      Field: field.label,
      Value: displayValue(field),
    })),
  )
}

export default function MasterDataDetailExportMenu({
  title,
  sections,
  fileName,
}: {
  title: string
  sections: ExportSection[]
  fileName?: string
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const exportFileName = `${slugify(fileName ?? title)}-${formatDateForFile(new Date())}`
  const rows = flattenSections(sections)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleExportPdf() {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    pdf.setFontSize(14)
    pdf.text(title, 14, 16)
    autoTable(pdf, {
      head: [['Section', 'Field', 'Value']],
      body: rows.map((row) => [row.Section, row.Field, row.Value]),
      startY: 24,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
      margin: { top: 14, right: 10, bottom: 12, left: 10 },
    })
    pdf.save(`${exportFileName}.pdf`)
    setOpen(false)
  }

  function handleExportExcel() {
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 60 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Detail')
    XLSX.writeFile(workbook, `${exportFileName}.xlsx`)
    setOpen(false)
  }

  function handleExportCsv() {
    const lines = [
      ['Section', 'Field', 'Value'],
      ...rows.map((row) => [row.Section, row.Field, row.Value]),
    ].map((line) => line.map(escapeCsvValue).join(','))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${exportFileName}.csv`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm shadow-sm"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Download"
        title="Download"
      >
        <span aria-hidden="true" className="text-base leading-none">⇩</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-36 overflow-hidden rounded-lg border shadow-xl"
          style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
        >
          <button type="button" role="menuitem" onClick={handleExportPdf} className="block w-full px-3 py-2 text-left text-sm hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
            PDF
          </button>
          <button type="button" role="menuitem" onClick={handleExportExcel} className="block w-full border-t px-3 py-2 text-left text-sm hover:bg-white/5" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-muted)' }}>
            Excel
          </button>
          <button type="button" role="menuitem" onClick={handleExportCsv} className="block w-full border-t px-3 py-2 text-left text-sm hover:bg-white/5" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-muted)' }}>
            CSV
          </button>
        </div>
      ) : null}
    </div>
  )
}
