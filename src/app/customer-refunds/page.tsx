import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { loadListValues } from '@/lib/load-list-values'
import { createRecordLabelMapFromValues, formatRecordLabel } from '@/lib/record-status-label'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import ListRowActions from '@/components/ListRowActions'
import ListSearchActions from '@/components/ListSearchActions'
import PaginationFooter from '@/components/PaginationFooter'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { getPagination } from '@/lib/pagination'

const COLUMNS = [
  { id: 'number', label: 'Customer Refund Id' },
  { id: 'customer', label: 'Customer' },
  { id: 'source', label: 'Source Receipt' },
  { id: 'amount', label: 'Amount' },
  { id: 'date', label: 'Date' },
  { id: 'method', label: 'Method' },
  { id: 'status', label: 'Status' },
  { id: 'reference', label: 'Reference' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function CustomerRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const { moneySettings } = await loadCompanyDisplaySettings()
  const statusFilter = params.status ?? 'all'
  const query = (params.q ?? '').trim()

  const where: Prisma.CustomerRefundWhereInput = {
    ...(query
      ? {
          OR: [
            { number: { contains: query } },
            { status: { contains: query } },
            { reference: { contains: query } },
            { customer: { name: { contains: query } } },
          ],
        }
      : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const [totalRows, companySettings, cabinetFiles, statusValues] = await Promise.all([
    prisma.customerRefund.count({ where }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('CUSTOMER-REFUND-STATUS'),
  ])

  const statusOptions = ['all', ...statusValues.map((value) => value.toLowerCase())]
  const statusLabelMap = createRecordLabelMapFromValues(statusValues)
  const pagination = getPagination(totalRows, params.page)
  const exportAllUrl = buildMasterDataExportUrl('customer-refunds', query, undefined, {
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })

  const rows = await prisma.customerRefund.findMany({
    where,
    include: {
      customer: true,
      cashReceipt: { include: { invoice: { include: { currency: true } } } },
      currency: true,
    },
    orderBy: [{ createdAt: 'desc' }],
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages =
    cabinetFiles.find((file) => file.id === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.originalName === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.storedName === selectedLogoValue)
    ?? (!selectedLogoValue ? cabinetFiles[0] : undefined)

  const buildPageHref = (page: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (statusFilter !== 'all') search.set('status', statusFilter)
    search.set('page', String(page))
    return `/customer-refunds?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? <img src={companyLogoPages.url} alt="Company logo" className="h-16 w-auto rounded" /> : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Customer Refunds</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalRows} total</p>
        </div>
        <Link href="/customer-refunds/new" className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition" style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }}>
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Customer Refund
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((status) => (
          <Link
            key={status}
            href={`/customer-refunds?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), status, page: '1' }).toString()}`}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={statusFilter === status ? { backgroundColor: 'var(--accent-primary-strong)', color: '#fff' } : { backgroundColor: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border-muted)' }}
          >
            {status === 'all' ? 'All' : formatRecordLabel(status, statusLabelMap)}
          </Link>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="status" value={statusFilter} />
          <div className="flex items-center gap-3 flex-nowrap">
            <input type="text" name="q" defaultValue={params.q ?? ''} placeholder="Search customer refund id, customer, status, reference" className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            <ListSearchActions
              tableId="customer-refunds-list"
              exportFileName="customer-refunds"
              exportAllUrl={exportAllUrl}
              columns={COLUMNS}
            />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="customer-refunds-list">
          <table className="min-w-full" id="customer-refunds-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {COLUMNS.map((column) => (
                  <th key={column.id} data-column={column.id} className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>
                    <RecordListHeaderLabel label={column.label} tooltip={'tooltip' in column ? column.tooltip : undefined} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No customer refunds yet.</td></tr>
              ) : rows.map((row, index) => (
                <tr key={row.id} style={index < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                  <td data-column="number" className="px-4 py-2 text-sm"><Link href={`/customer-refunds/${row.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{row.number}</Link></td>
                  <td data-column="customer" className="px-4 py-2 text-sm">{row.customer ? <Link href={`/customers/${row.customerId}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{row.customer.name}</Link> : '-'}</td>
                  <td data-column="source" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.cashReceipt?.number ?? '-'}</td>
                  <td data-column="amount" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {fmtCurrency(
                      row.amount,
                      row.currency?.code
                        ?? row.currency?.currencyId
                        ?? row.cashReceipt?.invoice?.currency?.code
                        ?? row.cashReceipt?.invoice?.currency?.currencyId
                        ?? undefined,
                      moneySettings,
                    )}
                  </td>
                  <td data-column="date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(row.date, moneySettings)}</td>
                  <td data-column="method" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.method}</td>
                  <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatRecordLabel(row.status, statusLabelMap)}</td>
                  <td data-column="reference" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.reference ?? '-'}</td>
                  <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(row.createdAt, moneySettings)}</td>
                  <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(row.updatedAt, moneySettings)}</td>
                  <td data-column="actions" className="px-4 py-2 text-sm">
                    <ListRowActions
                      viewHref={`/customer-refunds/${row.id}`}
                      editHref={`/customer-refunds/${row.id}?edit=1`}
                      deleteButton={{ id: row.id, endpoint: '/api/customer-refunds', label: row.number }}
                    />
                  </td>
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
