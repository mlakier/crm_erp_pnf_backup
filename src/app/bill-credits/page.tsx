import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import ListSearchActions from '@/components/ListSearchActions'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import ListRowActions from '@/components/ListRowActions'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'

const BILL_CREDIT_COLUMNS = [
  { id: 'number', label: 'Bill Credit Id' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'bill', label: 'Bill' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'date', label: 'Date' },
  { id: 'reason', label: 'Reason' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'currency', label: 'Currency' },
  { id: 'db-id', label: 'DB Id' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
] as const

export default async function BillCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const { moneySettings } = await loadCompanyDisplaySettings()
  const query = (params.q ?? '').trim()

  const where = query
    ? {
        OR: [
          { number: { contains: query } },
          { status: { contains: query } },
          { reason: { contains: query } },
          { vendor: { name: { contains: query } } },
          { bill: { is: { number: { contains: query } } } },
        ],
      }
    : {}

  const totalCount = await prisma.billCredit.count({ where })
  const pagination = getPagination(totalCount, params.page)
  const billCredits = await prisma.billCredit.findMany({
    where,
    include: {
      vendor: true,
      bill: true,
      subsidiary: true,
      currency: true,
    },
    orderBy: { createdAt: 'desc' },
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    search.set('page', String(nextPage))
    return `/bill-credits?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Bill Credits</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {totalCount} total
            </p>
          </div>
          <Link
            href="/bill-credits/new"
            className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            + New Bill Credit
          </Link>
        </div>
      </div>

      <section
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
      >
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" />
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search bill credit id, vendor, bill, status, or reason"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <ListSearchActions
              tableId="bill-credits-list"
              exportFileName="bill-credits"
              exportAllUrl={buildMasterDataExportUrl('bill-credits', params.q)}
              columns={BILL_CREDIT_COLUMNS as unknown as Array<{ id: string; label: string; defaultVisible?: boolean; locked?: boolean }>}
            />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="bill-credits-list">
          <table className="min-w-full" id="bill-credits-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {BILL_CREDIT_COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    data-column={column.id}
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}
                  >
                    <RecordListHeaderLabel label={column.label} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {billCredits.length === 0 ? (
                <tr>
                  <td colSpan={BILL_CREDIT_COLUMNS.length} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No bill credits found.
                  </td>
                </tr>
              ) : (
                billCredits.map((billCredit, index) => (
                  <tr key={billCredit.id} style={index < billCredits.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}>
                    <td data-column="number" className="px-4 py-2 text-sm">
                      <Link href={`/bill-credits/${billCredit.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {billCredit.number}
                      </Link>
                    </td>
                    <td data-column="vendor" className="px-4 py-2 text-sm">
                      <Link href={`/vendors/${billCredit.vendor.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {billCredit.vendor.name}
                      </Link>
                    </td>
                    <td data-column="bill" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {billCredit.bill ? (
                        <Link href={`/bills/${billCredit.bill.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {billCredit.bill.number}
                        </Link>
                      ) : '—'}
                    </td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{billCredit.status}</td>
                    <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtCurrency(billCredit.total, billCredit.currency?.code ?? billCredit.currency?.currencyId ?? undefined, moneySettings)}
                    </td>
                    <td data-column="date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(billCredit.date, moneySettings)}</td>
                    <td data-column="reason" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{billCredit.reason ?? '—'}</td>
                    <td data-column="subsidiary" className="px-4 py-2 text-sm">
                      {billCredit.subsidiary ? (
                        <Link href={`/subsidiaries/${billCredit.subsidiary.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {billCredit.subsidiary.name}
                        </Link>
                      ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </td>
                    <td data-column="currency" className="px-4 py-2 text-sm">
                      {billCredit.currency ? (
                        <Link href={`/currencies/${billCredit.currency.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {billCredit.currency.code ?? billCredit.currency.currencyId}
                        </Link>
                      ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </td>
                    <td data-column="db-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{billCredit.id}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(billCredit.createdAt, moneySettings)}</td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(billCredit.updatedAt, moneySettings)}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <ListRowActions
                        viewHref={`/bill-credits/${billCredit.id}`}
                        editHref={`/bill-credits/${billCredit.id}?edit=1`}
                        deleteButton={{ endpoint: '/api/bill-credits', id: billCredit.id, label: billCredit.number }}
                      />
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
          total={totalCount}
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
