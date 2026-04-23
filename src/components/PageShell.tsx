import Link from 'next/link'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import type { ReactNode } from 'react'

export type Column = { id: string; label: string; tooltip?: string }

type PageShellProps = {
  /** Page title */
  title: string
  /** Total row count */
  total: number
  /** Table element ID for export / column selector */
  tableId: string
  /** Column definitions */
  columns: Column[]
  /** Current route base, e.g. '/quotes' */
  basePath: string
  /** Search params from the page */
  params: Record<string, string | undefined>
  /** Status filter tabs — pass null to hide */
  statusOptions?: string[] | null
  /** Current status filter value */
  statusFilter?: string
  /** Sort options for the dropdown */
  sortOptions?: Array<{ value: string; label: string }>
  /** Current sort value */
  sort?: string
  /** Content to render in the +New button area (top-right). Pass null to hide. */
  newButton?: ReactNode
  /** Show company logo? default true */
  showLogo?: boolean
  /** Extra search placeholder text */
  searchPlaceholder?: string
  /** Pagination data */
  pagination: {
    startRow: number
    endRow: number
    total: number
    currentPage: number
    totalPages: number
    hasPrevPage: boolean
    hasNextPage: boolean
  }
  /** Table body rows */
  children: ReactNode
}

export default async function PageShell(props: PageShellProps) {
  const {
    title,
    total,
    tableId,
    columns,
    basePath,
    params,
    statusOptions,
    statusFilter = 'all',
    sort = 'newest',
    newButton,
    showLogo = true,
    searchPlaceholder = 'Search...',
    pagination,
    children,
  } = props

  let companyLogoUrl: string | null = null
  if (showLogo) {
    const [companySettings, cabinetFiles] = await Promise.all([
      loadCompanyInformationSettings(),
      loadCompanyCabinetFiles(),
    ])
    const val = companySettings.companyLogoPagesFileId
    const match =
      cabinetFiles.find((f) => f.id === val) ??
      cabinetFiles.find((f) => f.originalName === val) ??
      cabinetFiles.find((f) => f.storedName === val) ??
      cabinetFiles.find((f) => f.url === val) ??
      (!val ? cabinetFiles[0] : undefined)
    companyLogoUrl = match?.url ?? null
  }

  const buildHref = (overrides: Record<string, string>) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (statusFilter !== 'all') s.set('status', statusFilter)
    if (sort) s.set('sort', sort)
    s.set('page', '1')
    for (const [k, v] of Object.entries(overrides)) s.set(k, v)
    return basePath + '?' + s.toString()
  }

  const buildPageHref = (nextPage: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (statusFilter !== 'all') s.set('status', statusFilter)
    if (sort) s.set('sort', sort)
    s.set('page', String(nextPage))
    return basePath + '?' + s.toString()
  }

  return (
    <div className="min-h-full px-8 py-8">
      {/* Header: logo | title+count | +New */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {companyLogoUrl ? (
            <img src={companyLogoUrl} alt="Company logo" className="h-16 w-auto rounded" />
          ) : null}
        </div>
        <div className="text-center flex-1">
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{total} total</p>
        </div>
        <div>{newButton ?? <div className="w-[1px]" />}</div>
      </div>

      {/* Status tabs */}
      {statusOptions && statusOptions.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {statusOptions.map((s) => {
            const active = statusFilter === s
            const href = buildHref({ status: s, page: '1' })
            return (
              <Link
                key={s}
                href={href}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={
                  active
                    ? { backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }
                    : { backgroundColor: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border-muted)' }
                }
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Link>
            )
          })}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        {/* Search + Sort + Export + Columns */}
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder={searchPlaceholder}
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="status" value={statusFilter} />
            <input type="hidden" name="page" value="1" />
            {sort ? <input type="hidden" name="sort" value={sort} /> : null}
            <ExportButton tableId={tableId} fileName={tableId} />
            <ColumnSelector tableId={tableId} columns={columns} />
          </div>
        </form>

        {/* Table body — rendered by parent */}
        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table={tableId}>
          {children}
        </div>

        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={pagination.total}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          hasPrevPage={pagination.hasPrevPage}
          hasNextPage={pagination.hasNextPage}
          prevHref={buildPageHref(pagination.currentPage - 1)}
          nextHref={buildPageHref(pagination.currentPage + 1)}
        />
      </section>
    </div>
  )
}
