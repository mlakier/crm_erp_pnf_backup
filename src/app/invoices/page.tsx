import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import CreateModalButton from '@/components/CreateModalButton'
import InvoiceCreateFromSalesOrderForm from '@/components/InvoiceCreateFromSalesOrderForm'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { loadListValues } from '@/lib/load-list-values'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { DEFAULT_RECORD_LIST_SORT, prependIdSortOption } from '@/lib/record-list-sort'

const INVOICE_COLUMNS = [
  { id: 'invoice-number', label: 'Invoice Id' },
  { id: 'customer', label: 'Customer' },
  { id: 'sales-order', label: 'Sales Order' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'due-date', label: 'Due Date' },
  { id: 'paid-date', label: 'Paid Date' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'currency', label: 'Currency' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions' },
]

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const statusFilter = params.status ?? 'all'
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const sortOptions = prependIdSortOption([
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'total-desc', label: 'Total high-low' },
    { value: 'total-asc', label: 'Total low-high' },
    { value: 'due-soonest', label: 'Due soonest' },
  ])

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
    sort === 'id'
      ? [{ number: 'asc' as const }, { createdAt: 'desc' as const }]
      : sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'total-desc'
        ? [{ total: 'desc' as const }]
        : sort === 'total-asc'
          ? [{ total: 'asc' as const }]
          : sort === 'due-soonest'
            ? [{ dueDate: 'asc' as const }]
            : [{ createdAt: 'desc' as const }]

  const [totalInvoices, salesOrdersWithoutInvoices, companySettings, cabinetFiles, statusValues] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.salesOrder.findMany({
      where: { invoices: { none: {} } },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('INV-STATUS'),
  ])

  const STATUS_OPTIONS = ['all', ...statusValues.map(v => v.toLowerCase())]

  const pagination = getPagination(totalInvoices, params.page)

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      customer: true,
      salesOrder: true,
      cashReceipts: true,
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
    return `/invoices?${search.toString()}`
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

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((s) => {
          const active = statusFilter === s
          const href = `/invoices?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), status: s, page: '1' }).toString()}`
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
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
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
              placeholder="Search invoice id, customer, sales order, status"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ExportButton tableId="invoices-list" fileName="invoices" />
            <ColumnSelector tableId="invoices-list" columns={INVOICE_COLUMNS} />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="invoices-list">
          <table className="min-w-full" id="invoices-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {INVOICE_COLUMNS.map((column) => (
                  <th key={column.id} data-column={column.id} className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>
                    <RecordListHeaderLabel label={column.label} tooltip={'tooltip' in column ? column.tooltip : undefined} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No invoices yet. Create one from a sales order.</td>
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
                    <td data-column="sales-order" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{invoice.salesOrder?.number ?? '—'}</td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{invoice.status}</td>
                    <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(invoice.total)}</td>
                    <td data-column="due-date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}</td>
                    <td data-column="paid-date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{invoice.paidDate ? new Date(invoice.paidDate).toLocaleDateString() : '—'}</td>
                    <td data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{(invoice).subsidiary?.name ?? '—'}</td>
                    <td data-column="currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{(invoice).currency?.code ?? '—'}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(invoice.createdAt).toLocaleDateString()}</td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(invoice.updatedAt).toLocaleDateString()}</td>
                                      <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton resource="invoices" id={invoice.id} fields={[
                          { name: 'status', label: 'Status', value: invoice.status ?? '', type: 'select', options: statusValues.map(s => ({ value: s.toLowerCase(), label: s })) },
                        ]} />
                        <DeleteButton resource="invoices" id={invoice.id} />
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
