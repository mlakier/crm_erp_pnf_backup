import Link from 'next/link'
import type { ReactNode } from 'react'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'

export type MasterDataListColumn = {
  id: string
  label: string
  defaultVisible?: boolean
  locked?: boolean
}

export type MasterDataListSortOption = {
  value: string
  label: string
}

export type MasterDataListToolbarProps = {
  query?: string
  searchPlaceholder: string
  tableId: string
  exportFileName: string
  exportAllUrl?: string
  columns: MasterDataListColumn[]
  sort?: string
  sortOptions?: MasterDataListSortOption[]
  resetHref?: string
  compactExport?: boolean
  extraControls?: ReactNode
}

export default function MasterDataListToolbar({
  query,
  searchPlaceholder,
  tableId,
  exportFileName,
  exportAllUrl,
  columns,
  resetHref,
  compactExport = false,
  extraControls,
}: MasterDataListToolbarProps) {
  return (
    <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
      <div className="flex items-center gap-3 flex-nowrap">
        <input
          type="text"
          name="q"
          defaultValue={query ?? ''}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
          style={{ borderColor: 'var(--border-muted)' }}
        />
        <input type="hidden" name="page" value="1" />
        {resetHref ? (
          <Link
            href={resetHref}
            className="w-24 shrink-0 rounded-md border px-3 py-2 text-sm font-medium text-center"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Reset
          </Link>
        ) : null}
        {extraControls}
        <ExportButton tableId={tableId} fileName={exportFileName} compact={compactExport} exportAllUrl={exportAllUrl} />
        <ColumnSelector tableId={tableId} columns={columns} />
      </div>
    </form>
  )
}
