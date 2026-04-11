import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import CreateModalButton from '@/components/CreateModalButton'
import InvoiceCreateFromSalesOrderForm from '@/components/InvoiceCreateFromSalesOrderForm'
import ColumnSelector from '@/components/ColumnSelector'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'

const INVOICE_COLUMNS = [
  { id: 'invoice-number', label: 'Invoice #' },
  { id: 'customer', label: 'Customer' },
  { id: 'sales-order', label: 'Sales Order' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'due-date', label: 'Due Date' },
  { id: 'paid-date', label: 'Paid Date' },
]

export default async function InvoicesPage({
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
            { salesOrder: { is: { number: { contains: query } } } },
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
          : sort === 'due-soonest'
            ? [{ dueDate: 'asc' as const }]
            : [{ createdAt: 'desc' as const }]

  const [totalInvoices, salesOrdersWithoutInvoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.salesOrder.findMany({
      where: { invoices: { none: {} } },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  const pagination = getPagination(totalInvoices, params.page)

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      customer: true,
      salesOrder: true,
      cashReceipts: true,
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
    return `/invoices?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Invoices</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalInvoices} total</p>
        </div>
        <CreateModalButton buttonLabel="New Invoice" title="New Invoice">
          <InvoiceCreateFromSalesOrderForm
            salesOrders={salesOrdersWithoutInvoices.map((salesOrder) => ({
              id: salesOrder.id,
              label: `${salesOrder.number} - ${salesOrder.customer.name}`,
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
              placeholder="Search invoice #, customer, sales order, status"
              className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <select name="status" defaultValue={statusFilter} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
            <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="total-desc">Total high-low</option>
              <option value="total-asc">Total low-high</option>
              <option value="due-soonest">Due soonest</option>
            </select>
            <input type="hidden" name="page" value="1" />
            <div className="flex items-center gap-2">
              <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium" style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }}>Apply</button>
              <Link href="/invoices" className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Reset</Link>
            </div>
            <ColumnSelector tableId="invoices-list" columns={INVOICE_COLUMNS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="invoices-list">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="invoice-number" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Invoice #</th>
                <th data-column="customer" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Customer</th>
                <th data-column="sales-order" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Sales Order</th>
                <th data-column="status" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Status</th>
                <th data-column="total" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Total</th>
                <th data-column="due-date" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Due Date</th>
                <th data-column="paid-date" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Paid Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No invoices yet. Create one from a sales order.</td>
                </tr>
              ) : (
                invoices.map((invoice, index) => (
                  <tr key={invoice.id} style={index < invoices.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="invoice-number" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {invoice.number}
                      </Link>
                    </td>
                    <td data-column="customer" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{invoice.customer.name}</td>
                    <td data-column="sales-order" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{invoice.salesOrder.number}</td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{invoice.status}</td>
                    <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(invoice.total)}</td>
                    <td data-column="due-date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}</td>
                    <td data-column="paid-date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{invoice.paidDate ? new Date(invoice.paidDate).toLocaleDateString() : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={totalInvoices}
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
