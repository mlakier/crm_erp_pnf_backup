'use client'

import { useMemo, useState } from 'react'
import { DetailTableDisplayControl, DetailTablePaginationFooter } from '@/components/DetailTablePaging'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import { downloadPurchaseOrderPdf } from '@/lib/purchase-order-pdf'

export type CommunicationRow = {
  id: string
  date: string
  direction: string
  channel: string
  subject: string
  from: string
  to: string
  status: string
}

type FilterKey = 'date' | 'direction' | 'channel' | 'subject' | 'from' | 'to' | 'status'

type PurchaseOrderPdfLine = {
  line: number
  itemId: string
  description: string
  quantity: number
  receivedQuantity: number
  openQuantity: number
  billedQuantity: number
  unitPrice: number
  lineTotal: number
}

export default function CommunicationsSection({
  rows,
  compose,
}: {
  rows: CommunicationRow[]
  compose?: {
    purchaseOrderId: string
    userId?: string | null
    number: string
    vendorName: string
    vendorEmail?: string | null
    fromEmail?: string | null
    status: string
    total: string
    lineItems: PurchaseOrderPdfLine[]
  }
}) {
  const [localRows, setLocalRows] = useState(rows)
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    date: '',
    direction: '',
    channel: '',
    subject: '',
    from: '',
    to: '',
    status: '',
  })
  const [showComposer, setShowComposer] = useState(false)
  const [sending, setSending] = useState(false)
  const [composeError, setComposeError] = useState('')
  const [composeSuccess, setComposeSuccess] = useState('')
  const [preparedMailto, setPreparedMailto] = useState('')
  const [to, setTo] = useState(compose?.vendorEmail ?? '')
  const [subject, setSubject] = useState(compose ? `Purchase Order ${compose.number}` : '')
  const [message, setMessage] = useState(
    compose ? `Please find Purchase Order ${compose.number} for ${compose.vendorName}.` : ''
  )
  const [attachPdf, setAttachPdf] = useState(true)
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const filteredRows = useMemo(
    () =>
      localRows.filter((row) =>
        (Object.entries(filters) as Array<[FilterKey, string]>).every(([key, filterValue]) => {
          if (!filterValue.trim()) return true
          return row[key].toLowerCase().includes(filterValue.trim().toLowerCase())
        })
      ),
    [filters, localRows]
  )
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredRows, pageSize]
  )

  async function handleSendEmail() {
    if (!compose) return
    if (!to.trim() || !subject.trim()) {
      setComposeError('To and Subject are required.')
      return
    }

    setSending(true)
    setComposeError('')
    setComposeSuccess('')

    try {
      const response = await fetch('/api/purchase-orders?action=send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseOrderId: compose.purchaseOrderId,
          userId: compose.userId ?? null,
          to,
          from: compose.fromEmail ?? '',
          subject,
          preview: message,
          attachPdf,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setComposeError(body?.error || 'Unable to prepare email.')
        return
      }

      const optimisticRow: CommunicationRow = {
        id: `local-${Date.now()}`,
        date: new Date().toLocaleString(),
        direction: 'Outbound',
        channel: 'Email',
        subject: subject.trim(),
        from: compose.fromEmail || '-',
        to: to.trim(),
        status: attachPdf ? 'Prepared (PDF)' : 'Prepared',
      }

      setLocalRows((prev) => [optimisticRow, ...prev])
      setShowComposer(false)
      setFilters({
        date: '',
        direction: '',
        channel: '',
        subject: '',
        from: '',
        to: '',
        status: '',
      })
      setPage(1)
      setPreparedMailto(
        `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(message)}`
      )
      setComposeSuccess('Communication logged. Open your mail app if you want to continue sending manually.')

      if (attachPdf) {
        try {
          downloadPurchaseOrderPdf({
            number: compose.number,
            vendorName: compose.vendorName,
            vendorEmail: compose.vendorEmail,
            status: compose.status,
            total: compose.total,
            lines: compose.lineItems,
          })
        } catch {
          // PDF generation should never block communication logging.
        }
      }
    } catch {
      setComposeError('Unable to prepare email.')
    } finally {
      setSending(false)
    }
  }

  return (
    <RecordDetailSection
      title="Communications"
      count={filteredRows.length}
      summary={localRows.length ? `${localRows.length} total` : undefined}
      collapsible
      actions={
        <>
          <DetailTableDisplayControl
            value={pageSize}
            onChange={(value) => {
              setPageSize(value)
              setPage(1)
            }}
          />
          {compose ? (
            <button
              type="button"
              onClick={() => {
                setComposeError('')
                setComposeSuccess('')
                setShowComposer((prev) => !prev)
              }}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              Send Email
            </button>
          ) : null}
        </>
      }
    >
      {showComposer ? (
        <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                To
              </span>
              <input
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Subject
              </span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Message
              </span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={attachPdf}
                onChange={(event) => setAttachPdf(event.target.checked)}
              />
              Attach PDF
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="rounded-md border px-3 py-1.5 text-sm"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sending}
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                {sending ? 'Preparing...' : 'Send Email'}
              </button>
            </div>
          </div>
          {composeError ? (
            <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }}>
              {composeError}
            </p>
          ) : composeSuccess ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm" style={{ color: '#86efac' }}>
                {composeSuccess}
              </p>
              {preparedMailto ? (
                <a
                  href={preparedMailto}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                >
                  Open Mail App
                </a>
              ) : null}
            </div>
          ) : attachPdf ? (
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              PDF will be downloaded so you can attach it in your mail client.
            </p>
          ) : null}
        </div>
      ) : null}

      {localRows.length === 0 ? (
        <RecordDetailEmptyState message="No communications tracked for this purchase order yet." />
      ) : (
        <>
          <table className="min-w-full">
            <thead>
              <tr>
                <RecordDetailHeaderCell>Date</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Direction</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Channel</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Subject</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>From</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>To</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Status</RecordDetailHeaderCell>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <FilterCell value={filters.date} onChange={(value) => {
                  setFilters((prev) => ({ ...prev, date: value }))
                  setPage(1)
                }} />
                <FilterCell
                  value={filters.direction}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, direction: value }))
                    setPage(1)
                  }}
                />
                <FilterCell
                  value={filters.channel}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, channel: value }))
                    setPage(1)
                  }}
                />
                <FilterCell
                  value={filters.subject}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, subject: value }))
                    setPage(1)
                  }}
                />
                <FilterCell value={filters.from} onChange={(value) => {
                  setFilters((prev) => ({ ...prev, from: value }))
                  setPage(1)
                }} />
                <FilterCell value={filters.to} onChange={(value) => {
                  setFilters((prev) => ({ ...prev, to: value }))
                  setPage(1)
                }} />
                <FilterCell
                  value={filters.status}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, status: value }))
                    setPage(1)
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No communications found for the current filters.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, index) => (
                  <tr
                    key={row.id}
                    style={index < pagedRows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
                  >
                    <RecordDetailCell>{row.date}</RecordDetailCell>
                    <RecordDetailCell>{row.direction}</RecordDetailCell>
                    <RecordDetailCell>{row.channel}</RecordDetailCell>
                    <RecordDetailCell className="max-w-[280px] whitespace-pre-wrap break-words">{row.subject}</RecordDetailCell>
                    <RecordDetailCell className="max-w-[220px] whitespace-pre-wrap break-words">{row.from}</RecordDetailCell>
                    <RecordDetailCell className="max-w-[220px] whitespace-pre-wrap break-words">{row.to}</RecordDetailCell>
                    <RecordDetailCell>{row.status}</RecordDetailCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <DetailTablePaginationFooter
            total={filteredRows.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      )}
    </RecordDetailSection>
  )
}

function FilterCell({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <th className="px-2 py-2" style={{ borderBottom: '1px solid var(--border-muted)' }}>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filter"
        className="w-full rounded-md border bg-transparent px-2 py-1 text-xs text-white"
        style={{ borderColor: 'var(--border-muted)' }}
      />
    </th>
  )
}
