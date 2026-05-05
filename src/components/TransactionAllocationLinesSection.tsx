'use client'

import Link from 'next/link'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'

export type TransactionAllocationLineRow = {
  id: string
  label: string
  href?: string
  status: string
  date: Date | string
  totalAmount: number
  openAmount: number
  allocatedAmount: number
  currencyCode?: string | null
}

export default function TransactionAllocationLinesSection({
  title,
  rows,
  editing = false,
  moneySettings,
  helperText,
  summary,
  emptyMessage,
  allocationEnabled = true,
  allocationValueById,
  onAllocationChange,
  sourceLabel = 'Bill',
  totalAmountLabel = 'Bill Total',
  openAmountLabel = 'Open Amount',
  allocationAmountLabel = 'Applied Amount',
}: {
  title: string
  rows: TransactionAllocationLineRow[]
  editing?: boolean
  moneySettings?: Parameters<typeof fmtCurrency>[2]
  helperText?: string
  summary?: React.ReactNode
  emptyMessage: string
  allocationEnabled?: boolean
  allocationValueById?: Record<string, string>
  onAllocationChange?: (rowId: string, nextRaw: string) => void
  sourceLabel?: string
  totalAmountLabel?: string
  openAmountLabel?: string
  allocationAmountLabel?: string
}) {
  return (
    <RecordDetailSection
      title={title}
      count={rows.length}
      summary={summary}
      collapsible
      defaultExpanded
    >
      {helperText ? (
        <div className="border-b px-6 py-3 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}>
          {helperText}
        </div>
      ) : null}
      {rows.length === 0 ? (
        <RecordDetailEmptyState message={emptyMessage} />
      ) : (
        <table className="min-w-full">
          <thead>
            <tr>
              <RecordDetailHeaderCell>{sourceLabel}</RecordDetailHeaderCell>
              <RecordDetailHeaderCell>Status</RecordDetailHeaderCell>
              <RecordDetailHeaderCell>Bill Date</RecordDetailHeaderCell>
              <RecordDetailHeaderCell className="text-right">{totalAmountLabel}</RecordDetailHeaderCell>
              <RecordDetailHeaderCell className="text-right">{openAmountLabel}</RecordDetailHeaderCell>
              <RecordDetailHeaderCell className="text-right">{allocationAmountLabel}</RecordDetailHeaderCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                style={index < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
              >
                <RecordDetailCell>
                  {row.href ? (
                    <Link href={row.href} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                      {row.label}
                    </Link>
                  ) : (
                    <span style={{ color: 'var(--accent-primary-strong)' }}>{row.label}</span>
                  )}
                </RecordDetailCell>
                <RecordDetailCell>{row.status}</RecordDetailCell>
                <RecordDetailCell>{fmtDocumentDate(row.date, moneySettings)}</RecordDetailCell>
                <RecordDetailCell className="text-right">{fmtCurrency(row.totalAmount, row.currencyCode ?? undefined, moneySettings)}</RecordDetailCell>
                <RecordDetailCell className="text-right">{fmtCurrency(row.openAmount, row.currencyCode ?? undefined, moneySettings)}</RecordDetailCell>
                <RecordDetailCell className="text-right">
                  {editing ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={allocationValueById?.[row.id] ?? ''}
                      onChange={(event) => onAllocationChange?.(row.id, event.target.value)}
                      disabled={!allocationEnabled}
                      className="w-28 rounded-md border bg-transparent px-3 py-2 text-right text-sm text-white"
                      style={{
                        borderColor: 'var(--border-muted)',
                        opacity: allocationEnabled ? 1 : 0.7,
                        cursor: allocationEnabled ? 'text' : 'not-allowed',
                      }}
                    />
                  ) : (
                    <span style={{ color: 'var(--text-primary)' }}>
                      {fmtCurrency(row.allocatedAmount, row.currencyCode ?? undefined, moneySettings)}
                    </span>
                  )}
                </RecordDetailCell>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </RecordDetailSection>
  )
}
