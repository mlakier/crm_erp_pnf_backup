import Link from 'next/link'
import type { Prisma } from '@prisma/client'
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
import DeleteButton from '@/components/DeleteButton'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'

const SALES_ORDER_COLUMNS = [
  { id: 'sales-order-number', label: 'Sales Order Id' },
  { id: 'customer-id', label: 'Customer Id' },
  { id: 'quote', label: 'Quote' },
  { id: 'opportunity-id', label: 'Opportunity Id' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'subsidiary-id', label: 'Subsidiary Id' },
  { id: 'customer', label: 'Customer', defaultVisible: false },
  { id: 'created-by', label: 'User Id', defaultVisible: false },
  { id: 'subsidiary', label: 'Subsidiary', defaultVisible: false },
  { id: 'currency-id', label: 'Currency Id', defaultVisible: false },
  { id: 'currency', label: 'Currency', defaultVisible: false },
  { id: 'db-id', label: 'DB Id' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const { moneySettings } = await loadCompanyDisplaySettings()
  const query = (params.q ?? '').trim()
  const statusFilter = params.status ?? 'all'

  const where: Prisma.SalesOrderWhereInput = {
    ...(query
      ? {
          OR: [
            { number: { contains: query } },
            { status: { contains: query } },
            { customer: { name: { contains: query } } },
            { customer: { customerId: { contains: query } } },
            { user: { userId: { contains: query } } },
            { quote: { is: { number: { contains: query } } } },
            { quote: { is: { opportunity: { is: { opportunityNumber: { contains: query } } } } } },
          ],
        }
      : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const orderBy = [{ createdAt: 'desc' as const }]

  const [totalSalesOrders, companySettings, cabinetFiles, statusValues] = await Promise.all([
    prisma.salesOrder.count({ where }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('SO-STATUS'),
  ])

  const statusOptions = ['all', ...statusValues.map((value) => value.toLowerCase())]
  const pagination = getPagination(totalSalesOrders, params.page)

  const salesOrders = await prisma.salesOrder.findMany({
    where,
    include: {
      customer: true,
      quote: {
        include: {
          opportunity: true,
        },
      },
      user: true,
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
    search.set('page', String(nextPage))
    return `/sales-orders?${search.toString()}`
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
        {companyLogoPages ? (
          <img src={companyLogoPages.url} alt="Company logo" className="h-16 w-auto rounded" />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Sales Orders</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {totalSalesOrders} total
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Orders are auto-created from accepted quotes, or create manually below
          </p>
        </div>
        <Link
          href="/sales-orders/new"
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Sales Order
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((status) => {
          const active = statusFilter === status
          const href = `/sales-orders?${new URLSearchParams({
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
                  : {
                      backgroundColor: 'var(--card)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-muted)',
                    }
              }
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Link>
          )
        })}
      </div>

      <section
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
      >
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="flex flex-nowrap items-center gap-3">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search sales order, customer, quote, user, opportunity"
              className="min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="status" value={statusFilter} />
            <input type="hidden" name="page" value="1" />
            <div className="flex items-center gap-2">
              <ExportButton
                tableId="sales-orders-list"
                fileName="sales-orders"
                exportAllUrl={buildMasterDataExportUrl('sales-orders', params.q)}
              />
            </div>
            <ColumnSelector tableId="sales-orders-list" columns={SALES_ORDER_COLUMNS} />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="sales-orders-list">
          <table className="min-w-full" id="sales-orders-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {SALES_ORDER_COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    data-column={column.id}
                    className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}
                  >
                    <RecordListHeaderLabel
                      label={column.label}
                      tooltip={'tooltip' in column ? column.tooltip : undefined}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salesOrders.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No sales orders yet. Create one from a quote.
                  </td>
                </tr>
              ) : (
                salesOrders.map((order, index) => (
                  <tr
                    key={order.id}
                    style={index < salesOrders.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}
                  >
                    <td data-column="sales-order-number" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Link
                        href={`/sales-orders/${order.id}`}
                        className="font-medium hover:underline"
                        style={{ color: 'var(--accent-primary-strong)' }}
                      >
                        {order.number}
                      </Link>
                    </td>
                    <td data-column="customer-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {order.customer.customerId ?? '-'}
                    </td>
                    <td data-column="customer" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {order.customer.name}
                    </td>
                    <td data-column="created-by" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {order.user?.userId ?? '-'}
                    </td>
                    <td data-column="quote" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {order.quote?.number ?? '-'}
                    </td>
                    <td data-column="opportunity-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {order.quote?.opportunity?.opportunityNumber ?? '-'}
                    </td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {order.status}
                    </td>
                    <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtCurrency(order.total, undefined, moneySettings)}
                    </td>
                    <td data-column="subsidiary-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {order.subsidiary?.subsidiaryId ?? '-'}
                    </td>
                    <td data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {order.subsidiary?.name ?? '-'}
                    </td>
                    <td data-column="currency-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {order.currency?.currencyId ?? order.currency?.code ?? '-'}
                    </td>
                    <td data-column="currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {order.currency?.code ?? '-'}
                    </td>
                    <td data-column="db-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {order.id}
                    </td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(order.createdAt, moneySettings)}
                    </td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(order.updatedAt, moneySettings)}
                    </td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/sales-orders/${order.id}?edit=1`}
                          className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                        >
                          Edit
                        </Link>
                        <DeleteButton resource="sales-orders" id={order.id} />
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
