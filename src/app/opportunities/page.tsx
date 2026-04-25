import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, toNumericValue } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import DeleteButton from '@/components/DeleteButton'
import OpportunityStageMoveButton from '@/components/OpportunityStageMoveButton'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { loadListOptionsForSource } from '@/lib/list-source'
import { DEFAULT_RECORD_LIST_SORT, prependIdSortOption } from '@/lib/record-list-sort'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'

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
  { id: 'opportunity-number', label: 'Opportunity Id' },
  { id: 'name', label: 'Name' },
  { id: 'customer', label: 'Customer' },
  { id: 'stage', label: 'Stage' },
  { id: 'amount', label: 'Amount' },
  { id: 'close-date', label: 'Close Date' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
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
  const { moneySettings } = await loadCompanyDisplaySettings()
  const query = (params.q ?? '').trim()
  const stageFilter = params.stage ?? 'all'
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const sortOptions = prependIdSortOption([
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'amount-desc', label: 'Amount high-low' },
    { value: 'amount-asc', label: 'Amount low-high' },
  ])
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
    sort === 'id'
      ? [{ opportunityNumber: 'asc' as const }, { createdAt: 'desc' as const }]
      : sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'amount-desc'
        ? [{ amount: 'desc' as const }]
        : sort === 'amount-asc'
          ? [{ amount: 'asc' as const }]
          : [{ createdAt: 'desc' as const }]

  const [totalOpportunities, companySettings, cabinetFiles, stageOptions] = await Promise.all([
    prisma.opportunity.count({ where }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-OPP-STAGE' }),
  ])
  const STAGE_OPTIONS = stageOptions.map((option) => option.value)

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

  const filteredOpportunities = withNormalizedStage
  const opportunitiesByStage = STAGE_OPTIONS.map((stage) => ({
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
          <h1 className="text-xl font-semibold text-white">Opportunities</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalOpportunities} total</p>
        </div>
        <Link
          href="/opportunities/new"
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Opportunity
        </Link>
      </div>
      {/* Stage tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['all', ...STAGE_OPTIONS].map((s) => {
          const active = stageFilter === s
          const href = `/opportunities?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), stage: s, view, page: '1' }).toString()}`
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
              {s === 'all' ? 'All' : stageOptions.find((option) => option.value === s)?.label ?? STAGE_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1)}
            </Link>
          )
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="flex gap-3 items-center flex-nowrap">
                <input
                  type="text"
                  name="q"
                  defaultValue={params.q ?? ''}
                  placeholder="Search opportunity id, name, customer, stage"
                  className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                />
                <input type="hidden" name="stage" value={stageFilter} />
                <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select name="view" defaultValue={view} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
                  <option value="table">Table view</option>
                  <option value="board">Kanban view</option>
                </select>
                <input type="hidden" name="page" value="1" />
                <div className="flex items-center gap-2">
                  <ExportButton tableId="opportunities-list" fileName="opportunities" />                </div>
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
                              const stageIndex = STAGE_OPTIONS.indexOf(column.stage)
                              const prevStage = stageIndex > 0 ? STAGE_OPTIONS[stageIndex - 1] : null
                              const nextStage = stageIndex < STAGE_OPTIONS.length - 1 ? STAGE_OPTIONS[stageIndex + 1] : null

                              return (
                                <div key={opportunity.id} className="rounded-lg border p-3" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
                                  <Link href={`/opportunities/${opportunity.id}`} className="text-[11px] font-medium tracking-wide hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                                    {opportunity.opportunityNumber ?? 'Pending'}
                                  </Link>
                                  <p className="text-sm font-semibold text-white">{opportunity.name}</p>
                                  <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{opportunity.customer.name}</p>
                                  <p className="mt-2 text-sm font-medium text-white">{fmtCurrency(opportunity.amount, undefined, moneySettings)}</p>
                                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {opportunity.closeDate ? fmtDocumentDate(opportunity.closeDate, moneySettings) : 'No close date'}
                                  </p>
                                  <div className="mt-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      {prevStage ? (
                                        <OpportunityStageMoveButton
                                          id={opportunity.id}
                                          name={opportunity.name}
                                          amount={toNumericValue(opportunity.amount, 0)}
                                          closeDate={opportunity.closeDate ? new Date(opportunity.closeDate).toISOString() : ''}
                                          targetStage={prevStage}
                                          label="Back"
                                        />
                                      ) : null}
                                      {nextStage ? (
                                        <OpportunityStageMoveButton
                                          id={opportunity.id}
                                          name={opportunity.name}
                                          amount={toNumericValue(opportunity.amount, 0)}
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
          <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="opportunities-list">
          <table className="min-w-full" id="opportunities-list">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  {OPPORTUNITY_COLUMNS.map((column) => (
                    <th key={column.id} data-column={column.id} className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>
                      <RecordListHeaderLabel label={column.label} tooltip={'tooltip' in column ? column.tooltip : undefined} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOpportunities.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
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
                    <td data-column="amount" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(opportunity.amount, undefined, moneySettings)}</td>
                    <td data-column="close-date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{opportunity.closeDate ? fmtDocumentDate(opportunity.closeDate, moneySettings) : '—'}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(opportunity.createdAt, moneySettings)}</td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(opportunity.updatedAt, moneySettings)}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/opportunities/${opportunity.id}?edit=1`}
                          className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                        >
                          Edit
                        </Link>
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

