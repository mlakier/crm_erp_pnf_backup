'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { DetailTableDisplayControl, DetailTablePaginationFooter } from '@/components/DetailTablePaging'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import type { TransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import { saveCommunicationDraft } from '@/lib/communication-draft-store'

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

export default function CommunicationsSection({
  rows,
  compose,
  embedded = false,
  toolbarTargetId,
  extraToolbarActions,
  showDisplayControl = true,
}: {
  rows: CommunicationRow[]
  compose?: TransactionCommunicationComposePayload
  embedded?: boolean
  toolbarTargetId?: string
  extraToolbarActions?: ReactNode
  showDisplayControl?: boolean
}) {
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    date: '',
    direction: '',
    channel: '',
    subject: '',
    from: '',
    to: '',
    status: '',
  })
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const externalToolbarTarget = useMemo(() => {
    if (typeof document === 'undefined' || !toolbarTargetId) return null
    return document.getElementById(toolbarTargetId)
  }, [toolbarTargetId])

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        (Object.entries(filters) as Array<[FilterKey, string]>).every(([key, filterValue]) => {
          if (!filterValue.trim()) return true
          return row[key].toLowerCase().includes(filterValue.trim().toLowerCase())
        })
      ),
    [filters, rows]
  )
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredRows, pageSize]
  )

  function handleOpenComposer() {
    if (!compose || typeof window === 'undefined') return
    const draftKey = saveCommunicationDraft({
      ...compose,
      returnHref: `${window.location.pathname}${window.location.search}`,
    })
    window.location.assign(`/communications/compose?draft=${encodeURIComponent(draftKey)}`)
  }

  const actions = (
    <>
      {extraToolbarActions}
      {showDisplayControl ? (
        <DetailTableDisplayControl
          value={pageSize}
          onChange={(value) => {
            setPageSize(value)
            setPage(1)
          }}
        />
      ) : null}
      {compose ? (
        <button
          type="button"
          onClick={handleOpenComposer}
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          Send Email
        </button>
      ) : null}
    </>
  )

  const content = (
    <>
      {rows.length === 0 ? (
        <RecordDetailEmptyState message={`No communications tracked for this ${compose?.documentLabel?.toLowerCase() ?? 'record'} yet.`} />
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
    </>
  )

  if (embedded) {
    return (
      <>
        {externalToolbarTarget ? createPortal(actions, externalToolbarTarget) : showDisplayControl || compose || extraToolbarActions ? (
          <div className="flex items-center justify-end gap-2 border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
            {actions}
          </div>
        ) : null}
        {content}
      </>
    )
  }

  return (
    <RecordDetailSection
      title="Communications"
      count={filteredRows.length}
      summary={rows.length ? `${rows.length} total` : undefined}
      collapsible
      actions={actions}
    >
      {content}
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
