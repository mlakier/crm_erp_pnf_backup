import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import ListSearchActions from '@/components/ListSearchActions'
import PaginationFooter from '@/components/PaginationFooter'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { getPagination } from '@/lib/pagination'

const COLUMNS = [
  { id: 'clearing-number', label: 'Business Id' },
  { id: 'clearing-date', label: 'Clearing Date' },
  { id: 'clearing-type', label: 'Clearing Type' },
  { id: 'status', label: 'Status' },
  { id: 'transaction-amount', label: 'Transaction Amount' },
  { id: 'counterparty', label: 'Counterparty' },
  { id: 'source-transaction', label: 'Source Transaction' },
  { id: 'accounting-period', label: 'Accounting Period' },
  { id: 'line-count', label: 'Line Count' },
  { id: 'auto-generated', label: 'Auto Generated' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

function humanize(value: string | null | undefined) {
  if (!value) return '-'
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default async function ClearingDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }>
}) {
  const params = await searchParams
  const { moneySettings } = await loadCompanyDisplaySettings()
  const query = (params.q ?? '').trim()
  const statusFilter = (params.status ?? 'all').trim().toLowerCase()
  const typeFilter = (params.type ?? 'all').trim().toLowerCase()

  const where: Prisma.ClearingDocumentHeaderWhereInput = {
    ...(query
      ? {
          OR: [
            { clearingNumber: { contains: query, mode: 'insensitive' } },
            { clearingType: { contains: query, mode: 'insensitive' } },
            { status: { contains: query, mode: 'insensitive' } },
            { sourceTransactionId: { contains: query, mode: 'insensitive' } },
            { counterpartyId: { contains: query, mode: 'insensitive' } },
            { memo: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(typeFilter !== 'all' ? { clearingType: typeFilter } : {}),
  }

  const [totalRows, companySettings, cabinetFiles, distinctStatuses, distinctTypes] = await Promise.all([
    prisma.clearingDocumentHeader.count({ where }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    prisma.clearingDocumentHeader.findMany({
      distinct: ['status'],
      select: { status: true },
      orderBy: { status: 'asc' },
    }),
    prisma.clearingDocumentHeader.findMany({
      distinct: ['clearingType'],
      select: { clearingType: true },
      orderBy: { clearingType: 'asc' },
    }),
  ])

  const currencies = await prisma.currency.findMany({
    where: { active: true },
    orderBy: [{ code: 'asc' }, { currencyId: 'asc' }],
    select: { id: true, code: true, currencyId: true },
  })
  const currencyCodeById = new Map(
    currencies.map((currency) => [currency.id, (currency.code ?? currency.currencyId ?? '').trim().toUpperCase()]),
  )

  const pagination = getPagination(totalRows, params.page)
  const rows = await prisma.clearingDocumentHeader.findMany({
    where,
    include: {
      accountingPeriod: { select: { name: true } },
      lines: { select: { id: true } },
    },
    orderBy: [{ clearingDate: 'desc' }, { createdAt: 'desc' }],
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages =
    cabinetFiles.find((file) => file.id === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.originalName === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.storedName === selectedLogoValue)
    ?? (!selectedLogoValue ? cabinetFiles[0] : undefined)

  const statusOptions = ['all', ...distinctStatuses.map((row) => row.status.toLowerCase())]
  const typeOptions = ['all', ...distinctTypes.map((row) => row.clearingType.toLowerCase())]
  const exportAllUrl = buildMasterDataExportUrl('clearing-documents', query, undefined, {
    status: statusFilter !== 'all' ? statusFilter : undefined,
    clearingType: typeFilter !== 'all' ? typeFilter : undefined,
  })

  const buildPageHref = (page: number) => {
    const search = new URLSearchParams()
    if (query) search.set('q', query)
    if (statusFilter !== 'all') search.set('status', statusFilter)
    if (typeFilter !== 'all') search.set('type', typeFilter)
    search.set('page', String(page))
    return `/clearing-documents?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? <img src={companyLogoPages.url} alt="Company logo" className="h-16 w-auto rounded" /> : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Clearing Documents</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalRows} total</p>
        </div>
        <Link href="/clearing-documents/new" className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition" style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }}>
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Clearing Document
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((status) => (
          <Link
            key={`status-${status}`}
            href={`/clearing-documents?${new URLSearchParams({
              ...(query ? { q: query } : {}),
              ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
              status,
              page: '1',
            }).toString()}`}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={
              statusFilter === status
                ? { backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }
                : { backgroundColor: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border-muted)' }
            }
          >
            {status === 'all' ? 'All Statuses' : humanize(status)}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {typeOptions.map((type) => (
          <Link
            key={`type-${type}`}
            href={`/clearing-documents?${new URLSearchParams({
              ...(query ? { q: query } : {}),
              ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
              type,
              page: '1',
            }).toString()}`}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={
              typeFilter === type
                ? { backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }
                : { backgroundColor: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border-muted)' }
            }
          >
            {type === 'all' ? 'All Types' : humanize(type)}
          </Link>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="status" value={statusFilter} />
          <input type="hidden" name="type" value={typeFilter} />
          <div className="flex items-center gap-3 flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search business id, type, description, source transaction, counterparty"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <ListSearchActions
              tableId="clearing-documents-list"
              exportFileName="clearing-documents"
              exportAllUrl={exportAllUrl}
              columns={COLUMNS}
            />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="clearing-documents-list">
          <table className="min-w-full" id="clearing-documents-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    data-column={column.id}
                    className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}
                  >
                    <RecordListHeaderLabel label={column.label} tooltip={'tooltip' in column ? column.tooltip : undefined} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No clearing documents found.
                  </td>
                </tr>
              ) : rows.map((row, index) => (
                <tr key={row.id} style={index < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                  <td data-column="clearing-number" className="px-4 py-2 text-sm">
                    <Link href={`/clearing-documents/${row.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                      {row.memo?.trim() ? `${row.clearingNumber} - ${row.memo.trim()}` : row.clearingNumber}
                    </Link>
                  </td>
                  <td data-column="clearing-date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {fmtDocumentDate(row.clearingDate, moneySettings)}
                  </td>
                  <td data-column="clearing-type" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {humanize(row.clearingType)}
                  </td>
                  <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {humanize(row.status)}
                  </td>
                  <td data-column="transaction-amount" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {fmtCurrency(
                      row.transactionAmount,
                      row.transactionCurrencyId ? currencyCodeById.get(row.transactionCurrencyId) ?? undefined : undefined,
                      moneySettings,
                    )}
                  </td>
                  <td data-column="counterparty" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {row.counterpartyType && row.counterpartyId ? `${humanize(row.counterpartyType)} - ${row.counterpartyId}` : row.counterpartyId ?? row.counterpartyType ?? '-'}
                  </td>
                  <td data-column="source-transaction" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {row.sourceTransactionType && row.sourceTransactionId ? `${humanize(row.sourceTransactionType)} - ${row.sourceTransactionId}` : row.sourceTransactionId ?? row.sourceTransactionType ?? '-'}
                  </td>
                  <td data-column="accounting-period" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {row.accountingPeriod?.name ?? '-'}
                  </td>
                  <td data-column="line-count" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {row.lines.length}
                  </td>
                  <td data-column="auto-generated" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {row.autoGenerated ? 'Yes' : 'No'}
                  </td>
                  <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {fmtDocumentDate(row.createdAt, moneySettings)}
                  </td>
                  <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {fmtDocumentDate(row.updatedAt, moneySettings)}
                  </td>
                  <td data-column="actions" className="px-4 py-2 text-sm">
                    <Link
                      href={`/clearing-documents/${row.id}`}
                      className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                      style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={totalRows}
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
