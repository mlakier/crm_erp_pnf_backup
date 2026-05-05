import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import ListSearchActions from '@/components/ListSearchActions'
import PaginationFooter from '@/components/PaginationFooter'
import ListRowActions from '@/components/ListRowActions'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { getPagination } from '@/lib/pagination'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { loadJournalEntryFormOptions } from '@/lib/journal-entry-form-options'
import { createRecordLabelMapFromOptions, formatRecordLabel } from '@/lib/record-status-label'

const JE_COLUMNS = [
  { id: 'number', label: 'Journal Id' },
  { id: 'date', label: 'Date' },
  { id: 'description', label: 'Description' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'currency', label: 'Currency' },
  { id: 'period', label: 'Accounting Period' },
  { id: 'source-type', label: 'Source Type', defaultVisible: false },
  { id: 'source-id', label: 'Source Id', defaultVisible: false },
  { id: 'created-by', label: 'Created By', defaultVisible: false },
  { id: 'posted-by', label: 'Prepared By' },
  { id: 'approved-by', label: 'Approved By', defaultVisible: false },
  { id: 'db-id', label: 'DB Id', defaultVisible: false },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified', defaultVisible: false },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function JournalsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const params = await searchParams
  const { moneySettings } = await loadCompanyDisplaySettings()
  const query = (params.q ?? '').trim()
  const statusFilter = params.status ?? 'all'
  const where = {
    journalType: 'standard',
    ...(query ? { OR: [{ number: { contains: query } }, { description: { contains: query } }, { status: { contains: query } }, { sourceId: { contains: query } }] } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const orderBy = [{ createdAt: 'desc' as const }]

  const [totalRows, formOptions] = await Promise.all([
    prisma.journalEntry.count({ where }),
    loadJournalEntryFormOptions(),
  ])
  const statusOptions = Array.from(new Set(formOptions.statusFilterValues))
  const statusLabelMap = createRecordLabelMapFromOptions(formOptions.statusOptions)

  const pagination = getPagination(totalRows, params.page)
  const rows = await prisma.journalEntry.findMany({ where, include: { subsidiary: true, currency: true, user: true, accountingPeriod: true, postedByEmployee: true, approvedByEmployee: true, lineItems: true }, orderBy, skip: pagination.skip, take: pagination.pageSize })

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (statusFilter !== 'all') s.set('status', statusFilter)
    s.set('page', String(p))
    return '/journals?' + s.toString()
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Journal Entries</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalRows} total</p>
        </div>
        <Link
          href="/journals/new"
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          <span className="mr-1.5 text-lg leading-none">+</span>New Journal Entry
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((status) => {
          const active = statusFilter === status
          const href = '/journals?' + new URLSearchParams({ ...(params.q ? { q: params.q } : {}), status, page: '1' }).toString()
          return <Link key={status} href={href} className="rounded-full px-3 py-1 text-xs font-medium transition-colors" style={active ? { backgroundColor: 'var(--accent-primary-strong)', color: '#fff' } : { backgroundColor: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border-muted)' }}>{status === 'all' ? 'All' : formatRecordLabel(status, statusLabelMap)}</Link>
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" /><input type="hidden" name="status" value={statusFilter} />
          <div className="flex gap-3 items-center flex-nowrap">
            <input type="text" name="q" defaultValue={params.q ?? ''} placeholder="Search journal id, description, status" className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            <ListSearchActions
              tableId="journals-list"
              exportFileName="journals"
              exportAllUrl={buildMasterDataExportUrl('journals', params.q ?? '')}
              columns={JE_COLUMNS}
            />
          </div>
        </form>
        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="journals-list">
          <table className="min-w-full" id="journals-list">
            <thead><tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
              {JE_COLUMNS.map((c) => (
                <th key={c.id} data-column={c.id} className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>
                  <RecordListHeaderLabel label={c.label} tooltip={'tooltip' in c ? c.tooltip : undefined} />
                </th>
              ))}
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={16} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No journal entries yet.</td></tr>
              ) : rows.map((row, i) => (
                <tr key={row.id} style={i < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                  <td data-column="number" className="px-4 py-2 text-sm font-medium">
                    <Link href={`/journals/${row.id}`} style={{ color: 'var(--accent-primary-strong)' }}>
                      {row.number}
                    </Link>
                  </td>
                  <td data-column="date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(row.date, moneySettings)}</td>
                  <td data-column="description" className="px-4 py-2 text-sm truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>{row.description ?? '\u2014'}</td>
                  <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatRecordLabel(row.status, statusLabelMap)}</td>
                  <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {fmtCurrency(
                      row.total,
                      row.currency?.code ?? row.currency?.currencyId ?? undefined,
                      moneySettings,
                    )}
                  </td>
                  <td data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.subsidiary?.name ?? '\u2014'}</td>
                  <td data-column="currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.currency?.code ?? '\u2014'}</td>
                  <td data-column="period" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.accountingPeriod?.name ?? '\u2014'}</td>
                  <td data-column="source-type" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.sourceType ?? '\u2014'}</td>
                  <td data-column="source-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.sourceId ?? '\u2014'}</td>
                  <td data-column="created-by" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.user ? (row.user.userId && row.user.name ? `${row.user.userId} - ${row.user.name}` : row.user.userId ?? row.user.name ?? row.user.email) : '\u2014'}</td>
                  <td data-column="posted-by" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.postedByEmployee ? `${row.postedByEmployee.firstName} ${row.postedByEmployee.lastName}` : '\u2014'}</td>
                  <td data-column="approved-by" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.approvedByEmployee ? `${row.approvedByEmployee.firstName} ${row.approvedByEmployee.lastName}` : '\u2014'}</td>
                  <td data-column="db-id" className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{row.id}</td>
                  <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(row.createdAt, moneySettings)}</td>
                  <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(row.updatedAt, moneySettings)}</td>
                  <td data-column="actions" className="px-4 py-2 text-sm">
                    <ListRowActions
                      viewHref={`/journals/${row.id}`}
                      editHref={`/journals/${row.id}?edit=1`}
                      deleteButton={{ id: row.id, endpoint: '/api/journals', label: row.number }}
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

