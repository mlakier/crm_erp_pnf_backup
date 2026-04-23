import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import CreateModalButton from '@/components/CreateModalButton'
import JournalEntryCreateForm from '@/components/JournalEntryCreateForm'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { DEFAULT_RECORD_LIST_SORT, prependIdSortOption } from '@/lib/record-list-sort'
import { loadListValues } from '@/lib/load-list-values'

const JE_COLUMNS = [
  { id: 'number', label: 'Journal Id' },
  { id: 'date', label: 'Date' },
  { id: 'description', label: 'Description' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'currency', label: 'Currency' },
  { id: 'period', label: 'Accounting Period' },
  { id: 'source-type', label: 'Source Type' },
  { id: 'posted-by', label: 'Posted By' },
  { id: 'approved-by', label: 'Approved By' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function JournalsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string }> }) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const statusFilter = params.status ?? 'all'
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const sortOptions = prependIdSortOption([
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'total-desc', label: 'Total high-low' },
    { value: 'total-asc', label: 'Total low-high' },
  ])
  const where = {
    ...(query ? { OR: [{ number: { contains: query } }, { description: { contains: query } }, { status: { contains: query } }] } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const orderBy = sort === 'id' ? [{ number: 'asc' as const }, { createdAt: 'desc' as const }] : sort === 'oldest' ? [{ createdAt: 'asc' as const }] : sort === 'total-desc' ? [{ total: 'desc' as const }] : sort === 'total-asc' ? [{ total: 'asc' as const }] : [{ createdAt: 'desc' as const }]

  const [totalRows, entities, currencies, accountingPeriods, employees, companySettings, cabinetFiles, statusValues] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, currencyId: true, code: true, name: true } }),
    prisma.accountingPeriod.findMany({ orderBy: { startDate: 'desc' }, select: { id: true, name: true } }),
    prisma.employee.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], select: { id: true, employeeId: true, firstName: true, lastName: true } }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('JOURNAL-STATUS'),
  ])
  const STATUS_OPTIONS = ['all', ...statusValues.map((value) => value.toLowerCase())]
  const statusOptions = statusValues.map((value) => ({ value: value.toLowerCase(), label: value }))

  const pagination = getPagination(totalRows, params.page)
  const rows = await prisma.journalEntry.findMany({ where, include: { subsidiary: true, currency: true, user: true, accountingPeriod: true, postedByEmployee: true, approvedByEmployee: true, lineItems: true }, orderBy, skip: pagination.skip, take: pagination.pageSize })

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (statusFilter !== 'all') s.set('status', statusFilter)
    if (sort) s.set('sort', sort)
    s.set('page', String(p))
    return '/journals?' + s.toString()
  }

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages = cabinetFiles.find((file) => file.id === selectedLogoValue) ?? cabinetFiles.find((file) => file.originalName === selectedLogoValue) ?? cabinetFiles.find((file) => file.storedName === selectedLogoValue) ?? (!selectedLogoValue ? cabinetFiles[0] : undefined)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? <img src={companyLogoPages.url} alt="Company logo" className="h-16 w-auto rounded" /> : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Journal Entries</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalRows} total</p>
        </div>
        <CreateModalButton buttonLabel="New Journal Entry" title="New Journal Entry">
          <JournalEntryCreateForm entities={entities} currencies={currencies} accountingPeriods={accountingPeriods} employees={employees} statusOptions={statusOptions} />
        </CreateModalButton>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((s) => {
          const active = statusFilter === s
          const href = '/journals?' + new URLSearchParams({ ...(params.q ? { q: params.q } : {}), status: s, page: '1' }).toString()
          return <Link key={s} href={href} className="rounded-full px-3 py-1 text-xs font-medium transition-colors" style={active ? { backgroundColor: 'var(--accent-primary-strong)', color: '#fff' } : { backgroundColor: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border-muted)' }}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</Link>
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" /><input type="hidden" name="status" value={statusFilter} />
          <div className="flex gap-3 items-center flex-nowrap">
            <input type="text" name="q" defaultValue={params.q ?? ''} placeholder="Search journal id, description, status" className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            <ExportButton tableId="journals-list" fileName="journals" />
            <ColumnSelector tableId="journals-list" columns={JE_COLUMNS} />
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
                <tr><td colSpan={14} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No journal entries yet.</td></tr>
              ) : rows.map((row, i) => (
                <tr key={row.id} style={i < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                  <td data-column="number" className="px-4 py-2 text-sm font-medium" style={{ color: 'var(--accent-primary-strong)' }}>{row.number}</td>
                  <td data-column="date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(row.date).toLocaleDateString()}</td>
                  <td data-column="description" className="px-4 py-2 text-sm truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>{row.description ?? '\u2014'}</td>
                  <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.status}</td>
                  <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(row.total)}</td>
                  <td data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.subsidiary?.name ?? '\u2014'}</td>
                  <td data-column="currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.currency?.code ?? '\u2014'}</td>
                  <td data-column="period" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.accountingPeriod?.name ?? '\u2014'}</td>
                  <td data-column="source-type" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.sourceType ?? '\u2014'}</td>
                  <td data-column="posted-by" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.postedByEmployee ? `${row.postedByEmployee.firstName} ${row.postedByEmployee.lastName}` : '\u2014'}</td>
                  <td data-column="approved-by" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.approvedByEmployee ? `${row.approvedByEmployee.firstName} ${row.approvedByEmployee.lastName}` : '\u2014'}</td>
                  <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(row.updatedAt).toLocaleDateString()}</td>
                  <td data-column="actions" className="px-4 py-2 text-sm"><span className="flex items-center gap-2">
                    <EditButton id={row.id} endpoint="/api/journals" fields={[{ name: 'status', label: 'Status', type: 'select', value: row.status, options: statusOptions }, { name: 'total', label: 'Total', type: 'number', value: String(row.total) }, { name: 'description', label: 'Description', type: 'text', value: row.description ?? '' }, { name: 'subsidiaryId', label: 'Subsidiary', value: row.subsidiaryId ?? '', type: 'select', placeholder: 'Select subsidiary', options: entities.map((Subsidiary) => ({ value: Subsidiary.id, label: `${Subsidiary.subsidiaryId} - ${Subsidiary.name}` })) }, { name: 'currencyId', label: 'Currency', value: row.currencyId ?? '', type: 'select', placeholder: 'Select currency', options: currencies.map((currency) => ({ value: currency.id, label: `${currency.code} - ${currency.name}` })) }, { name: 'accountingPeriodId', label: 'Accounting Period', value: row.accountingPeriodId ?? '', type: 'select', placeholder: 'Select period', options: accountingPeriods.map((period) => ({ value: period.id, label: period.name })) }, { name: 'sourceType', label: 'Source Type', type: 'text', value: row.sourceType ?? '' }, { name: 'sourceId', label: 'Source Id', type: 'text', value: row.sourceId ?? '' }, { name: 'postedByEmployeeId', label: 'Posted By', value: row.postedByEmployeeId ?? '', type: 'select', placeholder: 'Select employee', options: employees.map((employee) => ({ value: employee.id, label: `${employee.employeeId ?? 'EMP'} - ${employee.firstName} ${employee.lastName}` })) }, { name: 'approvedByEmployeeId', label: 'Approved By', value: row.approvedByEmployeeId ?? '', type: 'select', placeholder: 'Select employee', options: employees.map((employee) => ({ value: employee.id, label: `${employee.employeeId ?? 'EMP'} - ${employee.firstName} ${employee.lastName}` })) }]} />
                    <DeleteButton id={row.id} endpoint="/api/journals" label={row.number} />
                  </span></td>
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
