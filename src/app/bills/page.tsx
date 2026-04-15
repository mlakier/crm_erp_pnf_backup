import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import CreateModalButton from '@/components/CreateModalButton'
import BillCreateForm from '@/components/BillCreateForm'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'

const BILL_COLUMNS = [
  { id: 'bill-number', label: 'Bill #' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'bill-date', label: 'Bill Date' },
  { id: 'due-date', label: 'Due Date' },
  { id: 'created', label: 'Created' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const statusFilter = params.status ?? 'all'
  const sort = params.sort ?? 'newest'

  const where = {
    ...(query
      ? {
          OR: [
            { number: { contains: query } },
            { status: { contains: query } },
            { vendor: { name: { contains: query } } },
            { notes: { contains: query } },
          ],
        }
      : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const orderBy =
    sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'amount-desc'
        ? [{ total: 'desc' as const }]
        : sort === 'amount-asc'
          ? [{ total: 'asc' as const }]
          : sort === 'due-soonest'
            ? [{ dueDate: 'asc' as const }]
            : [{ createdAt: 'desc' as const }]

  const [totalBills, vendors, totalAmountAgg, companySettings, cabinetFiles] = await Promise.all([
    prisma.bill.count({ where }),
    prisma.vendor.findMany({ orderBy: { name: 'asc' }, where: { inactive: false } }),
    prisma.bill.aggregate({ where, _sum: { total: true } }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
  ])

  const pagination = getPagination(totalBills, params.page)

  const bills = await prisma.bill.findMany({
    where,
    include: { vendor: true },
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
    return `/bills?${search.toString()}`
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
          <h1 className="text-xl font-semibold text-white">Bills</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {totalBills} total, {fmtCurrency(totalAmountAgg._sum.total ?? 0)} total payable
          </p>
        </div>
        {vendors.length > 0 ? (
          <CreateModalButton buttonLabel="New Bill" title="New Bill">
            <BillCreateForm vendors={vendors.map((vendor) => ({ id: vendor.id, name: vendor.name }))} />
          </CreateModalButton>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" />
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search bill #, vendor, status, notes"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <select name="status" defaultValue={statusFilter} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="all">All statuses</option>
              <option value="received">Received</option>
              <option value="pending approval">Pending approval</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
            <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="amount-desc">Amount high-low</option>
              <option value="amount-asc">Amount low-high</option>
              <option value="due-soonest">Due soonest</option>
            </select>
            <ExportButton tableId="bills-list" fileName="bills" />
            <ColumnSelector tableId="bills-list" columns={BILL_COLUMNS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="bills-list">
          <table className="min-w-full" id="bills-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="bill-number" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Bill #</th>
                <th data-column="vendor" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Vendor</th>
                <th data-column="status" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Status</th>
                <th data-column="total" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Total</th>
                <th data-column="bill-date" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Bill Date</th>
                <th data-column="due-date" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Due Date</th>
                <th data-column="created" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
                <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No bills found
                  </td>
                </tr>
              ) : (
                bills.map((bill, index) => (
                  <tr key={bill.id} style={index < bills.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="bill-number" className="px-4 py-2 text-sm">
                      <Link href={`/bills/${bill.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {bill.number}
                      </Link>
                    </td>
                    <td data-column="vendor" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{bill.vendor.name}</td>
                    <td data-column="status" className="px-4 py-2 text-sm"><BillStatusBadge status={bill.status} /></td>
                    <td data-column="total" className="px-4 py-2 text-sm text-white">{fmtCurrency(bill.total)}</td>
                    <td data-column="bill-date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(bill.date).toLocaleDateString()}</td>
                    <td data-column="due-date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '—'}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(bill.createdAt).toLocaleDateString()}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="bills"
                          id={bill.id}
                          fields={[
                            {
                              name: 'vendorId',
                              label: 'Vendor',
                              value: bill.vendorId,
                              type: 'select',
                              options: vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
                            },
                            { name: 'total', label: 'Total', value: String(bill.total), type: 'number' },
                            { name: 'date', label: 'Bill Date', value: new Date(bill.date).toISOString().split('T')[0], type: 'date' },
                            { name: 'dueDate', label: 'Due Date', value: bill.dueDate ? new Date(bill.dueDate).toISOString().split('T')[0] : '', type: 'date' },
                            {
                              name: 'status',
                              label: 'Status',
                              value: bill.status,
                              type: 'select',
                              options: [
                                { value: 'received', label: 'Received' },
                                { value: 'pending approval', label: 'Pending Approval' },
                                { value: 'approved', label: 'Approved' },
                                { value: 'paid', label: 'Paid' },
                                { value: 'void', label: 'Void' },
                              ],
                            },
                            { name: 'notes', label: 'Notes', value: bill.notes ?? '' },
                          ]}
                        />
                        <DeleteButton resource="bills" id={bill.id} />
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
          total={totalBills}
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

function BillStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    received: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    'pending approval': { bg: 'rgba(245,158,11,0.18)', color: '#f59e0b' },
    approved: { bg: 'rgba(16,185,129,0.18)', color: '#10b981' },
    paid: { bg: 'rgba(34,197,94,0.18)', color: '#86efac' },
    void: { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' },
  }

  const style = styles[status] ?? { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' }

  return (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: style.bg, color: style.color }}>
      {status}
    </span>
  )
}
