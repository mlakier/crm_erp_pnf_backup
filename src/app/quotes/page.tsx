import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import CreateModalButton from '@/components/CreateModalButton'
import QuoteCreateFromOpportunityForm from '@/components/QuoteCreateFromOpportunityForm'
import ColumnSelector from '@/components/ColumnSelector'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'

const QUOTE_COLUMNS = [
  { id: 'quote-number', label: 'Quote #' },
  { id: 'customer', label: 'Customer' },
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'sales-order', label: 'Sales Order' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'valid-until', label: 'Valid Until' },
]

export default async function QuotesPage({
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
            { opportunity: { is: { name: { contains: query } } } },
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

  const [totalQuotes, opportunitiesWithoutQuote] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.opportunity.findMany({
      where: { quote: null },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  const pagination = getPagination(totalQuotes, params.page)

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      customer: true,
      opportunity: true,
      salesOrder: true,
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
    return `/quotes?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Quotes</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalQuotes} total</p>
        </div>
        <CreateModalButton buttonLabel="New Quote" title="New Quote">
          <QuoteCreateFromOpportunityForm
            opportunities={opportunitiesWithoutQuote.map((opportunity) => ({
              id: opportunity.id,
              label: `${opportunity.opportunityNumber ?? opportunity.name} - ${opportunity.customer.name}`,
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
              placeholder="Search quote #, customer, opportunity, status"
              className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <select name="status" defaultValue={statusFilter} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="expired">Expired</option>
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
              <Link href="/quotes" className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Reset</Link>
            </div>
            <ColumnSelector tableId="quotes-list" columns={QUOTE_COLUMNS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="quotes-list">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="quote-number" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Quote #</th>
                <th data-column="customer" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Customer</th>
                <th data-column="opportunity" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Opportunity</th>
                <th data-column="sales-order" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Sales Order</th>
                <th data-column="status" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Status</th>
                <th data-column="total" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Total</th>
                <th data-column="valid-until" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Valid Until</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No quotes yet. Create one from an opportunity.</td>
                </tr>
              ) : (
                quotes.map((quote, index) => (
                  <tr key={quote.id} style={index < quotes.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="quote-number" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Link href={`/quotes/${quote.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {quote.number}
                      </Link>
                    </td>
                    <td data-column="customer" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{quote.customer.name}</td>
                    <td data-column="opportunity" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{quote.opportunity?.name ?? '—'}</td>
                    <td data-column="sales-order" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{quote.salesOrder?.number ?? '—'}</td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{quote.status}</td>
                    <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(quote.total)}</td>
                    <td data-column="valid-until" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={totalQuotes}
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