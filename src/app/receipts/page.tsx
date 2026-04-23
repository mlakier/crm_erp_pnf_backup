import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadListValues } from '@/lib/load-list-values'
import CreateModalButton from '@/components/CreateModalButton'
import ReceiptCreateForm from '@/components/ReceiptCreateForm'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { buildReceiptDisplayNumberMap } from '@/lib/receipt-display-number'
import { DEFAULT_RECORD_LIST_SORT, prependIdSortOption } from '@/lib/record-list-sort'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'

const RECEIPT_COLUMNS = [
  { id: 'receipt-number', label: 'Receipts Id' },
  { id: 'purchase-order', label: 'Purchase Order' },
  { id: 'quantity', label: 'Quantity' },
  { id: 'date', label: 'Date' },
  { id: 'status', label: 'Status' },
  { id: 'notes', label: 'Notes' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions' },
]

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const statusFilter = params.status ?? 'all'
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const sortOptions = prependIdSortOption([
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'date-desc', label: 'Date newest' },
    { value: 'date-asc', label: 'Date oldest' },
  ])

  const statusValues = await loadListValues('RECEIPT-STATUS')
  const STATUS_OPTIONS = ['all', ...statusValues.map((value) => value.toLowerCase())]

  const where = {
    ...(query
      ? {
          OR: [
            { status: { contains: query } },
            { notes: { contains: query } },
            { purchaseOrder: { number: { contains: query } } },
            { id: { contains: query } },
          ],
        }
      : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const orderBy =
    sort === 'id'
      ? [{ createdAt: 'asc' as const }, { id: 'asc' as const }]
      : sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'date-asc'
        ? [{ date: 'asc' as const }]
        : sort === 'date-desc'
          ? [{ date: 'desc' as const }]
          : [{ createdAt: 'desc' as const }]

  const totalReceipts = await prisma.receipt.count({ where })
  const pagination = getPagination(totalReceipts, params.page)

  const receipts = await prisma.receipt.findMany({
    where,
    include: { purchaseOrder: true },
    orderBy,
    skip: pagination.skip,
    take: pagination.pageSize,
  })
  const allReceiptIds = await prisma.receipt.findMany({
    select: { id: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  const receiptNumberMap = buildReceiptDisplayNumberMap(allReceiptIds)

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (statusFilter !== 'all') search.set('status', statusFilter)
    if (sort) search.set('sort', sort)
    search.set('page', String(nextPage))
    return `/receipts?${search.toString()}`
  }

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    select: { id: true, number: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  const poOptions = purchaseOrders.map((po) => ({ id: po.id, label: po.number ?? po.id }))

  const settings = await loadCompanyInformationSettings()
  const logoFileId = settings.companyLogoPagesFileId
  const cabinetFiles = await loadCompanyCabinetFiles()
  const companyLogoPages = logoFileId ? cabinetFiles.find((file) => file.id === logoFileId) : null

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? (
          <Image
            src={companyLogoPages.url}
            alt="Company logo"
            width={160}
            height={64}
            className="h-16 w-auto rounded"
            unoptimized
          />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Receipts</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {totalReceipts} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {poOptions.length > 0 ? (
            <CreateModalButton buttonLabel="New Receipt" title="New Receipt">
              <ReceiptCreateForm purchaseOrders={poOptions} />
            </CreateModalButton>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((status) => {
          const active = statusFilter === status
          const href = `/receipts?${new URLSearchParams({
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
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="status" value={statusFilter} />
          <div className="flex items-center gap-3 flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search receipts id, purchase order id, status, notes"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <select
              name="sort"
              defaultValue={sort}
              className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ExportButton tableId="receipts-list" fileName="receipts" />
            <ColumnSelector tableId="receipts-list" columns={RECEIPT_COLUMNS} />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="receipts-list">
          <table className="min-w-full" id="receipts-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {RECEIPT_COLUMNS.map((column) => (
                  <th key={column.id} data-column={column.id} className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>
                    <RecordListHeaderLabel label={column.label} tooltip={'tooltip' in column ? column.tooltip : undefined} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No receipts found.
                  </td>
                </tr>
              ) : (
                receipts.map((receipt, index) => (
                  <tr
                    key={receipt.id}
                    style={index < receipts.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}
                  >
                    <td data-column="receipt-number" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-medium" style={{ color: 'var(--accent-primary-strong)' }}>
                        {receiptNumberMap.get(receipt.id) ?? receipt.id}
                      </span>
                    </td>
                    <td data-column="purchase-order" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <Link
                        href={`/purchase-orders/${receipt.purchaseOrderId}`}
                        className="font-medium hover:underline"
                        style={{ color: 'var(--accent-primary-strong)' }}
                      >
                        {receipt.purchaseOrder.number}
                      </Link>
                    </td>
                    <td data-column="quantity" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {receipt.quantity}
                    </td>
                    <td data-column="date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(receipt.date).toLocaleDateString()}
                    </td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {receipt.status}
                    </td>
                    <td data-column="notes" className="px-4 py-2 text-sm truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>
                      {receipt.notes ?? '—'}
                    </td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(receipt.createdAt).toLocaleDateString()}
                    </td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(receipt.updatedAt).toLocaleDateString()}
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
          total={totalReceipts}
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
