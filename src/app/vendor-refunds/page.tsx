import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadListValues } from '@/lib/load-list-values'
import { createRecordLabelMapFromValues, formatRecordLabel } from '@/lib/record-status-label'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import ListRowActions from '@/components/ListRowActions'
import ListSearchActions from '@/components/ListSearchActions'
import PaginationFooter from '@/components/PaginationFooter'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { getPagination } from '@/lib/pagination'

const COLUMNS = [
  { id: 'number', label: 'Vendor Refund Id' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'source', label: 'Source Payment' },
  { id: 'amount', label: 'Amount' },
  { id: 'date', label: 'Date' },
  { id: 'method', label: 'Method' },
  { id: 'status', label: 'Status' },
  { id: 'reference', label: 'Reference' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function VendorRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const { moneySettings } = await loadCompanyDisplaySettings()
  const statusFilter = params.status ?? 'all'
  const query = (params.q ?? '').trim()

  const where: Prisma.VendorRefundWhereInput = {
    ...(query
      ? {
          OR: [
            { number: { contains: query } },
            { status: { contains: query } },
            { reference: { contains: query } },
            { vendor: { name: { contains: query } } },
          ],
        }
      : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const [totalRows, statusValues] = await Promise.all([
    prisma.vendorRefund.count({ where }),
    loadListValues('VENDOR-REFUND-STATUS'),
  ])

  const statusOptions = ['all', ...statusValues.map((value) => value.toLowerCase())]
  const statusLabelMap = createRecordLabelMapFromValues(statusValues)
  const pagination = getPagination(totalRows, params.page)
  const exportAllUrl = buildMasterDataExportUrl('vendor-refunds', query, undefined, {
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })

  const rows = await prisma.vendorRefund.findMany({
    where,
    include: {
      vendor: true,
      billPayment: { include: { bill: { include: { currency: true } } } },
      currency: true,
    },
    orderBy: [{ createdAt: 'desc' }],
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const buildPageHref = (page: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (statusFilter !== 'all') search.set('status', statusFilter)
    search.set('page', String(page))
    return `/vendor-refunds?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Vendor Refunds</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalRows} total</p>
        </div>
        <Link href="/vendor-refunds/new" className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition" style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }}>
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Vendor Refund
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((status) => (
          <Link
            key={status}
            href={`/vendor-refunds?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), status, page: '1' }).toString()}`}
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
            <input type="text" name="q" defaultValue={params.q ?? ''} placeholder="Search vendor refund id, vendor, status, reference" className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            <ListSearchActions
              tableId="vendor-refunds-list"
              exportFileName="vendor-refunds"
              exportAllUrl={exportAllUrl}
              columns={COLUMNS}
            />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="vendor-refunds-list">
          <table className="min-w-full" id="vendor-refunds-list">
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
                <tr><td colSpan={11} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No vendor refunds yet.</td></tr>
              ) : rows.map((row, index) => (
                <tr key={row.id} style={index < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                  <td data-column="number" className="px-4 py-2 text-sm"><Link href={`/vendor-refunds/${row.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{row.number}</Link></td>
                  <td data-column="vendor" className="px-4 py-2 text-sm">{row.vendor ? <Link href={`/vendors/${row.vendorId}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{row.vendor.name}</Link> : '-'}</td>
                  <td data-column="source" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.billPayment?.number ?? '-'}</td>
                  <td data-column="amount" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {fmtCurrency(
                      row.amount,
                      row.currency?.code
                        ?? row.currency?.currencyId
                        ?? row.billPayment?.bill?.currency?.code
                        ?? row.billPayment?.bill?.currency?.currencyId
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
                      viewHref={`/vendor-refunds/${row.id}`}
                      editHref={`/vendor-refunds/${row.id}?edit=1`}
                      deleteButton={{ id: row.id, endpoint: '/api/vendor-refunds', label: row.number }}
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
