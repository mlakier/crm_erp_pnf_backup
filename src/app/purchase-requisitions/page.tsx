import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import ListRowActions from '@/components/ListRowActions'
import ListSearchActions from '@/components/ListSearchActions'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { loadListValues } from '@/lib/load-list-values'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sanitizeSavedSearchDefinitionState, type SavedSearchCriterion } from '@/lib/saved-search-metadata'
import { loadEffectiveSavedSearchDefinition } from '@/lib/load-effective-saved-search-definition'
import {
  PURCHASE_REQUISITION_SAVED_SEARCH_FILTERS,
  buildPurchaseRequisitionListColumns,
  buildPurchaseRequisitionSavedSearchFields,
} from '@/lib/purchase-requisitions-saved-search-metadata'

const COLS = buildPurchaseRequisitionListColumns()

export default async function PurchaseRequisitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; view?: string }>
}) {
  const params = await searchParams
  const session = await getServerSession(authOptions)
  const selectedViewId = (params.view ?? '').trim()
  const defaultViewUserId = session?.user?.id ?? null
  const savedDefinition = sanitizeSavedSearchDefinitionState(
    await loadEffectiveSavedSearchDefinition({
      tableId: 'requisitions-list',
      userId: defaultViewUserId,
      selectedViewId,
    }),
  )
  const { moneySettings } = await loadCompanyDisplaySettings()
  const query = (params.q ?? savedDefinition.filterValues.keyword ?? '').trim()
  const statusFilter = params.status ?? savedDefinition.filterValues.status ?? 'all'

  const [companySettings, cabinetFiles, statusValues, departments, vendors] = await Promise.all([
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('REQ-STATUS'),
    prisma.department.findMany({
      orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
      select: { id: true, departmentId: true, name: true },
    }),
    prisma.vendor.findMany({
      where: { inactive: false },
      orderBy: [{ vendorNumber: 'asc' }, { name: 'asc' }],
      select: { id: true, vendorNumber: true, name: true },
    }),
  ])

  const statusOptions = ['all', ...statusValues.map((value) => value.toLowerCase())]
  const purchaseRequisitionSavedSearchFields = buildPurchaseRequisitionSavedSearchFields({
    statusOptions: statusValues.map((value) => ({ value: value.toLowerCase(), label: value })),
    priorityOptions: PRIORITY_OPTIONS,
    departments,
    vendors,
  })
  const exportAllUrl = buildMasterDataExportUrl('purchase-requisitions', query, undefined, {
    status: statusFilter !== 'all' ? statusFilter : undefined,
    view: selectedViewId || undefined,
  })

  const buildStringFilter = (operator: string, value: string) => {
    const trimmed = value.trim()
    switch (operator) {
      case 'startsWith':
        return trimmed ? { startsWith: trimmed, mode: 'insensitive' as const } : null
      case 'is':
        return trimmed ? { equals: trimmed, mode: 'insensitive' as const } : null
      case 'isNot':
        return trimmed ? { not: { equals: trimmed, mode: 'insensitive' as const } } : null
      case 'isEmpty':
        return ''
      case 'isNotEmpty':
        return { not: '' }
      case 'contains':
      default:
        return trimmed ? { contains: trimmed, mode: 'insensitive' as const } : null
    }
  }

  const buildRequisitionCriterionCondition = (criterion: SavedSearchCriterion) => {
    const value = criterion.value.trim()
    const stringFilter = buildStringFilter(criterion.operator, value)

    switch (criterion.fieldId) {
      case 'number':
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        return stringFilter ? { number: stringFilter } : null
      case 'title':
        return stringFilter === '' ? { OR: [{ title: null }, { title: '' }] } : stringFilter ? { title: stringFilter } : null
      case 'status':
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        if (!value) return null
        return criterion.operator === 'isNot' ? { NOT: { status: value } } : { status: value }
      case 'priority':
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        if (!value) return null
        return criterion.operator === 'isNot' ? { NOT: { priority: value } } : { priority: value }
      case 'department':
        if (criterion.operator === 'isEmpty') return { departmentId: null }
        if (criterion.operator === 'isNotEmpty') return { departmentId: { not: null } }
        if (!value) return null
        return criterion.operator === 'isNot' ? { NOT: { departmentId: value } } : { departmentId: value }
      case 'vendor':
        if (criterion.operator === 'isEmpty') return { vendorId: null }
        if (criterion.operator === 'isNotEmpty') return { vendorId: { not: null } }
        if (!value) return null
        return criterion.operator === 'isNot' ? { NOT: { vendorId: value } } : { vendorId: value }
      case 'total': {
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        if (!value) return null
        const total = Number(value)
        if (!Number.isFinite(total)) return null
        return criterion.operator === 'isNot' ? { NOT: { total } } : { total }
      }
      case 'needed-by': {
        if (criterion.operator === 'isEmpty') return { neededByDate: null }
        if (criterion.operator === 'isNotEmpty') return { neededByDate: { not: null } }
        if (!value) return null
        const parsed = new Date(value)
        if (Number.isNaN(parsed.getTime())) return null
        const start = new Date(parsed)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(end.getDate() + 1)
        return criterion.operator === 'isNot'
          ? { NOT: { neededByDate: { gte: start, lt: end } } }
          : { neededByDate: { gte: start, lt: end } }
      }
      case 'db-id':
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        return stringFilter ? { id: stringFilter } : null
      case 'created':
      case 'last-modified': {
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        if (!value) return null
        const parsed = new Date(value)
        if (Number.isNaN(parsed.getTime())) return null
        const start = new Date(parsed)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(end.getDate() + 1)
        const field = criterion.fieldId === 'created' ? 'createdAt' : 'updatedAt'
        return criterion.operator === 'isNot'
          ? { NOT: { [field]: { gte: start, lt: end } } }
          : { [field]: { gte: start, lt: end } }
      }
      default:
        return null
    }
  }

  const buildCriteriaWhere = (criteria: SavedSearchCriterion[]) => {
    const validRows = criteria
      .map((criterion) => ({
        criterion,
        condition: buildRequisitionCriterionCondition(criterion),
      }))
      .filter((entry): entry is { criterion: SavedSearchCriterion; condition: NonNullable<ReturnType<typeof buildRequisitionCriterionCondition>> } => Boolean(entry.condition))

    if (validRows.length === 0) return null

    const infix: Array<'(' | ')' | 'and' | 'or' | Record<string, unknown>> = []
    validRows.forEach(({ criterion, condition }, index) => {
      if (index > 0) infix.push(criterion.joiner)
      for (let count = 0; count < criterion.openParens; count += 1) infix.push('(')
      infix.push(condition)
      for (let count = 0; count < criterion.closeParens; count += 1) infix.push(')')
    })

    const output: Array<'and' | 'or' | Record<string, unknown>> = []
    const operators: Array<'(' | 'and' | 'or'> = []
    const precedence = { or: 1, and: 2 }

    for (const token of infix) {
      if (token === '(') {
        operators.push(token)
        continue
      }
      if (token === ')') {
        while (operators.length > 0 && operators[operators.length - 1] !== '(') {
          output.push(operators.pop() as 'and' | 'or')
        }
        if (operators[operators.length - 1] === '(') operators.pop()
        continue
      }
      if (token === 'and' || token === 'or') {
        while (
          operators.length > 0 &&
          operators[operators.length - 1] !== '(' &&
          precedence[operators[operators.length - 1] as 'and' | 'or'] >= precedence[token]
        ) {
          output.push(operators.pop() as 'and' | 'or')
        }
        operators.push(token)
        continue
      }
      output.push(token)
    }

    while (operators.length > 0) {
      const operator = operators.pop()
      if (operator && operator !== '(') output.push(operator)
    }

    const stack: Record<string, unknown>[] = []
    for (const token of output) {
      if (token === 'and' || token === 'or') {
        const right = stack.pop()
        const left = stack.pop()
        if (!left || !right) continue
        stack.push(token === 'and' ? { AND: [left, right] } : { OR: [left, right] })
        continue
      }
      stack.push(token)
    }

    return stack[0] ?? null
  }

  const criteriaWhere = buildCriteriaWhere(savedDefinition.criteria)
  const keywordWhere = query
    ? {
        OR: [
          { number: { contains: query } },
          { title: { contains: query } },
          { description: { contains: query } },
          { vendor: { name: { contains: query } } },
          { vendor: { vendorNumber: { contains: query } } },
        ],
      }
    : null
  const statusWhere = statusFilter !== 'all' ? { status: statusFilter } : null
  const whereParts = [keywordWhere, statusWhere, criteriaWhere].filter(Boolean)
  const where: Prisma.RequisitionWhereInput = whereParts.length > 1 ? { AND: whereParts } : whereParts[0] ?? {}

  const total = await prisma.requisition.count({ where })
  const pagination = getPagination(total, params.page)

  const requisitions = await prisma.requisition.findMany({
    where,
    include: { vendor: true, department: true, subsidiary: true, currency: true },
    orderBy: [{ createdAt: 'desc' as const }],
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const buildPageHref = (page: number) => {
    const search = new URLSearchParams()
    if (query) search.set('q', query)
    if (statusFilter !== 'all') search.set('status', statusFilter)
    if (selectedViewId) search.set('view', selectedViewId)
    search.set('page', String(page))
    return `/purchase-requisitions?${search.toString()}`
  }

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages =
    cabinetFiles.find((file) => file.id === selectedLogoValue) ??
    cabinetFiles.find((file) => file.originalName === selectedLogoValue) ??
    cabinetFiles.find((file) => file.storedName === selectedLogoValue) ??
    cabinetFiles.find((file) => file.url === selectedLogoValue) ??
    (!selectedLogoValue ? cabinetFiles[0] : undefined)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? <img src={companyLogoPages.url} alt="Company logo" className="h-16 w-auto rounded" /> : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Purchase Requisitions</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {total} total
          </p>
        </div>
        <Link
          href="/purchase-requisitions/new"
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Purchase Requisition
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((status) => {
          const active = statusFilter === status
          const href = `/purchase-requisitions?${new URLSearchParams({
            ...(query ? { q: query } : {}),
            status,
            ...(selectedViewId ? { view: selectedViewId } : {}),
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
              {status === 'all'
                ? 'All'
                : status
                    .split(' ')
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ')}
            </Link>
          )
        })}
      </div>

      <section
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
      >
        <div className="flex items-center gap-3 border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
          <form method="GET" action="/purchase-requisitions" className="flex flex-1 items-center gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search business id, description, vendor, status"
              className="min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="status" value={statusFilter} />
            <input type="hidden" name="page" value="1" />
            {selectedViewId ? <input type="hidden" name="view" value={selectedViewId} /> : null}
            <ListSearchActions
              tableId="requisitions-list"
              exportFileName="purchase_requisitions"
              exportAllUrl={exportAllUrl}
              columns={COLS}
              filterDefinitions={[
                PURCHASE_REQUISITION_SAVED_SEARCH_FILTERS[0],
                {
                  ...PURCHASE_REQUISITION_SAVED_SEARCH_FILTERS[1],
                  options: statusOptions.map((status) => ({
                    value: status,
                    label: status === 'all'
                      ? 'All'
                      : status
                          .split(' ')
                          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                          .join(' '),
                  })),
                },
              ]}
              criteriaFields={purchaseRequisitionSavedSearchFields}
              resultFields={purchaseRequisitionSavedSearchFields}
            />
          </form>
        </div>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="requisitions-list">
          <table className="min-w-full" id="requisitions-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {COLS.map((column) => (
                  <th
                    key={column.id}
                    data-column={column.id}
                    className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}
                  >
                    <RecordListHeaderLabel label={column.label} tooltip={'tooltip' in column ? column.tooltip : undefined} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requisitions.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No purchase requisitions found
                  </td>
                </tr>
              ) : (
                requisitions.map((requisition, index) => (
                  <tr
                    key={requisition.id}
                    style={index < requisitions.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}
                  >
                    <td data-column="number" className="px-4 py-2 text-sm font-medium">
                      <Link
                        href={`/purchase-requisitions/${requisition.id}`}
                        className="hover:underline"
                        style={{ color: 'var(--accent-primary-strong)' }}
                      >
                        {requisition.number}
                      </Link>
                    </td>
                    <td data-column="title" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {requisition.title ?? '-'}
                    </td>
                    <td data-column="status" className="px-4 py-2 text-sm">
                      <StatusBadge status={requisition.status} />
                    </td>
                    <td data-column="priority" className="px-4 py-2 text-sm">
                      <PriorityBadge priority={requisition.priority} />
                    </td>
                    <td data-column="department" className="px-4 py-2 text-sm">
                      {requisition.department && requisition.departmentId ? (
                        <Link
                          href={`/departments/${requisition.departmentId}`}
                          className="hover:underline"
                          style={{ color: 'var(--accent-primary-strong)' }}
                        >
                          {`${requisition.department.departmentId} - ${requisition.department.name}`}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>-</span>
                      )}
                    </td>
                    <td data-column="vendor" className="px-4 py-2 text-sm">
                      {requisition.vendor ? (
                        <Link
                          href={`/vendors/${requisition.vendorId}`}
                          className="hover:underline"
                          style={{ color: 'var(--accent-primary-strong)' }}
                        >
                          {`${requisition.vendor.vendorNumber?.trim() || 'Vendor'} - ${requisition.vendor.name}`}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>-</span>
                      )}
                    </td>
                    <td data-column="total" className="px-4 py-2 text-sm font-medium text-white">
                      {fmtCurrency(
                        requisition.total,
                        requisition.currency?.code ?? requisition.currency?.currencyId ?? undefined,
                        moneySettings,
                      )}
                    </td>
                    <td data-column="needed-by" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {requisition.neededByDate ? fmtDocumentDate(requisition.neededByDate, moneySettings) : '-'}
                    </td>
                    <td data-column="db-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {requisition.id}
                    </td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(requisition.createdAt, moneySettings)}
                    </td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(requisition.updatedAt, moneySettings)}
                    </td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <ListRowActions
                        viewHref={`/purchase-requisitions/${requisition.id}`}
                        editButton={{
                          resource: 'purchase-requisitions',
                          id: requisition.id,
                          fields: [
                            { name: 'title', label: 'Title', value: requisition.title ?? '' },
                            {
                              name: 'status',
                              label: 'Status',
                              value: requisition.status,
                              type: 'select',
                              options: REQUISITION_STATUS_OPTIONS,
                            },
                            {
                              name: 'priority',
                              label: 'Priority',
                              value: requisition.priority,
                              type: 'select',
                              options: PRIORITY_OPTIONS,
                            },
                            {
                              name: 'neededByDate',
                              label: 'Needed By',
                              value: requisition.neededByDate
                                ? new Date(requisition.neededByDate).toISOString().split('T')[0]
                                : '',
                              type: 'date',
                            },
                          ],
                        }}
                        deleteButton={{ resource: 'purchase-requisitions', id: requisition.id }}
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
          total={total}
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

const REQUISITION_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    draft: { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' },
    'pending approval': { bg: 'rgba(245,158,11,0.18)', color: '#f59e0b' },
    approved: { bg: 'rgba(16,185,129,0.18)', color: '#10b981' },
    ordered: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    cancelled: { bg: 'rgba(239,68,68,0.18)', color: '#ef4444' },
  }
  const style = styles[status] ?? styles.draft
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    low: { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' },
    medium: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    high: { bg: 'rgba(245,158,11,0.18)', color: '#f59e0b' },
    urgent: { bg: 'rgba(239,68,68,0.18)', color: '#ef4444' },
  }
  const style = styles[priority] ?? styles.medium
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {priority}
    </span>
  )
}
