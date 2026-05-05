'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DetailTableDisplayControl, DetailTablePaginationFooter } from '@/components/DetailTablePaging'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'

export type RelatedRecordRow = {
  id: string
  type: string
  reference: string
  name: string
  details: string
  href?: string | null
}

export type RelatedRecordsTab = {
  key: string
  label: string
  count: number
  emptyMessage: string
  rows: RelatedRecordRow[]
}

type FilterKey = 'type' | 'reference' | 'name' | 'details'

export default function RelatedRecordsSection({
  tabs,
  embedded = false,
  showDisplayControl = true,
}: {
  tabs: RelatedRecordsTab[]
  embedded?: boolean
  showDisplayControl?: boolean
}) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key ?? '')
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    type: '',
    reference: '',
    name: '',
    details: '',
  })
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const activeTab = tabs.find((tab) => tab.key === activeKey) ?? tabs[0]
  const totalCount = tabs.reduce((sum, tab) => sum + tab.count, 0)

  const filteredRows = useMemo(
    () =>
      (activeTab?.rows ?? []).filter((row) =>
        (Object.entries(filters) as Array<[FilterKey, string]>).every(([key, filterValue]) => {
          if (!filterValue.trim()) return true
          return row[key].toLowerCase().includes(filterValue.trim().toLowerCase())
        }),
      ),
    [activeTab?.rows, filters],
  )

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredRows, pageSize],
  )

  if (!tabs.length || !activeTab) return null

  const toolbar = showDisplayControl ? (
    <DetailTableDisplayControl
      value={pageSize}
      onChange={(value) => {
        setPageSize(value)
        setPage(1)
      }}
    />
  ) : null

  const content = (
    <>
      <div className="border-b px-6 py-0" style={{ borderColor: 'var(--border-muted)' }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 overflow-x-auto overflow-y-hidden">
            {tabs.map((tab) => {
              const isActive = tab.key === activeKey
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveKey(tab.key)
                    setFilters({
                      type: '',
                      reference: '',
                      name: '',
                      details: '',
                    })
                    setPage(1)
                  }}
                  className="flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px"
                  style={{
                    borderColor: isActive ? 'var(--accent-primary-strong)' : 'transparent',
                    color: isActive ? '#93c5fd' : '#8ab4f8',
                  }}
                >
                  {tab.label}
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: isActive ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.1)',
                      color: isActive ? '#93c5fd' : '#7fb0f8',
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
          {toolbar ? <div className="flex shrink-0 items-center py-2">{toolbar}</div> : null}
        </div>
      </div>
      {activeTab.rows.length === 0 ? (
        <RecordDetailEmptyState message={activeTab.emptyMessage} />
      ) : (
        <>
          <table className="min-w-full">
            <thead>
              <tr>
                <RecordDetailHeaderCell>Type</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Reference</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Details</RecordDetailHeaderCell>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <FilterCell
                  value={filters.type}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, type: value }))
                    setPage(1)
                  }}
                />
                <FilterCell
                  value={filters.reference}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, reference: value }))
                    setPage(1)
                  }}
                />
                <FilterCell
                  value={filters.name}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, name: value }))
                    setPage(1)
                  }}
                />
                <FilterCell
                  value={filters.details}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, details: value }))
                    setPage(1)
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No related records found for the current filters.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, index) => (
                  <tr
                    key={row.id}
                    style={index < pagedRows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
                  >
                    <RecordDetailCell>{row.type}</RecordDetailCell>
                    <RecordDetailCell>
                      {row.href ? (
                        <Link href={row.href} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {row.reference}
                        </Link>
                      ) : (
                        row.reference
                      )}
                    </RecordDetailCell>
                    <RecordDetailCell>{row.name}</RecordDetailCell>
                    <RecordDetailCell className="max-w-[280px] whitespace-pre-wrap break-words">{row.details}</RecordDetailCell>
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
    return content
  }

  return (
    <RecordDetailSection
      title="Related Records"
      count={totalCount}
      summary={totalCount ? `${totalCount} total` : undefined}
      collapsible
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
