'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { DetailTableDisplayControl, DetailTablePaginationFooter } from '@/components/DetailTablePaging'
import { RecordDetailCell, RecordDetailEmptyState, RecordDetailHeaderCell, RecordDetailSection } from '@/components/RecordDetailPanels'

export type SystemNoteRow = {
  id: string
  date: string
  setBy: string
  context: string
  fieldName: string
  oldValue: string
  newValue: string
}

type FilterKey = 'date' | 'setBy' | 'context' | 'fieldName' | 'oldValue' | 'newValue'

export default function SystemNotesSection({
  notes,
  embedded = false,
  toolbarTargetId,
  showDisplayControl = true,
}: {
  notes: SystemNoteRow[]
  embedded?: boolean
  toolbarTargetId?: string
  showDisplayControl?: boolean
}) {
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    date: '',
    setBy: '',
    context: '',
    fieldName: '',
    oldValue: '',
    newValue: '',
  })
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const externalToolbarTarget = useMemo(() => {
    if (typeof document === 'undefined' || !toolbarTargetId) return null
    return document.getElementById(toolbarTargetId)
  }, [toolbarTargetId])

  const filteredNotes = useMemo(
    () =>
      notes.filter((note) =>
        (Object.entries(filters) as Array<[FilterKey, string]>).every(([key, filterValue]) => {
          if (!filterValue.trim()) return true
          return note[key].toLowerCase().includes(filterValue.trim().toLowerCase())
        })
      ),
    [filters, notes]
  )
  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedNotes = useMemo(
    () => filteredNotes.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredNotes, pageSize]
  )

  const actions = showDisplayControl ? (
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
      {notes.length === 0 ? (
        <RecordDetailEmptyState message="No system notes yet." />
      ) : (
        <>
          <table className="min-w-full">
            <thead>
              <tr>
                <RecordDetailHeaderCell>Date</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Set By</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Context</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Field Name</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Old Value</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>New Value</RecordDetailHeaderCell>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <FilterCell
                  value={filters.date}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, date: value }))
                    setPage(1)
                  }}
                />
                <FilterCell
                  value={filters.setBy}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, setBy: value }))
                    setPage(1)
                  }}
                />
                <FilterCell
                  value={filters.context}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, context: value }))
                    setPage(1)
                  }}
                />
                <FilterCell
                  value={filters.fieldName}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, fieldName: value }))
                    setPage(1)
                  }}
                />
                <FilterCell
                  value={filters.oldValue}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, oldValue: value }))
                    setPage(1)
                  }}
                />
                <FilterCell
                  value={filters.newValue}
                  onChange={(value) => {
                    setFilters((prev) => ({ ...prev, newValue: value }))
                    setPage(1)
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No system notes found for the current filters.
                  </td>
                </tr>
              ) : (
                pagedNotes.map((note, index) => (
                  <tr
                    key={note.id}
                    style={index < pagedNotes.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
                  >
                    <RecordDetailCell>{note.date}</RecordDetailCell>
                    <RecordDetailCell>{note.setBy}</RecordDetailCell>
                    <RecordDetailCell>{note.context}</RecordDetailCell>
                    <RecordDetailCell>{note.fieldName}</RecordDetailCell>
                    <RecordDetailCell className="max-w-[240px] whitespace-pre-wrap break-words">{note.oldValue}</RecordDetailCell>
                    <RecordDetailCell className="max-w-[240px] whitespace-pre-wrap break-words">{note.newValue}</RecordDetailCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <DetailTablePaginationFooter
            total={filteredNotes.length}
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
        {externalToolbarTarget && actions ? createPortal(actions, externalToolbarTarget) : actions ? (
          <div className="flex items-center justify-end border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
            {actions}
          </div>
        ) : null}
        {content}
      </>
    )
  }

  return (
    <RecordDetailSection
      title="System Notes"
      count={filteredNotes.length}
      summary={notes.length ? `${notes.length} total` : undefined}
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
