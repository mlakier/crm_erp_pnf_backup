import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { loadListValues } from '@/lib/load-list-values'
import { DEFAULT_RECORD_LIST_SORT, prependIdSortOption } from '@/lib/record-list-sort'

const PURCHASE_ORDER_COLUMNS = [
  { id: 'number', label: 'Purchase Order Id' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'currency', label: 'Currency' },
  { id: 'requisition', label: 'Requisition' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const statusFilter = params.status ?? 'all'
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const sortOptions = prependIdSortOption([
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'total-desc', label: 'Total high-low' },
    { value: 'total-asc', label: 'Total low-high' },
  ])

  const where = {
    ...(query
      ? {
          OR: [
            { number: { contains: query } },
            { status: { contains: query } },
            { vendor: { name: { contains: query } } },
          ],
        }
      : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const orderBy =
    sort === 'id'
      ? [{ number: 'asc' as const }, { createdAt: 'desc' as const }]
      : sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'total-desc'
        ? [{ total: 'desc' as const }]
        : sort === 'total-asc'
          ? [{ total: 'asc' as const }]
          : [{ createdAt: 'desc' as const }]

  const [totalPurchaseOrders, totalSpendAgg, companySettings, cabinetFiles, statusValues] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.aggregate({ where, _sum: { total: true } }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('PO-STATUS'),
  ])

  const STATUS_OPTIONS = ['all', ...statusValues.map(v => v.toLowerCase())]

  const pagination = getPagination(totalPurchaseOrders, params.page)

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where,
    include: { vendor: true, subsidiary: true, currency: true, requisition: true },
    orderBy,
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const totalSpend = totalSpendAgg._sum.total ?? 0

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (statusFilter !== 'all') search.set('status', statusFilter)
    if (sort) search.set('sort', sort)
    search.set('page', String(nextPage))
    return `/purchase-orders?${search.toString()}`
  }

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages =
    cabinetFiles.find((file) => file.id === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.originalName === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.storedName === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.url === selectedLogoValue)
    ?? (!selectedLogoValue ? cabinetFiles[0] : undefined)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? (
          <img
            src={companyLogoPages.url}
            alt="Company logo"
            className="h-16 w-auto rounded"
          />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Purchase Orders</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Track procurement orders, status, and supplier relationships.</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{totalPurchaseOrders} orders, {fmtCurrency(totalSpend)} total spend</p>
        </div>
        <Link
          href="/purchase-orders/new"
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Purchase Order
        </Link>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((s) => {
          const active = statusFilter === s
          const href = `/purchase-orders?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), status: s, page: '1' }).toString()}`
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

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="status" value={statusFilter} />
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search purchase order id, vendor, status"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ExportButton tableId="purchase-orders-list" fileName="purchase-orders" />
            <ColumnSelector tableId="purchase-orders-list" columns={PURCHASE_ORDER_COLUMNS} />
          </div>
        </form>
        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="purchase-orders-list">
          <table className="min-w-full" id="purchase-orders-list">
                  <thead>
                    <tr>
                      {PURCHASE_ORDER_COLUMNS.map((column) => (
                        <th key={column.id} data-column={column.id} className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)', backgroundColor: 'var(--card)' }}>
                          <RecordListHeaderLabel label={column.label} tooltip={'tooltip' in column ? column.tooltip : undefined} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                          No purchase orders found
                        </td>
                      </tr>
                    ) : purchaseOrders.map((po, index) => (
                      <tr key={po.id} style={index < purchaseOrders.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                        <td data-column="number" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <Link href={`/purchase-orders/${po.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                            {po.number}
                          </Link>
                        </td>
                        <td data-column="vendor" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{po.vendor.name}</td>
                        <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{po.status}</td>
                        <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(po.total)}</td>
                        <td data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{(po).subsidiary?.name ?? '—'}</td>
                        <td data-column="currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{(po).currency?.code ?? '—'}</td>
                        <td data-column="requisition" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{(po).requisition?.number ?? '—'}</td>
                        <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(po.createdAt).toLocaleDateString()}</td>
                        <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(po.updatedAt).toLocaleDateString()}</td>
                        <td data-column="actions" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <div className="flex items-center gap-2">
                            <EditButton
                              resource="purchase-orders"
                              id={po.id}
                              fields={[
                                { name: 'status', label: 'Status', value: po.status ?? '', type: 'select', options: statusValues.map((v) => ({ value: v.toLowerCase(), label: v })) },
                                { name: 'total', label: 'Total', value: po.total?.toString() ?? '', type: 'number' },
                              ]}
                            />
                            <DeleteButton resource="purchase-orders" id={po.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationFooter
                startRow={pagination.startRow}
                endRow={pagination.endRow}
                total={totalPurchaseOrders}
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
