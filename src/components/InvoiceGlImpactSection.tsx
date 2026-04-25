'use client'

import { useMemo, useState } from 'react'
import { DetailTableDisplayControl, DetailTablePaginationFooter } from '@/components/DetailTablePaging'
import { RecordDetailCell, RecordDetailEmptyState, RecordDetailHeaderCell, RecordDetailSection } from '@/components/RecordDetailPanels'
import { fmtCurrency } from '@/lib/format'

export type InvoiceGlImpactRow = {
  id: string
  journalNumber: string
  date: string
  sourceType: string
  sourceNumber: string
  account: string
  description: string
  debit: number
  credit: number
}

export default function InvoiceGlImpactSection({ rows }: { rows: InvoiceGlImpactRow[] }) {
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, pageSize, rows],
  )

  return (
    <RecordDetailSection
      title="GL Impact"
      count={rows.length}
      summary={rows.length ? `${rows.length} lines` : undefined}
      collapsible
      actions={
        <DetailTableDisplayControl
          value={pageSize}
          onChange={(value) => {
            setPageSize(value)
            setPage(1)
          }}
        />
      }
    >
      {rows.length === 0 ? (
        <RecordDetailEmptyState message="No posted accounting impact is linked to this invoice yet." />
      ) : (
        <>
          <table className="min-w-full">
            <thead>
              <tr>
                <RecordDetailHeaderCell>Date</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Journal #</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Source</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Source Txn</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Account</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Description</RecordDetailHeaderCell>
                <RecordDetailHeaderCell className="text-right">Debit</RecordDetailHeaderCell>
                <RecordDetailHeaderCell className="text-right">Credit</RecordDetailHeaderCell>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, index) => (
                <tr
                  key={row.id}
                  style={index < pagedRows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
                >
                  <RecordDetailCell>{row.date}</RecordDetailCell>
                  <RecordDetailCell>{row.journalNumber}</RecordDetailCell>
                  <RecordDetailCell>{row.sourceType}</RecordDetailCell>
                  <RecordDetailCell>{row.sourceNumber}</RecordDetailCell>
                  <RecordDetailCell>{row.account}</RecordDetailCell>
                  <RecordDetailCell className="max-w-[260px] whitespace-pre-wrap break-words">{row.description}</RecordDetailCell>
                  <RecordDetailCell className="text-right">{row.debit ? fmtCurrency(row.debit) : '-'}</RecordDetailCell>
                  <RecordDetailCell className="text-right">{row.credit ? fmtCurrency(row.credit) : '-'}</RecordDetailCell>
                </tr>
              ))}
            </tbody>
          </table>
          <DetailTablePaginationFooter total={rows.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} />
        </>
      )}
    </RecordDetailSection>
  )
}
