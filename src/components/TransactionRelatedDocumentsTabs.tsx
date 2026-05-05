'use client'

import { useState, type ReactNode } from 'react'
import { DetailTableDisplayControl, DetailTablePaginationFooter } from '@/components/DetailTablePaging'

export type TransactionRelatedDocumentsTabTone = 'upstream' | 'downstream'

export type TransactionRelatedDocumentsTab = {
  key: string
  label: string
  count: number
  tone: TransactionRelatedDocumentsTabTone
  emptyMessage: string
  headers: string[]
  rows: Array<{
    id: string
    cells: ReactNode[]
    filterValues?: string[]
  }>
}

export function RelatedDocumentsStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const styles: Record<string, { bg: string; color: string }> = {
    paid: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    booked: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    fulfilled: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    accepted: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    approved: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    received: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    pending: { bg: 'rgba(245,158,11,0.16)', color: '#fcd34d' },
    cancelled: { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' },
    sent: { bg: 'rgba(99,102,241,0.18)', color: '#c7d2fe' },
    draft: { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
  }
  const style = styles[s] ?? styles.draft
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status}
    </span>
  )
}

export default function TransactionRelatedDocumentsTabs({
  tabs,
  defaultActiveKey,
  embedded = false,
  showDisplayControl = true,
}: {
  tabs: TransactionRelatedDocumentsTab[]
  defaultActiveKey?: string
  embedded?: boolean
  showDisplayControl?: boolean
}) {
  const firstKey = tabs[0]?.key ?? ''
  const [active, setActive] = useState(defaultActiveKey ?? firstKey)
  const [expanded, setExpanded] = useState(true)
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<string[]>([])
  const activeTab = tabs.find((tab) => tab.key === active) ?? tabs[0]
  const tonePalettes: Record<
    TransactionRelatedDocumentsTabTone,
    {
      activeBorder: string
      activeText: string
      activeBadgeBg: string
      inactiveBadgeBg: string
      inactiveBadgeText: string
      inactiveText: string
    }
  > = {
    upstream: {
      activeBorder: '#f59e0b',
      activeText: '#fcd34d',
      activeBadgeBg: 'rgba(245,158,11,0.16)',
      inactiveBadgeBg: 'rgba(245,158,11,0.1)',
      inactiveBadgeText: '#d1a24a',
      inactiveText: '#d8b86a',
    },
    downstream: {
      activeBorder: 'var(--accent-primary-strong)',
      activeText: '#93c5fd',
      activeBadgeBg: 'rgba(59,130,246,0.18)',
      inactiveBadgeBg: 'rgba(59,130,246,0.1)',
      inactiveBadgeText: '#7fb0f8',
      inactiveText: '#8ab4f8',
    },
  }

  const filteredRows = (activeTab?.rows ?? []).filter((row) =>
    activeTab.headers.every((_, index) => {
      const filterValue = (filters[index] ?? '').trim().toLowerCase()
      if (!filterValue) return true
      const candidate = (row.filterValues?.[index] ?? '').toLowerCase()
      return candidate.includes(filterValue)
    })
  )
  const totalRows = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const toolbar = showDisplayControl ? (
    <DetailTableDisplayControl
      value={pageSize}
      onChange={(value) => {
        setPageSize(value)
        setPage(1)
      }}
    />
  ) : null

  const tabButtons = expanded ? (
    <div className="flex overflow-x-auto overflow-y-hidden">
      {tabs.map((tab) => {
        const isActive = active === tab.key
        const palette = tonePalettes[tab.tone]

              return (
                <button
                  key={tab.key}
                  type="button"
            onClick={() => {
              setActive(tab.key)
              setPage(1)
              setFilters([])
            }}
            className="flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px"
            style={{
              borderColor: isActive ? palette.activeBorder : 'transparent',
              color: isActive ? palette.activeText : palette.inactiveText,
            }}
                >
                  {tab.label} {tab.tone === 'upstream' ? '↑' : '↓'}
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                backgroundColor: isActive ? palette.activeBadgeBg : palette.inactiveBadgeBg,
                color: isActive ? palette.activeText : palette.inactiveBadgeText,
              }}
            >
              {tab.count}
            </span>
          </button>
        )
      })}
    </div>
  ) : null

  const body =
    expanded && activeTab ? (
      <div className="overflow-x-auto overflow-y-hidden">
        {activeTab.rows.length === 0 ? (
          <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            {activeTab.emptyMessage}
          </p>
        ) : (
          <>
            {!embedded && toolbar ? (
              <div
                className="flex items-center justify-end border-b px-6 py-4"
                style={{ borderColor: 'var(--border-muted)' }}
              >
                {toolbar}
              </div>
            ) : null}
            <table className="min-w-full">
              <thead>
                <tr>
                  {activeTab.headers.map((header) => (
                    <th
                      key={header}
                      className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  {activeTab.headers.map((header, index) => (
                    <th key={`${header}-filter`} className="px-2 py-2" style={{ borderBottom: '1px solid var(--border-muted)' }}>
                      <input
                        type="text"
                        value={filters[index] ?? ''}
                        onChange={(event) => {
                          const next = [...filters]
                          next[index] = event.target.value
                          setFilters(next)
                          setPage(1)
                        }}
                        placeholder="Filter"
                        className="w-full rounded-md border bg-transparent px-2 py-1 text-xs text-white"
                        style={{ borderColor: 'var(--border-muted)' }}
                        aria-label={`Filter ${header}`}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab.headers.length} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      No related documents found for the current filters.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row) => (
                    <tr key={row.id}>
                      {row.cells.map((cell, index) => (
                        <td key={`${row.id}-${index}`} className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {cell}
                        </td>
                      ))}
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
      </div>
    ) : null

  if (embedded) {
    return (
      <>
        <div className="border-b px-6 py-0" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">{tabButtons}</div>
            {toolbar ? <div className="flex shrink-0 items-center py-2">{toolbar}</div> : null}
          </div>
        </div>
        {body}
      </>
    )
  }

  return (
    <div
      className="mb-6 overflow-hidden rounded-xl border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
    >
      <div className="border-b px-6 pt-5 pb-0" style={{ borderColor: 'var(--border-muted)' }}>
        <div className="mb-3 flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Related Documents
          </p>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-md px-1.5 py-0.5 text-xs"
            style={{ color: 'var(--text-muted)' }}
            aria-label={expanded ? 'Collapse Related Documents' : 'Expand Related Documents'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        </div>
        {tabButtons}
      </div>
      {body}
    </div>
  )
}
