'use client'

import { useEffect, useRef, useState } from 'react'
import { exportDataToCSV, exportDataToExcel, exportDataToPDF, type ExportDataset } from '@/lib/export-data'
import { exportTableToCSV } from '@/lib/export-csv'
import { exportTableToExcel } from '@/lib/export-excel'
import { exportTableToPDF } from '@/lib/export-pdf'

function formatDateForFile(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ExportButton({
  tableId,
  fileName = 'export',
  compact = false,
  exportAllUrl,
}: {
  tableId: string
  fileName?: string
  compact?: boolean
  exportAllUrl?: string
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [isExportingAll, setIsExportingAll] = useState(false)
  const [exportFullList, setExportFullList] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const exportFileName = `${fileName}-${formatDateForFile(new Date())}`
  const menuItemClassName = `${compact ? 'text-xs' : 'text-sm'} block w-full px-4 py-2 text-left transition-colors`

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchAllDataset = async (): Promise<ExportDataset | null> => {
    if (!exportAllUrl) return null

    setIsExportingAll(true)
    try {
      const response = await fetch(exportAllUrl, { method: 'GET', cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Export request failed with status ${response.status}`)
      }

      const payload = (await response.json()) as ExportDataset
      if (!Array.isArray(payload.headers) || !Array.isArray(payload.rows)) {
        throw new Error('Export response shape was invalid')
      }

      return payload
    } catch (error) {
      console.error('Error exporting full list:', error)
      return null
    } finally {
      setIsExportingAll(false)
      setShowDropdown(false)
    }
  }

  const handleExportExcel = async () => {
    if (exportFullList && exportAllUrl) {
      const dataset = await fetchAllDataset()
      if (dataset) exportDataToExcel(dataset, `${exportFileName}-all`)
      return
    }

    exportTableToExcel(tableId, exportFileName)
    setShowDropdown(false)
  }

  const handleExportCSV = async () => {
    if (exportFullList && exportAllUrl) {
      const dataset = await fetchAllDataset()
      if (dataset) exportDataToCSV(dataset, `${exportFileName}-all`)
      return
    }

    exportTableToCSV(tableId, exportFileName)
    setShowDropdown(false)
  }

  const handleExportPDF = async () => {
    if (exportFullList && exportAllUrl) {
      const dataset = await fetchAllDataset()
      if (dataset) exportDataToPDF(dataset, `${exportFileName}-all`)
      return
    }

    exportTableToPDF(tableId, exportFileName)
    setShowDropdown(false)
  }

  return (
    <div ref={dropdownRef} className="relative inline-block shrink-0 z-50">
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className={`inline-flex items-center justify-between rounded-md border font-medium ${compact ? 'w-24 px-3 py-2 text-xs' : 'w-24 px-3 py-2 text-sm'}`}
        style={{
          borderColor: 'var(--border-muted)',
          color: 'var(--text-secondary)',
          backgroundColor: 'transparent',
          cursor: isExportingAll ? 'wait' : 'pointer',
        }}
        title={exportAllUrl ? 'Export current page or full filtered list' : 'Export visible rows'}
        disabled={isExportingAll}
      >
        <span>{isExportingAll ? 'Working...' : 'Export'}</span>
        <span aria-hidden="true">▼</span>
      </button>

      {showDropdown && (
        <div
          className="absolute right-0 mt-1 w-48 rounded-md border shadow-lg z-50"
          style={{
            borderColor: 'var(--border-muted)',
            backgroundColor: 'var(--background)',
          }}
        >
          {exportAllUrl ? (
            <label
              className={`flex items-center gap-3 border-b px-4 py-3 ${compact ? 'text-xs' : 'text-sm'}`}
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              <input
                type="checkbox"
                checked={exportFullList}
                onChange={(event) => setExportFullList(event.target.checked)}
                className="h-4 w-4"
              />
              <span>Full List</span>
            </label>
          ) : null}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingAll}
            className={menuItemClassName}
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = 'var(--card)'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Export to Excel
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isExportingAll}
            className={menuItemClassName}
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = 'var(--card)'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Export to CSV
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingAll}
            className={`${menuItemClassName} last:rounded-b-md`}
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = 'var(--card)'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Export to PDF
          </button>
        </div>
      )}
    </div>
  )
}
