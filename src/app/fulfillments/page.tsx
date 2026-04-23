import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import FulfillmentCreateForm from '@/components/FulfillmentCreateForm'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { DEFAULT_RECORD_LIST_SORT, prependIdSortOption } from '@/lib/record-list-sort'
import { loadListValues } from '@/lib/load-list-values'

const FULFILLMENT_COLUMNS = [
  { id: 'number', label: 'Fulfillment Id' },
  { id: 'sales-order', label: 'Sales Order' },
  { id: 'customer', label: 'Customer' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Date' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'currency', label: 'Currency' },
  { id: 'notes', label: 'Notes' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function FulfillmentsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string }> }) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const statusFilter = params.status ?? 'all'
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const sortOptions = prependIdSortOption([
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
  ])
  const where: Prisma.FulfillmentWhereInput = {
    ...(query ? { OR: [{ number: { contains: query } }, { status: { contains: query } }] } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const orderBy = sort === 'id' ? [{ number: 'asc' as const }, { createdAt: 'desc' as const }] : sort === 'oldest' ? [{ createdAt: 'asc' as const }] : [{ createdAt: 'desc' as const }]

  const [totalRows, salesOrders, companySettings, cabinetFiles, statusValues] = await Promise.all([
    prisma.fulfillment.count({ where }),
    prisma.salesOrder.findMany({ include: { customer: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('FULFILL-STATUS'),
  ])
  const STATUS_OPTIONS = ['all', ...statusValues.map((value) => value.toLowerCase())]
  const statusOptions = statusValues.map((value) => ({ value: value.toLowerCase(), label: value }))

  const pagination = getPagination(totalRows, params.page)
  const rows = await prisma.fulfillment.findMany({ where, include: { salesOrder: { include: { customer: true } }, subsidiary: true, currency: true }, orderBy, skip: pagination.skip, take: pagination.pageSize })

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (statusFilter !== 'all') s.set('status', statusFilter)
    if (sort) s.set('sort', sort)
    s.set('page', String(p))
    return '/fulfillments?' + s.toString()
  }

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages = cabinetFiles.find((f) => f.id === selectedLogoValue) ?? cabinetFiles.find((f) => f.originalName === selectedLogoValue) ?? cabinetFiles.find((f) => f.storedName === selectedLogoValue) ?? (!selectedLogoValue ? cabinetFiles[0] : undefined)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? <img src={companyLogoPages.url} alt="Company logo" className="h-16 w-auto rounded" /> : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Fulfillments</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalRows} total</p>
        </div>
        <CreateModalButton buttonLabel="New Fulfillment" title="New Fulfillment">
          <FulfillmentCreateForm salesOrders={salesOrders.map((so) => ({ id: so.id, label: so.number + ' - ' + so.customer.name }))} statusOptions={statusOptions} />
        </CreateModalButton>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((s) => {
          const active = statusFilter === s
          const href = '/fulfillments?' + new URLSearchParams({ ...(params.q ? { q: params.q } : {}), status: s, page: '1' }).toString()
          return <Link key={s} href={href} className="rounded-full px-3 py-1 text-xs font-medium transition-colors" style={active ? { backgroundColor: 'var(--accent-primary-strong)', color: '#fff' } : { backgroundColor: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border-muted)' }}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</Link>
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" /><input type="hidden" name="status" value={statusFilter} />
          <div className="flex gap-3 items-center flex-nowrap">
            <input type="text" name="q" defaultValue={params.q ?? ''} placeholder="Search fulfillment id, status" className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <ExportButton tableId="fulfillments-list" fileName="fulfillments" />
            <ColumnSelector tableId="fulfillments-list" columns={FULFILLMENT_COLUMNS} />
          </div>
        </form>
        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="fulfillments-list">
          <table className="min-w-full" id="fulfillments-list">
            <thead><tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
              {FULFILLMENT_COLUMNS.map((c) => (
                <th key={c.id} data-column={c.id} className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>
                  <RecordListHeaderLabel label={c.label} tooltip={'tooltip' in c ? c.tooltip : undefined} />
                </th>
              ))}
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No fulfillments yet.</td></tr>
              ) : rows.map((row, i) => (
                <tr key={row.id} style={i < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                  <td data-column="number" className="px-4 py-2 text-sm font-medium" style={{ color: 'var(--accent-primary-strong)' }}>{row.number}</td>
                  <td data-column="sales-order" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.salesOrder?.number ?? '\u2014'}</td>
                  <td data-column="customer" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.salesOrder?.customer?.name ?? '\u2014'}</td>
                  <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.status}</td>
                  <td data-column="date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(row.date).toLocaleDateString()}</td>
                  <td data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.subsidiary?.name ?? '\u2014'}</td>
                  <td data-column="currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.currency?.code ?? '\u2014'}</td>
                  <td data-column="notes" className="px-4 py-2 text-sm truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>{row.notes ?? '\u2014'}</td>
                  <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(row.updatedAt).toLocaleDateString()}</td>
                  <td data-column="actions" className="px-4 py-2 text-sm"><span className="flex items-center gap-2">
                    <EditButton id={row.id} endpoint="/api/fulfillments" fields={[{ name: 'status', label: 'Status', type: 'select', value: row.status, options: statusOptions }, { name: 'notes', label: 'Notes', type: 'text', value: row.notes ?? '' }]} />
                    <DeleteButton id={row.id} endpoint="/api/fulfillments" label={row.number} />
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationFooter startRow={pagination.startRow} endRow={pagination.endRow} total={totalRows} currentPage={pagination.currentPage} totalPages={pagination.totalPages} hasPrevPage={pagination.hasPrevPage} hasNextPage={pagination.hasNextPage} prevHref={buildPageHref(pagination.currentPage - 1)} nextHref={buildPageHref(pagination.currentPage + 1)} />
      </section>
    </div>
  )
}
