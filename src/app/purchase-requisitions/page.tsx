import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import RequisitionCreateForm from '@/components/RequisitionCreateForm'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { fmtCurrency } from '@/lib/format'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'

const COLS = [
  { id: 'number', label: 'Purchase Req #' },
  { id: 'title', label: 'Title' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'department', label: 'Department' },
  { id: 'vendor', label: 'Preferred Vendor' },
  { id: 'total', label: 'Total' },
  { id: 'needed-by', label: 'Needed By' },
  { id: 'created', label: 'Created' },
  { id: 'actions', label: 'Actions', locked: true },
]

const STATUS_OPTIONS = ['all', 'draft', 'pending approval', 'approved', 'ordered', 'cancelled']
const PRIORITY_LABELS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }

export default async function PurchaseRequisitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
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

  const [requisitions, vendors, departments, entities, currencies, adminUser, companySettings, cabinetFiles] =
    await Promise.all([
      prisma.requisition.findMany({
        where,
        include: { vendor: true, department: true, entity: true, currency: true },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      prisma.vendor.findMany({ orderBy: { name: 'asc' }, where: { inactive: false } }),
      prisma.department.findMany({ orderBy: { name: 'asc' }, where: { active: true } }),
      prisma.entity.findMany({ orderBy: { code: 'asc' }, where: { active: true } }),
      prisma.currency.findMany({ orderBy: { code: 'asc' }, where: { active: true } }),
      prisma.user.findUnique({ where: { email: 'admin@example.com' } }),
      loadCompanyInformationSettings(),
      loadCompanyCabinetFiles(),
    ])

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (statusFilter !== 'all') s.set('status', statusFilter)
    s.set('page', String(p))
    return `/purchase-requisitions?${s.toString()}`
  }

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages =
    cabinetFiles.find((f) => f.id === selectedLogoValue) ??
    cabinetFiles.find((f) => f.originalName === selectedLogoValue) ??
    cabinetFiles.find((f) => f.storedName === selectedLogoValue) ??
    cabinetFiles.find((f) => f.url === selectedLogoValue) ??
    (!selectedLogoValue ? cabinetFiles[0] : undefined)

  return (
    <div className="min-h-full px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? (
          <img src={companyLogoPages.url} alt="Company logo" className="h-16 w-auto rounded" />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Purchase Requisitions</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{total} total</p>
        </div>
        {adminUser ? (
          <CreateModalButton buttonLabel="New Requisition" title="New Purchase Requisition" modalWidthClassName="max-w-2xl">
            <RequisitionCreateForm
              userId={adminUser.id}
              vendors={vendors}
              departments={departments}
              entities={entities.map(({ id, code, name }) => ({ id, code, name }))}
              currencies={currencies.map(({ id, code, name }) => ({ id, code, name }))}
            />
          </CreateModalButton>
        ) : null}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((s) => {
          const active = statusFilter === s
          const href = `/purchase-requisitions?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), status: s, page: '1' }).toString()}`
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

      {/* Table card */}
      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="flex items-center gap-3 border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
          <form method="GET" action="/purchase-requisitions" className="flex flex-1 items-center gap-2">
            <input
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search purchase req #, title, description…"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="status" value={statusFilter} />
            <input type="hidden" name="page" value="1" />
            <div className="flex items-center gap-2">
              <Link href="/purchase-requisitions" className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Reset</Link>
              <ExportButton tableId="requisitions-list" fileName="purchase_requisitions" />
            </div>
            <ColumnSelector tableId="requisitions-list" columns={COLS} />
          </form>
        </div>

        <div className="overflow-x-auto" data-column-selector-table="requisitions-list">
          <table className="min-w-full" id="requisitions-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="number"    className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Purchase Req #</th>
                <th data-column="title"     className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Title</th>
                <th data-column="status"    className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Status</th>
                <th data-column="priority"  className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Priority</th>
                <th data-column="department" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Department</th>
                <th data-column="vendor"    className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Preferred Vendor</th>
                <th data-column="total"     className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Total</th>
                <th data-column="needed-by" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Needed By</th>
                <th data-column="created"   className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
                <th data-column="actions"   className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No purchase requisitions found
                  </td>
                </tr>
              ) : (
                requisitions.map((req, index) => (
                  <tr key={req.id} style={index < requisitions.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="number"     className="px-4 py-2 text-sm font-medium">
                      <Link href={`/purchase-requisitions/${req.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{req.number}</Link>
                    </td>
                    <td data-column="title"      className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{req.title ?? '—'}</td>
                    <td data-column="status"     className="px-4 py-2 text-sm"><StatusBadge status={req.status} /></td>
                    <td data-column="priority"   className="px-4 py-2 text-sm"><PriorityBadge priority={req.priority} /></td>
                    <td data-column="department" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{req.department ? `${req.department.code} – ${req.department.name}` : '—'}</td>
                    <td data-column="vendor"     className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{req.vendor?.name ?? '—'}</td>
                    <td data-column="total"      className="px-4 py-2 text-sm font-medium text-white">{fmtCurrency(req.total)}</td>
                    <td data-column="needed-by"  className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{req.neededByDate ? new Date(req.neededByDate).toLocaleDateString() : '—'}</td>
                    <td data-column="created"    className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(req.createdAt).toLocaleDateString()}</td>
                    <td data-column="actions"    className="px-4 py-2 text-sm">
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
                              options: [
                                { value: 'draft', label: 'Draft' },
                                { value: 'pending approval', label: 'Pending Approval' },
                                { value: 'approved', label: 'Approved' },
                                { value: 'ordered', label: 'Ordered' },
                                { value: 'cancelled', label: 'Cancelled' },
                              ],
                            },
                            {
                              name: 'priority',
                              label: 'Priority',
                              value: req.priority,
                              type: 'select',
                              options: [
                                { value: 'low', label: 'Low' },
                                { value: 'medium', label: 'Medium' },
                                { value: 'high', label: 'High' },
                                { value: 'urgent', label: 'Urgent' },
                              ],
                            },
                            { name: 'neededByDate', label: 'Needed By', value: req.neededByDate ? new Date(req.neededByDate).toISOString().split('T')[0] : '', type: 'date' },
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    draft:             { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' },
    'pending approval': { bg: 'rgba(245,158,11,0.18)', color: '#f59e0b' },
    approved:          { bg: 'rgba(16,185,129,0.18)', color: '#10b981' },
    ordered:           { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    cancelled:         { bg: 'rgba(239,68,68,0.18)', color: '#ef4444' },
  }
  const s = styles[status] ?? styles.draft
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize" style={{ backgroundColor: s.bg, color: s.color }}>
      {status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    low:    { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' },
    medium: { bg: 'rgba(59,130,246,0.18)',  color: 'var(--accent-primary-strong)' },
    high:   { bg: 'rgba(245,158,11,0.18)',  color: '#f59e0b' },
    urgent: { bg: 'rgba(239,68,68,0.18)',   color: '#ef4444' },
  }
  const s = styles[priority] ?? styles.medium
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize" style={{ backgroundColor: s.bg, color: s.color }}>
      {priority}
    </span>
  )
}

