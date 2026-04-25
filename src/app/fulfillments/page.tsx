import type { Prisma } from '@prisma/client'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import DeleteButton from '@/components/DeleteButton'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { loadListValues } from '@/lib/load-list-values'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'

const FULFILLMENT_COLUMNS = [
  { id: 'fulfillment-id', label: 'Fulfillment Id' },
  { id: 'sales-order', label: 'Sales Order' },
  { id: 'customer', label: 'Customer' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Date' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'currency', label: 'Currency', defaultVisible: false },
  { id: 'notes', label: 'Notes' },
  { id: 'db-id', label: 'DB Id' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified', defaultVisible: false },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function FulfillmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const { moneySettings } = await loadCompanyDisplaySettings()
  const query = (params.q ?? '').trim()
  const statusFilter = params.status ?? 'all'

  const where: Prisma.FulfillmentWhereInput = {
    ...(query
      ? {
          OR: [
            { number: { contains: query } },
            { id: { contains: query } },
            { status: { contains: query } },
            { salesOrderId: { contains: query } },
            { notes: { contains: query } },
            { salesOrder: { is: { number: { contains: query } } } },
            { salesOrder: { is: { customer: { is: { name: { contains: query } } } } } },
          ],
        }
      : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const [totalRows, companySettings, cabinetFiles, statusValues] = await Promise.all([
    prisma.fulfillment.count({ where }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('FULFILL-STATUS'),
  ])

  const statusOptions = ['all', ...statusValues.map((value) => value.toLowerCase())]
  const pagination = getPagination(totalRows, params.page)
  const rows = await prisma.fulfillment.findMany({
    where,
    include: {
      salesOrder: { include: { customer: true } },
      subsidiary: true,
      currency: true,
    },
    orderBy: [{ createdAt: 'desc' }],
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (statusFilter !== 'all') search.set('status', statusFilter)
    search.set('page', String(nextPage))
    return `/fulfillments?${search.toString()}`
  }

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages =
    cabinetFiles.find((file) => file.id === selectedLogoValue) ??
    cabinetFiles.find((file) => file.originalName === selectedLogoValue) ??
    cabinetFiles.find((file) => file.storedName === selectedLogoValue) ??
    cabinetFiles.find((file) => file.url === selectedLogoValue) ??
    (!selectedLogoValue ? cabinetFiles[0] : undefined)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? <img src={companyLogoPages.url} alt="Company logo" className="h-16 w-auto rounded" /> : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Fulfillments</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {totalRows} total
          </p>
        </div>
        <Link
          href="/fulfillments/new"
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Fulfillment
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((status) => {
          const active = statusFilter === status
          const href = `/fulfillments?${new URLSearchParams({
            ...(params.q ? { q: params.q } : {}),
            status,
            page: '1',
          }).toString()}`
          return (
            <Link
              key={status}
              href={href}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={
                active
                  ? { backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }
                  : { backgroundColor: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border-muted)' }
              }
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Link>
          )
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="status" value={statusFilter} />
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search fulfillment id, db id, sales order id, customer, status"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <ExportButton
              tableId="fulfillments-list"
              fileName="fulfillments"
              exportAllUrl={buildMasterDataExportUrl('fulfillments', params.q)}
            />
            <ColumnSelector tableId="fulfillments-list" columns={FULFILLMENT_COLUMNS} />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="fulfillments-list">
          <table className="min-w-full" id="fulfillments-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {FULFILLMENT_COLUMNS.map((column) => (
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
                  <td colSpan={12} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No fulfillments yet.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} style={index < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="fulfillment-id" className="px-4 py-2 text-sm font-medium">
                      <Link href={`/fulfillments/${row.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {row.number}
                      </Link>
                    </td>
                    <td data-column="sales-order" className="px-4 py-2 text-sm font-medium">
                      {row.salesOrder ? (
                        <Link href={`/sales-orders/${row.salesOrder.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {row.salesOrder.number}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>{'\u2014'}</span>
                      )}
                    </td>
                    <td data-column="customer" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.salesOrder?.customer?.name ?? '\u2014'}
                    </td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.status}
                    </td>
                    <td data-column="date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(row.date, moneySettings)}
                    </td>
                    <td data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.subsidiary?.name ?? '\u2014'}
                    </td>
                    <td data-column="currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.currency?.code ?? '\u2014'}
                    </td>
                    <td data-column="notes" className="px-4 py-2 text-sm truncate max-w-[220px]" style={{ color: 'var(--text-secondary)' }}>
                      {row.notes ?? '\u2014'}
                    </td>
                    <td data-column="db-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.id}
                    </td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(row.createdAt, moneySettings)}
                    </td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(row.updatedAt, moneySettings)}
                    </td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/fulfillments/${row.id}?edit=1`}
                          className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                        >
                          Edit
                        </Link>
                        <DeleteButton resource="fulfillments" id={row.id} />
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
