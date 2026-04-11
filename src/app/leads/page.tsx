import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import ConvertLeadButton from '@/components/ConvertLeadButton'
import ColumnSelector from '@/components/ColumnSelector'
import PaginationFooter from '@/components/PaginationFooter'
import LeadCreateForm from '@/components/LeadCreateForm'
import { getPagination } from '@/lib/pagination'

const LEAD_COLUMNS = [
  { id: 'lead-number', label: 'Lead #' },
  { id: 'name', label: 'Name' },
  { id: 'company', label: 'Company' },
  { id: 'status', label: 'Status' },
  { id: 'source', label: 'Source' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'currency', label: 'Currency' },
  { id: 'created', label: 'Created' },
  { id: 'actions', label: 'Actions', locked: true },
]

function leadName(lead: { firstName: string | null; lastName: string | null; email: string | null }) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  return fullName || lead.email || '—'
}

export default async function LeadsPage({
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
            { leadNumber: { contains: query } },
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { email: { contains: query } },
            { company: { contains: query } },
            { source: { contains: query } },
          ],
        }
      : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const orderBy =
    sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'name'
        ? [{ firstName: 'asc' as const }, { lastName: 'asc' as const }, { createdAt: 'desc' as const }]
        : sort === 'company'
          ? [{ company: 'asc' as const }, { createdAt: 'desc' as const }]
          : [{ createdAt: 'desc' as const }]

  const [totalLeads, adminUser, entities, currencies] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.user.findUnique({ where: { email: 'admin@example.com' } }),
    prisma.entity.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
  ])

  const pagination = getPagination(totalLeads, params.page)

  const leads = await prisma.lead.findMany({
    where,
    include: { entity: true, currency: true, opportunity: true },
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
    return `/leads?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Leads</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalLeads} total</p>
        </div>
        {adminUser ? (
          <CreateModalButton buttonLabel="New Lead" title="New Lead">
            <LeadCreateForm userId={adminUser.id} entities={entities} currencies={currencies} />
          </CreateModalButton>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto_auto]">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search lead #, name, email, company, source"
              className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <select name="status" defaultValue={statusFilter} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="working">Working</option>
              <option value="qualified">Qualified</option>
              <option value="nurturing">Nurturing</option>
              <option value="converted">Converted</option>
              <option value="unqualified">Unqualified</option>
            </select>
            <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A-Z</option>
              <option value="company">Company A-Z</option>
            </select>
            <input type="hidden" name="page" value="1" />
            <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>Apply</button>
            <a href="/leads" className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Reset</a>
            <ColumnSelector tableId="leads-list" columns={LEAD_COLUMNS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="leads-list">
          <table className="min-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="lead-number" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Lead #</th>
                <th data-column="name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                <th data-column="company" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Company</th>
                <th data-column="status" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Status</th>
                <th data-column="source" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Source</th>
                <th data-column="subsidiary" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Subsidiary</th>
                <th data-column="currency" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Currency</th>
                <th data-column="created" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
                <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No leads found</td>
                </tr>
              ) : (
                leads.map((lead, index) => (
                  <tr key={lead.id} style={index < leads.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="lead-number" className="px-4 py-2 text-sm">
                      <Link href={`/leads/${lead.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {lead.leadNumber ?? 'Pending'}
                      </Link>
                    </td>
                    <td data-column="name" className="px-4 py-2 text-sm font-medium text-white">{leadName(lead)}</td>
                    <td data-column="company" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{lead.company ?? '—'}</td>
                    <td data-column="status" className="px-4 py-2 text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{lead.status}</td>
                    <td data-column="source" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{lead.source ?? '—'}</td>
                    <td data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{lead.entity?.code ?? '—'}</td>
                    <td data-column="currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{lead.currency?.code ?? '—'}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(lead.createdAt).toLocaleDateString()}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <ConvertLeadButton
                          leadId={lead.id}
                          canConvert={lead.status === 'qualified'}
                          opportunityId={lead.opportunity?.id ?? null}
                        />
                        <EditButton
                          resource="leads"
                          id={lead.id}
                          fields={[
                            { name: 'firstName', label: 'First Name', value: lead.firstName ?? '' },
                            { name: 'lastName', label: 'Last Name', value: lead.lastName ?? '' },
                            { name: 'company', label: 'Company', value: lead.company ?? '' },
                            { name: 'email', label: 'Email', value: lead.email ?? '' },
                            { name: 'phone', label: 'Phone', value: lead.phone ?? '' },
                            { name: 'title', label: 'Title', value: lead.title ?? '' },
                            { name: 'status', label: 'Status', value: lead.status ?? '' },
                            { name: 'source', label: 'Source', value: lead.source ?? '' },
                            { name: 'rating', label: 'Rating', value: lead.rating ?? '' },
                            { name: 'expectedValue', label: 'Expected Value', value: lead.expectedValue?.toString() ?? '', type: 'number' },
                            { name: 'notes', label: 'Notes', value: lead.notes ?? '' },
                          ]}
                        />
                        <DeleteButton resource="leads" id={lead.id} />
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
          total={totalLeads}
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
