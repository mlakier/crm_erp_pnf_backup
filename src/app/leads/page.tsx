import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import DeleteButton from '@/components/DeleteButton'
import LeadEditButton from '@/components/LeadEditButton'
import ConvertLeadButton from '@/components/ConvertLeadButton'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import LeadCreateForm from '@/components/LeadCreateForm'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'

const LEAD_COLUMNS = [
  { id: 'lead-number', label: 'Lead #' },
  { id: 'name', label: 'Name' },
  { id: 'company', label: 'Company' },
  { id: 'status', label: 'Status' },
  { id: 'source', label: 'Source' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'currency', label: 'Currency' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
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

  const [totalLeads, adminUser, entities, currencies, companySettings, cabinetFiles] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.user.findUnique({ where: { email: 'admin@example.com' } }),
    prisma.entity.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.currency.findMany({ orderBy: { currencyId: 'asc' }, select: { id: true, currencyId: true, name: true } }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
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
          <input type="hidden" name="page" value="1" />
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search lead #, name, company, email, source"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
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
            <ExportButton tableId="leads-list" fileName="leads" />
            <ColumnSelector tableId="leads-list" columns={LEAD_COLUMNS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="leads-list">
          <table className="min-w-full" id="leads-list">
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
                <th data-column="last-modified" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Last Modified</th>
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
                    <td data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{lead.entity?.subsidiaryId ?? '—'}</td>
                    <td data-column="currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{lead.currency?.currencyId ?? '—'}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(lead.createdAt).toLocaleDateString()}</td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(lead.updatedAt).toLocaleDateString()}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <ConvertLeadButton
                          leadId={lead.id}
                          canConvert={lead.status === 'qualified'}
                          opportunityId={lead.opportunity?.id ?? null}
                        />
                        <LeadEditButton
                          leadId={lead.id}
                          entities={entities}
                          currencies={currencies}
                          values={{
                            firstName: lead.firstName ?? '',
                            lastName: lead.lastName ?? '',
                            company: lead.company ?? '',
                            email: lead.email ?? '',
                            phone: lead.phone ?? '',
                            title: lead.title ?? '',
                            website: lead.website ?? '',
                            industry: lead.industry ?? '',
                            status: lead.status ?? 'new',
                            source: lead.source ?? '',
                            rating: lead.rating ?? '',
                            expectedValue: lead.expectedValue?.toString() ?? '',
                            entityId: lead.entityId ?? '',
                            currencyId: lead.currencyId ?? '',
                            lastContactedAt: lead.lastContactedAt ? new Date(lead.lastContactedAt).toISOString().split('T')[0] : '',
                            qualifiedAt: lead.qualifiedAt ? new Date(lead.qualifiedAt).toISOString().split('T')[0] : '',
                            convertedAt: lead.convertedAt ? new Date(lead.convertedAt).toISOString().split('T')[0] : '',
                            notes: lead.notes ?? '',
                            address: lead.address ?? '',
                          }}
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
