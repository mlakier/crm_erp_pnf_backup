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

const CREDIT_MEMO_COLUMNS = [
  { id: 'number', label: 'Credit Memo Id' },
  { id: 'customer', label: 'Customer' },
  { id: 'invoice', label: 'Invoice' },
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

export default async function CreditMemosPage({
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
          { customer: { name: { contains: query } } },
          { invoice: { is: { number: { contains: query } } } },
        ],
      }
    : {}

  const totalCount = await prisma.creditMemo.count({ where })
  const pagination = getPagination(totalCount, params.page)
  const creditMemos = await prisma.creditMemo.findMany({
    where,
    include: {
      customer: true,
      invoice: true,
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
    return `/credit-memos?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Credit Memos</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {totalCount} total
            </p>
          </div>
          <Link
            href="/credit-memos/new"
            className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            + New Credit Memo
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
              placeholder="Search credit memo id, customer, invoice, status, or reason"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <ListSearchActions
              tableId="credit-memos-list"
              exportFileName="credit-memos"
              exportAllUrl={buildMasterDataExportUrl('credit-memos', params.q)}
              columns={CREDIT_MEMO_COLUMNS as unknown as Array<{ id: string; label: string; defaultVisible?: boolean; locked?: boolean }>}
            />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="credit-memos-list">
          <table className="min-w-full" id="credit-memos-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {CREDIT_MEMO_COLUMNS.map((column) => (
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
              {creditMemos.length === 0 ? (
                <tr>
                  <td colSpan={CREDIT_MEMO_COLUMNS.length} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No credit memos found.
                  </td>
                </tr>
              ) : (
                creditMemos.map((creditMemo, index) => (
                  <tr key={creditMemo.id} style={index < creditMemos.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}>
                    <td data-column="number" className="px-4 py-2 text-sm">
                      <Link href={`/credit-memos/${creditMemo.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {creditMemo.number}
                      </Link>
                    </td>
                    <td data-column="customer" className="px-4 py-2 text-sm">
                      <Link href={`/customers/${creditMemo.customer.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {creditMemo.customer.name}
                      </Link>
                    </td>
                    <td data-column="invoice" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {creditMemo.invoice ? (
                        <Link href={`/invoices/${creditMemo.invoice.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {creditMemo.invoice.number}
                        </Link>
                      ) : '—'}
                    </td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{creditMemo.status}</td>
                    <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtCurrency(creditMemo.total, creditMemo.currency?.code ?? creditMemo.currency?.currencyId ?? undefined, moneySettings)}
                    </td>
                    <td data-column="date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(creditMemo.date, moneySettings)}</td>
                    <td data-column="reason" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{creditMemo.reason ?? '—'}</td>
                    <td data-column="subsidiary" className="px-4 py-2 text-sm">
                      {creditMemo.subsidiary ? (
                        <Link href={`/subsidiaries/${creditMemo.subsidiary.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {creditMemo.subsidiary.name}
                        </Link>
                      ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </td>
                    <td data-column="currency" className="px-4 py-2 text-sm">
                      {creditMemo.currency ? (
                        <Link href={`/currencies/${creditMemo.currency.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {creditMemo.currency.code ?? creditMemo.currency.currencyId}
                        </Link>
                      ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </td>
                    <td data-column="db-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{creditMemo.id}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(creditMemo.createdAt, moneySettings)}</td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(creditMemo.updatedAt, moneySettings)}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <ListRowActions
                        viewHref={`/credit-memos/${creditMemo.id}`}
                        editHref={`/credit-memos/${creditMemo.id}?edit=1`}
                        deleteButton={{ endpoint: '/api/credit-memos', id: creditMemo.id, label: creditMemo.number }}
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
