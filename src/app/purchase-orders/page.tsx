import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import CreateModalButton from '@/components/CreateModalButton'
import PurchaseOrderCreateForm from '@/components/PurchaseOrderCreateForm'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import ColumnSelector from '@/components/ColumnSelector'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'

const PURCHASE_ORDER_COLUMNS = [
  { id: 'number', label: 'Number' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
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
  const sort = params.sort ?? 'newest'

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
    sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'total-desc'
        ? [{ total: 'desc' as const }]
        : sort === 'total-asc'
          ? [{ total: 'asc' as const }]
          : [{ createdAt: 'desc' as const }]

  const [totalPurchaseOrders, vendors, adminUser, totalSpendAgg] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.vendor.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findUnique({ where: { email: 'admin@example.com' } }),
    prisma.purchaseOrder.aggregate({ where, _sum: { total: true } }),
  ])

  const pagination = getPagination(totalPurchaseOrders, params.page)

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where,
    include: { vendor: true },
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

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Purchase Orders</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Track procurement orders, status, and supplier relationships.</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{totalPurchaseOrders} orders, {fmtCurrency(totalSpend)} total spend</p>
        </div>
        {adminUser ? (
          <CreateModalButton buttonLabel="New Purchase Order" title="New Purchase Order">
            <PurchaseOrderCreateForm userId={adminUser.id} vendors={vendors} />
          </CreateModalButton>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
              <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
                <input
                  type="text"
                  name="q"
                  defaultValue={params.q ?? ''}
                  placeholder="Search PO ID, vendor, status"
                  className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                />
                <select name="status" defaultValue={statusFilter} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending approval">Pending approval</option>
                  <option value="approved">Approved</option>
                  <option value="sent">Sent</option>
                  <option value="received">Received</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="total-desc">Total high-low</option>
                  <option value="total-asc">Total low-high</option>
                </select>
                <input type="hidden" name="page" value="1" />
                <div className="flex items-center gap-2">
                  <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium" style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }}>Apply</button>
                  <Link href="/purchase-orders" className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Reset</Link>
                </div>
                <ColumnSelector tableId="purchase-orders-list" columns={PURCHASE_ORDER_COLUMNS} />
                </div>
              </form>
              <div className="overflow-x-auto" data-column-selector-table="purchase-orders-list">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th data-column="number" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)', backgroundColor: 'var(--card)' }}>Number</th>
                      <th data-column="vendor" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)', backgroundColor: 'var(--card)' }}>Vendor</th>
                      <th data-column="status" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)', backgroundColor: 'var(--card)' }}>Status</th>
                      <th data-column="total" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)', backgroundColor: 'var(--card)' }}>Total</th>
                      <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
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
                        <td data-column="actions" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <div className="flex items-center gap-2">
                            <EditButton
                              resource="purchase-orders"
                              id={po.id}
                              fields={[
                                { name: 'status', label: 'Status', value: po.status ?? '' },
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