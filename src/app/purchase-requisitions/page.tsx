import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { loadListValues } from '@/lib/load-list-values'
import { DEFAULT_RECORD_LIST_SORT, prependIdSortOption } from '@/lib/record-list-sort'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'

const COLS = [
  { id: 'number', label: 'Purchase Req Id' },
  { id: 'title', label: 'Title' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'department', label: 'Department' },
  { id: 'vendor', label: 'Preferred Vendor' },
  { id: 'total', label: 'Total' },
  { id: 'needed-by', label: 'Needed By' },
  { id: 'db-id', label: 'DB Id' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'created', label: 'Created' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function PurchaseRequisitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const { moneySettings } = await loadCompanyDisplaySettings()
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const sortOptions = prependIdSortOption([
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'name', label: 'Name A-Z' },
  ])
  const statusFilter = params.status ?? 'all'

  const where = {
    ...(query
      ? {
          OR: [
            { number: { contains: query } },
            { title: { contains: query } },
            { description: { contains: query } },
          ],
        }
      : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const total = await prisma.requisition.count({ where })
  const pagination = getPagination(total, params.page)

  const [requisitions, companySettings, cabinetFiles, statusValues] = await Promise.all([
    prisma.requisition.findMany({
      where,
      include: { vendor: true, department: true, subsidiary: true, currency: true },
      orderBy:
        sort === 'id'
          ? [{ number: 'asc' as const }, { createdAt: 'desc' as const }]
          : sort === 'oldest'
            ? [{ createdAt: 'asc' as const }]
            : sort === 'name'
              ? [{ title: 'asc' as const }]
              : [{ createdAt: 'desc' as const }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('REQ-STATUS'),
  ])

  const statusOptions = ['all', ...statusValues.map((value) => value.toLowerCase())]

  const buildPageHref = (page: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (statusFilter !== 'all') search.set('status', statusFilter)
    if (sort) search.set('sort', sort)
    search.set('page', String(page))
    return `/purchase-requisitions?${search.toString()}`
  }

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages =
    cabinetFiles.find((file) => file.id === selectedLogoValue) ??
    cabinetFiles.find((file) => file.originalName === selectedLogoValue) ??
    cabinetFiles.find((file) => file.storedName === selectedLogoValue) ??
    cabinetFiles.find((file) => file.url === selectedLogoValue) ??
    (!selectedLogoValue ? cabinetFiles[0] : undefined)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? (
          <img src={companyLogoPages.url} alt="Company logo" className="h-16 w-auto rounded" />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Purchase Requisitions</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {total} total
          </p>
        </div>
        <Link
          href="/purchase-requisitions/new"
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Purchase Requisition
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((status) => {
          const active = statusFilter === status
          const href = `/purchase-requisitions?${new URLSearchParams({
            ...(params.q ? { q: params.q } : {}),
            status,
            page: '1',
          }).toString()}`
          return (
            <Link
              key={status}
              href={href}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={
                active
                  ? { backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }
                  : {
                      backgroundColor: 'var(--card)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-muted)',
                    }
              }
            >
              {status === 'all'
                ? 'All'
                : status
                    .split(' ')
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ')}
            </Link>
          )
        })}
      </div>

      <section
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
      >
        <div className="flex items-center gap-3 border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
          <form method="GET" action="/purchase-requisitions" className="flex flex-1 items-center gap-2">
            <input
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search purchase req id, title, description..."
              className="min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="status" value={statusFilter} />
            <input type="hidden" name="page" value="1" />
            <select
              name="sort"
              defaultValue={sort}
              className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ExportButton tableId="requisitions-list" fileName="purchase_requisitions" />
            <ColumnSelector tableId="requisitions-list" columns={COLS} />
          </form>
        </div>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="requisitions-list">
          <table className="min-w-full" id="requisitions-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {COLS.map((column) => (
                  <th
                    key={column.id}
                    data-column={column.id}
                    className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}
                  >
                    <RecordListHeaderLabel
                      label={column.label}
                      tooltip={'tooltip' in column ? column.tooltip : undefined}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requisitions.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-8 text-center text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    No purchase requisitions found
                  </td>
                </tr>
              ) : (
                requisitions.map((req, index) => (
                  <tr
                    key={req.id}
                    style={index < requisitions.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}
                  >
                    <td data-column="number" className="px-4 py-2 text-sm font-medium">
                      <Link
                        href={`/purchase-requisitions/${req.id}`}
                        className="hover:underline"
                        style={{ color: 'var(--accent-primary-strong)' }}
                      >
                        {req.number}
                      </Link>
                    </td>
                    <td data-column="title" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {req.title ?? '-'}
                    </td>
                    <td data-column="status" className="px-4 py-2 text-sm">
                      <StatusBadge status={req.status} />
                    </td>
                    <td data-column="priority" className="px-4 py-2 text-sm">
                      <PriorityBadge priority={req.priority} />
                    </td>
                    <td data-column="department" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {req.department ? `${req.department.departmentId} - ${req.department.name}` : '-'}
                    </td>
                    <td data-column="vendor" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {req.vendor?.name ?? '-'}
                    </td>
                    <td data-column="total" className="px-4 py-2 text-sm font-medium text-white">
                      {fmtCurrency(req.total, undefined, moneySettings)}
                    </td>
                    <td data-column="needed-by" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {req.neededByDate ? fmtDocumentDate(req.neededByDate, moneySettings) : '-'}
                    </td>
                    <td data-column="db-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {req.id}
                    </td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(req.updatedAt, moneySettings)}
                    </td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(req.createdAt, moneySettings)}
                    </td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="purchase-requisitions"
                          id={req.id}
                          fields={[
                            { name: 'title', label: 'Title', value: req.title ?? '' },
                            {
                              name: 'status',
                              label: 'Status',
                              value: req.status,
                              type: 'select',
                              options: REQUISITION_STATUS_OPTIONS,
                            },
                            {
                              name: 'priority',
                              label: 'Priority',
                              value: req.priority,
                              type: 'select',
                              options: PRIORITY_OPTIONS,
                            },
                            {
                              name: 'neededByDate',
                              label: 'Needed By',
                              value: req.neededByDate
                                ? new Date(req.neededByDate).toISOString().split('T')[0]
                                : '',
                              type: 'date',
                            },
                          ]}
                        />
                        <DeleteButton resource="purchase-requisitions" id={req.id} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={total}
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

const REQUISITION_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    draft: { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' },
    'pending approval': { bg: 'rgba(245,158,11,0.18)', color: '#f59e0b' },
    approved: { bg: 'rgba(16,185,129,0.18)', color: '#10b981' },
    ordered: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    cancelled: { bg: 'rgba(239,68,68,0.18)', color: '#ef4444' },
  }
  const style = styles[status] ?? styles.draft
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    low: { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' },
    medium: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    high: { bg: 'rgba(245,158,11,0.18)', color: '#f59e0b' },
    urgent: { bg: 'rgba(239,68,68,0.18)', color: '#ef4444' },
  }
  const style = styles[priority] ?? styles.medium
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {priority}
    </span>
  )
}
