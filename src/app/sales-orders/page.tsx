import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import CreateModalButton from '@/components/CreateModalButton'
import SalesOrderCreateFromQuoteForm from '@/components/SalesOrderCreateFromQuoteForm'
import ColumnSelector from '@/components/ColumnSelector'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'

const SALES_ORDER_COLUMNS = [
  { id: 'sales-order-number', label: 'Sales Order #' },
  { id: 'customer', label: 'Customer' },
  { id: 'quote', label: 'Quote' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'created', label: 'Created' },
]

export default async function SalesOrdersPage({
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
            { customer: { name: { contains: query } } },
            { quote: { is: { number: { contains: query } } } },
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

  const [totalSalesOrders, quotesWithoutSalesOrder] = await Promise.all([
    prisma.salesOrder.count({ where }),
    prisma.quote.findMany({
      where: { salesOrder: null },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  const pagination = getPagination(totalSalesOrders, params.page)

  const salesOrders = await prisma.salesOrder.findMany({
    where,
    include: {
      customer: true,
      quote: true,
    },
    orderBy,
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (statusFilter !== 'all') search.set('status', statusFilter)
    if (sort) search.set('sort', sort)
    search.set('page', String(nextPage))
    return `/sales-orders?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Sales Orders</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalSalesOrders} total</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Orders are auto-created from accepted quotes, or create manually below
          </p>
        </div>
        <CreateModalButton buttonLabel="New Sales Order" title="New Sales Order">
          <SalesOrderCreateFromQuoteForm
            quotes={quotesWithoutSalesOrder.map((quote) => ({
              id: quote.id,
              label: `${quote.number} - ${quote.customer.name}`,
            }))}
          />
        </CreateModalButton>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search sales order #, customer, quote, status"
              className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <select name="status" defaultValue={statusFilter} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="booked">Booked</option>
              <option value="fulfilled">Fulfilled</option>
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
              <Link href="/sales-orders" className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Reset</Link>
            </div>
            <ColumnSelector tableId="sales-orders-list" columns={SALES_ORDER_COLUMNS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="sales-orders-list">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="sales-order-number" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Sales Order #</th>
                <th data-column="customer" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Customer</th>
                <th data-column="quote" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Quote</th>
                <th data-column="status" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Status</th>
                <th data-column="total" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Total</th>
                <th data-column="created" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {salesOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No sales orders yet. Create one from a quote.</td>
                </tr>
              ) : (
                salesOrders.map((order, index) => (
                  <tr key={order.id} style={index < salesOrders.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="sales-order-number" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Link href={`/sales-orders/${order.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {order.number}
                      </Link>
                    </td>
                    <td data-column="customer" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{order.customer.name}</td>
                    <td data-column="quote" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{order.quote?.number ?? '—'}</td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{order.status}</td>
                    <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(order.total)}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={totalSalesOrders}
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