import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import CreateModalButton from '@/components/CreateModalButton'
import QuoteCreateFromOpportunityForm from '@/components/QuoteCreateFromOpportunityForm'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { DEFAULT_RECORD_LIST_SORT, prependIdSortOption } from '@/lib/record-list-sort'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'

const QUOTE_COLUMNS = [
  { id: 'quote-number', label: 'Quote Id' },
  { id: 'customer', label: 'Customer' },
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'sales-order', label: 'Sales Order' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'valid-until', label: 'Valid Until' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
]

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const { moneySettings } = await loadCompanyDisplaySettings()
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
            { customer: { name: { contains: query } } },
            { opportunity: { is: { name: { contains: query } } } },
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

  const [totalQuotes, opportunitiesWithoutQuote, companySettings, cabinetFiles] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.opportunity.findMany({
      where: { quote: null },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
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
    return `/estimates?${search.toString()}`
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
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search quote id, customer, opportunity, status"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
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
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input type="hidden" name="page" value="1" />
            <ExportButton tableId="estimates-list" fileName="estimates" />
            <ColumnSelector tableId="estimates-list" columns={QUOTE_COLUMNS} />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="estimates-list">
          <table className="min-w-full" id="estimates-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {QUOTE_COLUMNS.map((column) => (
                  <th key={column.id} data-column={column.id} className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>
                    <RecordListHeaderLabel label={column.label} tooltip={'tooltip' in column ? column.tooltip : undefined} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No quotes yet. Create one from an opportunity.</td>
                </tr>
              ) : (
                quotes.map((quote, index) => (
                  <tr key={quote.id} style={index < quotes.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="quote-number" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Link href={`/estimates/${quote.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {quote.number}
                      </Link>
                    </td>
                    <td data-column="customer" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{quote.customer.name}</td>
                    <td data-column="opportunity" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{quote.opportunity?.name ?? '—'}</td>
                    <td data-column="sales-order" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{quote.salesOrder?.number ?? '—'}</td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{quote.status}</td>
                    <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(quote.total, undefined, moneySettings)}</td>
                    <td data-column="valid-until" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{quote.validUntil ? fmtDocumentDate(quote.validUntil, moneySettings) : '—'}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(quote.createdAt, moneySettings)}</td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(quote.updatedAt, moneySettings)}</td>
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

