import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import ListSearchActions from '@/components/ListSearchActions'
import PaginationFooter from '@/components/PaginationFooter'
import ExchangeRateCreateForm from '@/components/ExchangeRateCreateForm'
import ExchangeRateSyncButton from '@/components/ExchangeRateSyncButton'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { CANONICAL_EXCHANGE_RATE_TYPES } from '@/lib/exchange-rate-types'
import { fmtDocumentDate } from '@/lib/format'

const COLS = [
  { id: 'pair', label: 'Currency Pair' },
  { id: 'effective-date', label: 'Effective Date' },
  { id: 'rate', label: 'Rate' },
  { id: 'rate-type', label: 'Rate Type' },
  { id: 'source', label: 'Source' },
  { id: 'active', label: 'Active' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

function fmtEffectiveDateUtc(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const year = String(date.getUTCFullYear())
  return `${month}/${day}/${year}`
}

export default async function ExchangeRatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string; rateType?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()

  const where = {
    ...(query
      ? {
          OR: [
            { source: { contains: query, mode: 'insensitive' as const } },
            { rateType: { contains: query, mode: 'insensitive' as const } },
            { baseCurrency: { code: { contains: query, mode: 'insensitive' as const } } },
            { quoteCurrency: { code: { contains: query, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  }

  const orderBy = [{ effectiveDate: 'desc' as const }, { createdAt: 'desc' as const }]

  const [{ moneySettings }, total, currencies, latestSyncLog, latestFxRun, companySettings, cabinetFiles] = await Promise.all([
    loadCompanyDisplaySettings(),
    prisma.exchangeRate.count({ where }),
    prisma.currency.findMany({ orderBy: { code: 'asc' } }),
    prisma.integrationLog.findFirst({
      where: { integration: 'frankfurter-exchange-rates' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.runHeader.findFirst({
      where: { runType: 'fx_ingestion' },
      orderBy: { requestedAt: 'desc' },
    }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
  ])
  const rateTypeOptions = CANONICAL_EXCHANGE_RATE_TYPES.map((option) => ({ value: option.value, label: option.label }))

  const pagination = getPagination(total, params.page)

  const rows = await prisma.exchangeRate.findMany({
    where,
    include: { baseCurrency: true, quoteCurrency: true },
    orderBy,
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const buildPageHref = (page: number) => {
    const nextParams = new URLSearchParams()
    if (params.q) nextParams.set('q', params.q)
    nextParams.set('page', String(page))
    return `/exchange-rates?${nextParams.toString()}`
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
          <img src={companyLogoPages.url} alt="Company logo" className="h-16 w-auto rounded" />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Exchange Rates</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{total} total</p>
        </div>
        <div className="flex items-center gap-3">
          <ExchangeRateSyncButton />
          <CreateModalButton buttonLabel="New Exchange Rate" title="New Exchange Rate">
            <ExchangeRateCreateForm currencies={currencies} rateTypeOptions={rateTypeOptions} />
          </CreateModalButton>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border px-6 py-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              FX Ingestion
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Daily ECB spot rates flow through Frankfurter. Use `Sync Latest Rates` for the current reference day or `Backfill History` to load a historical date range with an audited run trail.
            </p>
          </div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {latestFxRun
              ? `Last run: ${latestFxRun.runNumber} - ${latestFxRun.status} - ${fmtDocumentDate(latestFxRun.requestedAt, moneySettings)}`
              : 'Last run: none yet'}
          </div>
        </div>
        {latestFxRun?.message ? (
          <p className="mt-3 text-xs" style={{ color: latestFxRun.status === 'failed' ? '#fca5a5' : '#86efac' }}>
            {latestFxRun.message}
          </p>
        ) : null}
        {latestSyncLog?.message ? (
          <p className="mt-3 text-xs" style={{ color: latestSyncLog.status === 'success' ? '#86efac' : '#fca5a5' }}>
            Integration Log: {latestSyncLog.message}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" />
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search pair, source, or type"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <ListSearchActions
              tableId="exchange-rates-list"
              exportFileName="exchange-rates"
              columns={COLS}
            />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="exchange-rates-list">
          <table className="min-w-full" id="exchange-rates-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {COLS.map((column) => (
                  <th
                    key={column.id}
                    data-column={column.id}
                    className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No exchange rates found
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} style={index < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="pair" className="px-4 py-2 text-sm font-medium" style={{ color: 'var(--accent-primary-strong)' }}>
                      {row.baseCurrency.code}/{row.quoteCurrency.code}
                    </td>
                    <td data-column="effective-date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtEffectiveDateUtc(row.effectiveDate)}
                    </td>
                    <td data-column="rate" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.rate.toFixed(6)}
                    </td>
                    <td data-column="rate-type" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.rateType}
                    </td>
                    <td data-column="source" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.source ?? '—'}
                    </td>
                    <td data-column="active" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.active ? 'Yes' : 'No'}
                    </td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(row.createdAt, moneySettings)}
                    </td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(row.updatedAt, moneySettings)}
                    </td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="exchange-rates"
                          id={row.id}
                          fields={[
                            { name: 'effectiveDate', label: 'Effective Date', value: new Date(row.effectiveDate).toISOString().slice(0, 10), type: 'date' },
                            { name: 'rate', label: 'Rate', value: String(row.rate), type: 'number' },
                            { name: 'rateType', label: 'Rate Type', value: row.rateType, type: 'select', options: rateTypeOptions },
                            { name: 'source', label: 'Source', value: row.source ?? '' },
                            { name: 'active', label: 'Active', value: row.active ? 'true' : 'false', type: 'checkbox', placeholder: 'Active' },
                          ]}
                        />
                        <DeleteButton resource="exchange-rates" id={row.id} />
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

