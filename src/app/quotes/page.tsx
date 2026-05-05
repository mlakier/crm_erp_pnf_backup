import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { loadListValues } from '@/lib/load-list-values'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import DeleteButton from '@/components/DeleteButton'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { DEFAULT_RECORD_LIST_SORT, prependIdSortOption } from '@/lib/record-list-sort'
import { createRecordLabelMapFromValues, formatRecordLabel } from '@/lib/record-status-label'

const QUOTE_COLUMNS = [
  { id: 'quote-number', label: 'Quote Id' },
  { id: 'customer', label: 'Customer' },
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'sales-order', label: 'Sales Order' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'valid-until', label: 'Valid Until' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'currency', label: 'Currency' },
  { id: 'notes', label: 'Notes' },
  { id: 'db-id', label: 'DB Id' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions' },
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

  const [totalQuotes, companySettings, cabinetFiles, statusValues] = await Promise.all([
    prisma.quote.count({ where }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('QUOTE-STATUS'),
  ])

  const STATUS_OPTIONS = ['all', ...statusValues.map(v => v.toLowerCase())]
  const statusLabelMap = createRecordLabelMapFromValues(statusValues)

  const pagination = getPagination(totalQuotes, params.page)

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      customer: true,
      opportunity: true,
      salesOrder: true,
      subsidiary: true,
      currency: true,
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
        <Link
          href="/quotes/new"
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Quote
        </Link>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((s) => {
          const active = statusFilter === s
          const href = `/quotes?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), status: s, page: '1' }).toString()}`
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
              {s === 'all' ? 'All' : formatRecordLabel(s, statusLabelMap)}
            </Link>
          )
        })}
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
            <input type="hidden" name="status" value={statusFilter} />
            <input name="sort" list="quote-sort-options" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            <datalist id="quote-sort-options">
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </datalist>
            <input type="hidden" name="page" value="1" />
            <ExportButton
              tableId="estimates-list"
              fileName="estimates"
              exportAllUrl={buildMasterDataExportUrl('quotes', params.q, sort, {
                status: statusFilter !== 'all' ? statusFilter : undefined,
              })}
            />
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
                  <td colSpan={14} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No quotes yet. Create one from an opportunity.</td>
                </tr>
              ) : (
                quotes.map((quote, index) => (
                  <tr key={quote.id} style={index < quotes.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="quote-number" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Link href={`/quotes/${quote.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {quote.number}
                      </Link>
                    </td>
                    <td data-column="customer" className="px-4 py-2 text-sm">
                      <Link href={`/customers/${quote.customer.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {quote.customer.name}
                      </Link>
                    </td>
                    <td data-column="opportunity" className="px-4 py-2 text-sm">
                      {quote.opportunity ? (
                        <Link href={`/opportunities/${quote.opportunity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {quote.opportunity.name}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>{'—'}</span>
                      )}
                    </td>
                    <td data-column="sales-order" className="px-4 py-2 text-sm">
                      {quote.salesOrder ? (
                        <Link href={`/sales-orders/${quote.salesOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {quote.salesOrder.number}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>{'—'}</span>
                      )}
                    </td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatRecordLabel(quote.status, statusLabelMap)}</td>
                    <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtCurrency(
                        quote.total,
                        quote.currency?.code ?? quote.currency?.currencyId ?? undefined,
                        moneySettings,
                      )}
                    </td>
                    <td data-column="valid-until" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{quote.validUntil ? fmtDocumentDate(quote.validUntil, moneySettings) : '—'}</td>
                    <td data-column="subsidiary" className="px-4 py-2 text-sm">
                      {quote.subsidiary ? (
                        <Link href={`/subsidiaries/${quote.subsidiary.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {quote.subsidiary.name}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>{'—'}</span>
                      )}
                    </td>
                    <td data-column="currency" className="px-4 py-2 text-sm">
                      {quote.currency ? (
                        <Link href={`/currencies/${quote.currency.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {quote.currency.code}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>{'—'}</span>
                      )}
                    </td>
                    <td data-column="notes" className="px-4 py-2 text-sm truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>{quote.notes ?? '—'}</td>
                    <td data-column="db-id" className="px-4 py-2 font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>{quote.id}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(quote.createdAt, moneySettings)}</td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(quote.updatedAt, moneySettings)}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/quotes/${quote.id}?edit=1`}
                          className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                        >
                          Edit
                        </Link>
                        <DeleteButton resource="quotes" id={quote.id} />
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

