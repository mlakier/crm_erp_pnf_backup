'use client'

import RecordGlImpactSection from '@/components/RecordGlImpactSection'
import { fmtCurrency } from '@/lib/format'
import {
  getOrderedVisibleTransactionGlImpactColumns,
  TRANSACTION_GL_IMPACT_COLUMNS,
  type TransactionGlImpactColumnCustomization,
  type TransactionGlImpactRow,
  type TransactionGlImpactSettings,
} from '@/lib/transaction-gl-impact'

function getColumnClassName(
  columnId: keyof TransactionGlImpactRow | keyof TransactionGlImpactColumnCustomization,
  columnCustomization?: Record<string, { widthMode?: string }>,
) {
  const widthMode = columnCustomization?.[columnId as string]?.widthMode ?? 'auto'
  const widthClass =
    widthMode === 'compact'
      ? 'w-24'
      : widthMode === 'normal'
        ? 'w-36'
        : widthMode === 'wide'
          ? 'w-56'
          : ''
  const alignment =
    columnId === 'debit'
    || columnId === 'credit'
    || columnId === 'txnAmount'
    || columnId === 'localAmount'
    || columnId === 'functionalAmount'
    || columnId === 'groupAmount'
      ? 'text-right'
      : ''
  const wrapping = columnId === 'description' ? 'max-w-[260px] whitespace-pre-wrap break-words' : ''
  return [widthClass, alignment, wrapping].filter(Boolean).join(' ')
}

export default function TransactionGlImpactSection({
  rows,
  settings,
  columnCustomization,
  emptyMessage,
  title,
  currencyCodes,
}: {
  rows: TransactionGlImpactRow[]
  settings?: TransactionGlImpactSettings
  columnCustomization?: Record<string, TransactionGlImpactColumnCustomization>
  emptyMessage?: string
  title?: string
  currencyCodes?: {
    transaction?: string | null
    local?: string | null
    functional?: string | null
    group?: string | null
  }
}) {
  const visibleColumns = getOrderedVisibleTransactionGlImpactColumns(
    TRANSACTION_GL_IMPACT_COLUMNS,
    columnCustomization,
  )

  return (
    <RecordGlImpactSection
      title={title}
      rows={rows}
      columns={visibleColumns}
      fontSize={settings?.fontSize === 'sm' ? 'sm' : 'xs'}
      summary={rows.length ? `${rows.length} lines` : undefined}
      emptyMessage={emptyMessage ?? 'No posted accounting impact is linked to this record yet.'}
      getRowKey={(row) => row.id}
      getHeaderClassName={(columnId) => getColumnClassName(columnId, columnCustomization)}
      getCellClassName={(columnId) => getColumnClassName(columnId, columnCustomization)}
      renderCell={(row, columnId) => {
        switch (columnId) {
          case 'date':
            return row.date
          case 'journalNumber':
            return row.journalNumber
          case 'sourceType':
            return row.sourceType
          case 'sourceNumber':
            return row.sourceNumber
          case 'account':
            return row.account
          case 'description':
            return row.description
          case 'debit':
            return row.debit ? fmtCurrency(row.debit, currencyCodes?.transaction ?? undefined) : '-'
          case 'credit':
            return row.credit ? fmtCurrency(row.credit, currencyCodes?.transaction ?? undefined) : '-'
          case 'txnAmount':
            return row.txnAmount ? fmtCurrency(row.txnAmount, currencyCodes?.transaction ?? undefined) : '-'
          case 'localAmount':
            return row.localAmount ? fmtCurrency(row.localAmount, currencyCodes?.local ?? undefined) : '-'
          case 'functionalAmount':
            return row.functionalAmount ? fmtCurrency(row.functionalAmount, currencyCodes?.functional ?? undefined) : '-'
          case 'groupAmount':
            return row.groupAmount ? fmtCurrency(row.groupAmount, currencyCodes?.group ?? undefined) : '-'
          default:
            return '-'
        }
      }}
    />
  )
}
