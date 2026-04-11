import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/format'
import OpportunityCreateForm from '@/components/OpportunityCreateForm'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import OpportunityStageMoveButton from '@/components/OpportunityStageMoveButton'
import CreateModalButton from '@/components/CreateModalButton'
import ColumnSelector from '@/components/ColumnSelector'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'

const STAGE_ORDER = ['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost'] as const

const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prospecting',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

const OPPORTUNITY_COLUMNS = [
  { id: 'opportunity-number', label: 'Opportunity #' },
  { id: 'name', label: 'Name' },
  { id: 'customer', label: 'Customer' },
  { id: 'stage', label: 'Stage' },
  { id: 'amount', label: 'Amount' },
  { id: 'close-date', label: 'Close Date' },
  { id: 'actions', label: 'Actions', locked: true },
]

function normalizeStage(stage: string | null | undefined) {
  const value = (stage ?? '').toLowerCase()
  if (value === 'qualified') return 'qualification'
  return STAGE_ORDER.includes(value as (typeof STAGE_ORDER)[number]) ? value : 'prospecting'
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; sort?: string; view?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const stageFilter = params.stage ?? 'all'
  const sort = params.sort ?? 'newest'
  const view = params.view === 'board' ? 'board' : 'table'

  const stageWhere =
    stageFilter === 'all'
      ? {}
      : stageFilter === 'qualification'
        ? {
            OR: [{ stage: 'qualification' }, { stage: 'qualified' }],
          }
        : { stage: stageFilter }

  const queryWhere = query
    ? {
        OR: [
          { opportunityNumber: { contains: query } },
          { name: { contains: query } },
          { stage: { contains: query } },
          { customer: { name: { contains: query } } },
        ],
      }
    : {}

  const where = {
    ...stageWhere,
    ...queryWhere,
  }

  const orderBy =
    sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'amount-desc'
        ? [{ amount: 'desc' as const }]
        : sort === 'amount-asc'
          ? [{ amount: 'asc' as const }]
          : [{ createdAt: 'desc' as const }]

  const [totalOpportunities, customers, adminUser, pipelineAgg] = await Promise.all([
    prisma.opportunity.count({ where }),
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findUnique({ where: { email: 'admin@example.com' } }),
    prisma.opportunity.aggregate({ where, _sum: { amount: true } }),
  ])

  const pagination = getPagination(totalOpportunities, params.page)

  const opportunities = await prisma.opportunity.findMany({
    where,
    include: { customer: true },
    orderBy,
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const withNormalizedStage = opportunities.map((opportunity) => ({
    ...opportunity,
    normalizedStage: normalizeStage(opportunity.stage),
  }))

  const pipelineValue = pipelineAgg._sum.amount ?? 0
  const filteredOpportunities = withNormalizedStage
  const opportunitiesByStage = STAGE_ORDER.map((stage) => ({
    stage,
    items: filteredOpportunities.filter((opportunity) => opportunity.normalizedStage === stage),
  }))


  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (stageFilter !== 'all') search.set('stage', stageFilter)
    if (sort) search.set('sort', sort)
    search.set('view', view)
    search.set('page', String(nextPage))
    return `/opportunities?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Opportunities</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalOpportunities} total</p>
        </div>
        {adminUser ? (
          <CreateModalButton buttonLabel="New Opportunity" title="New Opportunity">
            <OpportunityCreateForm userId={adminUser.id} customers={customers} />
          </CreateModalButton>
        ) : null}
      </div>

      <div className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Pipeline value: {fmtCurrency(pipelineValue)}</div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
                <input
                  type="text"
                  name="q"
                  defaultValue={params.q ?? ''}
                  placeholder="Search opportunity ID, name, customer, stage"
                  className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                />
                <select name="stage" defaultValue={stageFilter} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                  <option value="all">All stages</option>
                  <option value="prospecting">Prospecting</option>
                  <option value="qualification">Qualification</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
                <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="amount-desc">Amount high-low</option>
                  <option value="amount-asc">Amount low-high</option>
                </select>
                <select name="view" defaultValue={view} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                  <option value="table">Table view</option>
                  <option value="board">Kanban view</option>
                </select>
                <input type="hidden" name="page" value="1" />
                <div className="flex items-center gap-2">
                  <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>Apply</button>
                  <Link href={`/opportunities?view=${view}`} className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Reset</Link>
                </div>
                {view === 'table' ? <ColumnSelector tableId="opportunities-list" columns={OPPORTUNITY_COLUMNS} /> : null}
          </div>
        </form>
        {view === 'board' ? (
          <div className="p-6 pt-6 overflow-x-auto">
                  <div className="grid min-w-[1100px] grid-cols-6 gap-4">
                    {opportunitiesByStage.map((column) => (
                      <div key={column.stage} className="rounded-xl border p-3" style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}>
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-white">{STAGE_LABELS[column.stage]}</h3>
                          <span className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>{column.items.length}</span>
                        </div>
                        <div className="space-y-3">
                          {column.items.length === 0 ? (
                            <p className="rounded-md border border-dashed px-2 py-3 text-center text-xs" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}>No opportunities</p>
                          ) : (
                            column.items.map((opportunity) => {
                              const stageIndex = STAGE_ORDER.indexOf(column.stage)
                              const prevStage = stageIndex > 0 ? STAGE_ORDER[stageIndex - 1] : null
                              const nextStage = stageIndex < STAGE_ORDER.length - 1 ? STAGE_ORDER[stageIndex + 1] : null

                              return (
                                <div key={opportunity.id} className="rounded-lg border p-3" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
                                  <Link href={`/opportunities/${opportunity.id}`} className="text-[11px] font-medium tracking-wide hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                                    {opportunity.opportunityNumber ?? 'Pending'}
                                  </Link>
                                  <p className="text-sm font-semibold text-white">{opportunity.name}</p>
                                  <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{opportunity.customer.name}</p>
                                  <p className="mt-2 text-sm font-medium text-white">{fmtCurrency(opportunity.amount)}</p>
                                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {opportunity.closeDate ? new Date(opportunity.closeDate).toLocaleDateString() : 'No close date'}
                                  </p>
                                  <div className="mt-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      {prevStage ? (
                                        <OpportunityStageMoveButton
                                          id={opportunity.id}
                                          name={opportunity.name}
                                          amount={opportunity.amount}
                                          closeDate={opportunity.closeDate ? new Date(opportunity.closeDate).toISOString() : ''}
                                          targetStage={prevStage}
                                          label="Back"
                                        />
                                      ) : null}
                                      {nextStage ? (
                                        <OpportunityStageMoveButton
                                          id={opportunity.id}
                                          name={opportunity.name}
                                          amount={opportunity.amount}
                                          closeDate={opportunity.closeDate ? new Date(opportunity.closeDate).toISOString() : ''}
                                          targetStage={nextStage}
                                          label="Advance"
                                        />
                                      ) : null}
                                    </div>
                                    <DeleteButton resource="opportunities" id={opportunity.id} />
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
          </div>
        ) : (
          <div className="overflow-x-auto" data-column-selector-table="opportunities-list">
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  <th data-column="opportunity-number" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Opportunity #</th>
                  <th data-column="name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                  <th data-column="customer" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Customer</th>
                  <th data-column="stage" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Stage</th>
                  <th data-column="amount" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Amount</th>
                  <th data-column="close-date" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Close Date</th>
                  <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpportunities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      No opportunities found
                    </td>
                  </tr>
                ) : filteredOpportunities.map((opportunity, index) => (
                  <tr key={opportunity.id} style={index < filteredOpportunities.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="opportunity-number" className="px-4 py-2 text-sm font-medium">
                      <Link href={`/opportunities/${opportunity.id}`} className="hover:underline font-medium" style={{ color: 'var(--accent-primary-strong)' }}>
                        {opportunity.opportunityNumber ?? 'Pending'}
                      </Link>
                    </td>
                    <td data-column="name" className="px-4 py-2 text-sm text-white">{opportunity.name}</td>
                    <td data-column="customer" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{opportunity.customer.name}</td>
                    <td data-column="stage" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{STAGE_LABELS[opportunity.normalizedStage]}</td>
                    <td data-column="amount" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(opportunity.amount)}</td>
                    <td data-column="close-date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{opportunity.closeDate ? new Date(opportunity.closeDate).toLocaleDateString() : '—'}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="opportunities"
                          id={opportunity.id}
                          fields={[
                            { name: 'name', label: 'Name', value: opportunity.name },
                            { name: 'stage', label: 'Stage', value: opportunity.normalizedStage },
                            { name: 'amount', label: 'Amount', value: opportunity.amount?.toString() ?? '', type: 'number' },
                            { name: 'closeDate', label: 'Close Date', value: opportunity.closeDate ? new Date(opportunity.closeDate).toISOString().split('T')[0] : '', type: 'date' },
                          ]}
                        />
                        <DeleteButton resource="opportunities" id={opportunity.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={totalOpportunities}
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