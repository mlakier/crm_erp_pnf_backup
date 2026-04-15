'use client'

import { useState, useRef, useEffect } from 'react'
import { exportTableToExcel } from '@/lib/export-excel'
import { exportTableToPDF } from '@/lib/export-pdf'
import { exportTableToCSV } from '@/lib/export-csv'

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
}: {
  tableId: string
  fileName?: string
  compact?: boolean
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const exportFileName = `${fileName}-${formatDateForFile(new Date())}`

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExportExcel = () => {
    exportTableToExcel(tableId, exportFileName)
    setShowDropdown(false)
  }

  const handleExportPDF = () => {
    exportTableToPDF(tableId, exportFileName)
    setShowDropdown(false)
  }

  const handleExportCSV = () => {
    exportTableToCSV(tableId, exportFileName)
    setShowDropdown(false)
  }

  return (
    <div ref={dropdownRef} className="relative inline-block z-50">
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className={`rounded-md border font-medium ${compact ? 'px-3 py-2 text-xs' : 'px-3 py-2 text-sm'}`}
        style={{
          borderColor: 'var(--border-muted)',
          color: 'var(--text-secondary)',
          backgroundColor: 'transparent',
          cursor: 'pointer',
        }}
        title="Export visible rows"
      >
        Export ▼
      </button>

      {showDropdown && (
        <div
          className="absolute right-0 mt-1 w-40 rounded-md border shadow-lg z-50"
          style={{
            borderColor: 'var(--border-muted)',
            backgroundColor: 'var(--background)',
          }}
        >
          <button
            type="button"
            onClick={handleExportExcel}
            className={`block w-full text-left px-4 py-2 hover:bg-gray-100 first:rounded-t-md ${compact ? 'text-xs' : 'text-sm'}`}
            style={{
              color: 'var(--text-secondary)',
            }}
          >
            Export to Excel
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${compact ? 'text-xs' : 'text-sm'}`}
            style={{
              color: 'var(--text-secondary)',
            }}
          >
            Export to CSV
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className={`block w-full text-left px-4 py-2 hover:bg-gray-100 last:rounded-b-md ${compact ? 'text-xs' : 'text-sm'}`}
            style={{
              color: 'var(--text-secondary)',
            }}
          >
            Export to PDF
          </button>
        </div>
      )}
    </div>
  )
}
