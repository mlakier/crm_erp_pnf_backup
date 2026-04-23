'use client'

import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { downloadPurchaseOrderPdf } from '@/lib/purchase-order-pdf'

type ExportHeaderField = {
  label: string
  value: string
}

type ExportHeaderMap = {
  purchaseOrderNumber: string
  vendorNumber: string
  vendorName: string
  subsidiary: string
  status: string
  total: string
  createdBy: string
  createdFrom: string
  approvedBy: string
}

type ExportLineRow = {
  line: number
  itemId: string
  itemName: string
  description: string
  quantity: number
  receivedQuantity: number
  openQuantity: number
  billedQuantity: number
  unitPrice: number
  lineTotal: number
}

function formatDateForFile(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function escapeCsvValue(value: string) {
  const normalized = value.replace(/\r?\n|\r/g, ' ')
  if (/[",]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }
  return normalized
}

export default function PurchaseOrderDetailExportButton({
  number,
  vendorName,
  vendorEmail,
  status,
  total,
  headerFields,
  headerMap,
  lineItems,
}: {
  number: string
  vendorName: string
  vendorEmail?: string | null
  status: string
  total: string
  headerFields: ExportHeaderField[]
  headerMap: ExportHeaderMap
  lineItems: ExportLineRow[]
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const exportFileName = `purchase-order-${number}-${formatDateForFile(new Date())}`

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
    downloadPurchaseOrderPdf({
      number,
      vendorName,
      vendorEmail,
      status,
      total,
      lines: lineItems,
    })
    setOpen(false)
  }

  function handleExportCsv() {
    const importHeaders = [
      'purchaseOrderNumber',
      'vendorNumber',
      'vendorName',
      'subsidiary',
      'status',
      'total',
      'createdBy',
      'createdFrom',
      'approvedBy',
      'lineNumber',
      'itemId',
      'itemName',
      'description',
      'quantity',
      'receivedQuantity',
      'openQuantity',
      'billedQuantity',
      'unitPrice',
      'lineTotal',
    ]
    const lines: string[] = []
    lines.push(importHeaders.map(escapeCsvValue).join(','))

    const exportRows = lineItems.length > 0 ? lineItems : [{
      line: 1,
      itemId: '',
      itemName: '',
      description: '',
      quantity: 0,
      receivedQuantity: 0,
      openQuantity: 0,
      billedQuantity: 0,
      unitPrice: 0,
      lineTotal: 0,
    }]

    exportRows.forEach((row) => {
      lines.push(
        [
          headerMap.purchaseOrderNumber,
          headerMap.vendorNumber,
          headerMap.vendorName,
          headerMap.subsidiary,
          headerMap.status,
          headerMap.total,
          headerMap.createdBy,
          headerMap.createdFrom,
          headerMap.approvedBy,
          String(row.line),
          row.itemId,
          row.itemName,
          row.description,
          String(row.quantity),
          String(row.receivedQuantity),
          String(row.openQuantity),
          String(row.billedQuantity),
          row.unitPrice ? row.unitPrice.toFixed(2) : '',
          row.lineTotal ? row.lineTotal.toFixed(2) : '',
        ]
          .map(escapeCsvValue)
          .join(',')
      )
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${exportFileName}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  function handleExportExcel() {
    const workbook = XLSX.utils.book_new()

    const importRows = (lineItems.length > 0 ? lineItems : [{
      line: 1,
      itemId: '',
      itemName: '',
      description: '',
      quantity: 0,
      receivedQuantity: 0,
      openQuantity: 0,
      billedQuantity: 0,
      unitPrice: 0,
      lineTotal: 0,
    }]).map((row) => ({
      purchaseOrderNumber: headerMap.purchaseOrderNumber,
      vendorNumber: headerMap.vendorNumber,
      vendorName: headerMap.vendorName,
      subsidiary: headerMap.subsidiary,
      status: headerMap.status,
      total: headerMap.total,
      createdBy: headerMap.createdBy,
      createdFrom: headerMap.createdFrom,
      approvedBy: headerMap.approvedBy,
      lineNumber: row.line,
      itemId: row.itemId,
      itemName: row.itemName,
      description: row.description,
      quantity: row.quantity,
      receivedQuantity: row.receivedQuantity,
      openQuantity: row.openQuantity,
      billedQuantity: row.billedQuantity,
      unitPrice: row.unitPrice || '',
      lineTotal: row.lineTotal || '',
    }))

    const importSheet = XLSX.utils.json_to_sheet(importRows)
    importSheet['!cols'] = [
      { wch: 20 },
      { wch: 18 },
      { wch: 28 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 24 },
      { wch: 20 },
      { wch: 24 },
      { wch: 10 },
      { wch: 14 },
      { wch: 24 },
      { wch: 40 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ]
    XLSX.utils.book_append_sheet(workbook, importSheet, 'Import Rows')

    const detailSheet = XLSX.utils.aoa_to_sheet([
      ['Purchase Order', number],
      ['Vendor', vendorName],
      ['Status', status],
      ['Total', total],
      [],
      ['Field', 'Value'],
      ...headerFields.map((field) => [field.label, field.value]),
    ])
    detailSheet['!cols'] = [{ wch: 24 }, { wch: 48 }]
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Details')

    XLSX.writeFile(workbook, `${exportFileName}.xlsx`)
    setOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative inline-block z-50">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-md border px-3 py-2 text-sm font-medium"
        style={{
          borderColor: 'var(--border-muted)',
          color: 'var(--text-secondary)',
          backgroundColor: 'transparent',
        }}
      >
        Export ▼
      </button>

      {open ? (
        <div
          className="absolute right-0 mt-1 w-40 rounded-md border shadow-lg"
          style={{
            borderColor: 'var(--border-muted)',
            backgroundColor: 'var(--background)',
          }}
        >
          <button
            type="button"
            onClick={handleExportExcel}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            style={{ color: 'var(--text-secondary)' }}
          >
            Export to Excel
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            style={{ color: 'var(--text-secondary)' }}
          >
            Export to CSV
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            style={{ color: 'var(--text-secondary)' }}
          >
            Export to PDF
          </button>
        </div>
      ) : null}
    </div>
  )
}
