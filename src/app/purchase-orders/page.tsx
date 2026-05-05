import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import ListRowActions from '@/components/ListRowActions'
import ListSearchActions from '@/components/ListSearchActions'
import PaginationFooter from '@/components/PaginationFooter'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { loadListValues } from '@/lib/load-list-values'
import { createRecordLabelMapFromValues, formatRecordLabel } from '@/lib/record-status-label'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sanitizeSavedSearchDefinitionState, type SavedSearchCriterion } from '@/lib/saved-search-metadata'
import { loadEffectiveSavedSearchDefinition } from '@/lib/load-effective-saved-search-definition'
import {
  PURCHASE_ORDER_SAVED_SEARCH_FILTERS,
  buildPurchaseOrderListColumns,
  buildPurchaseOrderSavedSearchFields,
} from '@/lib/purchase-orders-saved-search-metadata'

const PURCHASE_ORDER_COLUMNS = buildPurchaseOrderListColumns()

export default async function PurchaseOrdersPage({
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
      tableId: 'purchase-orders-list',
      userId: defaultViewUserId,
      selectedViewId,
    }),
  )
  const { moneySettings } = await loadCompanyDisplaySettings()
  const query = (params.q ?? savedDefinition.filterValues.keyword ?? '').trim()
  const statusFilter = params.status ?? savedDefinition.filterValues.status ?? 'all'

  const [companySettings, cabinetFiles, statusValues, vendors, subsidiaries, currencies, requisitions] = await Promise.all([
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('PO-STATUS'),
    prisma.vendor.findMany({
      where: { inactive: false },
      orderBy: [{ vendorNumber: 'asc' }, { name: 'asc' }],
      select: { id: true, vendorNumber: true, name: true },
    }),
    prisma.subsidiary.findMany({
      orderBy: [{ subsidiaryId: 'asc' }, { name: 'asc' }],
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.currency.findMany({
      where: { active: true },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true },
    }),
    prisma.requisition.findMany({
      orderBy: [{ number: 'asc' }],
      select: { id: true, number: true, title: true },
    }),
  ])

  const statusOptions = ['all', ...statusValues.map((value) => value.toLowerCase())]
  const statusLabelMap = createRecordLabelMapFromValues(statusValues)
  const purchaseOrderSavedSearchFields = buildPurchaseOrderSavedSearchFields({
    vendors,
    statusOptions: statusValues.map((value) => ({ value: value.toLowerCase(), label: value })),
    subsidiaries,
    currencies,
    requisitions,
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

  const buildPurchaseOrderCriterionCondition = (criterion: SavedSearchCriterion) => {
    const value = criterion.value.trim()
    const stringFilter = buildStringFilter(criterion.operator, value)

    switch (criterion.fieldId) {
      case 'number':
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        return stringFilter ? { number: stringFilter } : null
      case 'vendor':
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        if (!value) return null
        return criterion.operator === 'isNot' ? { NOT: { vendorId: value } } : { vendorId: value }
      case 'status':
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        if (!value) return null
        return criterion.operator === 'isNot' ? { NOT: { status: value } } : { status: value }
      case 'total': {
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        if (!value) return null
        const total = Number(value)
        if (!Number.isFinite(total)) return null
        return criterion.operator === 'isNot' ? { NOT: { total } } : { total }
      }
      case 'subsidiary':
        if (criterion.operator === 'isEmpty') return { subsidiaryId: null }
        if (criterion.operator === 'isNotEmpty') return { subsidiaryId: { not: null } }
        if (!value) return null
        return criterion.operator === 'isNot' ? { NOT: { subsidiaryId: value } } : { subsidiaryId: value }
      case 'currency':
        if (criterion.operator === 'isEmpty') return { currencyId: null }
        if (criterion.operator === 'isNotEmpty') return { currencyId: { not: null } }
        if (!value) return null
        return criterion.operator === 'isNot' ? { NOT: { currencyId: value } } : { currencyId: value }
      case 'requisition':
        if (criterion.operator === 'isEmpty') return { requisitionId: null }
        if (criterion.operator === 'isNotEmpty') return { requisitionId: { not: null } }
        if (!value) return null
        return criterion.operator === 'isNot' ? { NOT: { requisitionId: value } } : { requisitionId: value }
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
        condition: buildPurchaseOrderCriterionCondition(criterion),
      }))
      .filter((entry): entry is { criterion: SavedSearchCriterion; condition: NonNullable<ReturnType<typeof buildPurchaseOrderCriterionCondition>> } => Boolean(entry.condition))

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
          operators.length > 0
          && operators[operators.length - 1] !== '('
          && precedence[operators[operators.length - 1] as 'and' | 'or'] >= precedence[token]
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
          { status: { contains: query } },
          { vendor: { name: { contains: query } } },
          { vendor: { vendorNumber: { contains: query } } },
          { requisition: { number: { contains: query } } },
          { requisition: { title: { contains: query } } },
        ],
      }
    : null
  const statusWhere = statusFilter !== 'all' ? { status: statusFilter } : null
  const whereParts = [keywordWhere, statusWhere, criteriaWhere].filter(Boolean)
  const where: Prisma.PurchaseOrderWhereInput = whereParts.length > 1 ? { AND: whereParts } : whereParts[0] ?? {}

  const totalPurchaseOrders = await prisma.purchaseOrder.count({ where })

  const exportAllUrl = buildMasterDataExportUrl('purchase-orders', query, undefined, {
    status: statusFilter !== 'all' ? statusFilter : undefined,
    view: selectedViewId || undefined,
  })

  const pagination = getPagination(totalPurchaseOrders, params.page)

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where,
    include: { vendor: true, subsidiary: true, currency: true, requisition: true },
    orderBy: [{ createdAt: 'desc' as const }],
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (query) search.set('q', query)
    if (statusFilter !== 'all') search.set('status', statusFilter)
    if (selectedViewId) search.set('view', selectedViewId)
    search.set('page', String(nextPage))
    return `/purchase-orders?${search.toString()}`
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
          <h1 className="text-xl font-semibold text-white">Purchase Orders</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Track procurement orders, status, and supplier relationships.
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {totalPurchaseOrders} orders
          </p>
        </div>
        <Link
          href="/purchase-orders/new"
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Purchase Order
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((status) => {
          const active = statusFilter === status
          const href = `/purchase-orders?${new URLSearchParams({
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
              {status === 'all' ? 'All' : formatRecordLabel(status, statusLabelMap)}
            </Link>
          )
        })}
      </div>

      <section
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
      >
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="status" value={statusFilter} />
          {selectedViewId ? <input type="hidden" name="view" value={selectedViewId} /> : null}
          <div className="flex items-center gap-3 flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search business id, vendor, requisition, status"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <ListSearchActions
              tableId="purchase-orders-list"
              exportFileName="purchase-orders"
              exportAllUrl={exportAllUrl}
              columns={PURCHASE_ORDER_COLUMNS}
              filterDefinitions={[
                PURCHASE_ORDER_SAVED_SEARCH_FILTERS[0],
                {
                  ...PURCHASE_ORDER_SAVED_SEARCH_FILTERS[1],
                  options: statusOptions.map((status) => ({
                    value: status,
                    label: status === 'all' ? 'All' : formatRecordLabel(status, statusLabelMap),
                  })),
                },
              ]}
              criteriaFields={purchaseOrderSavedSearchFields}
              resultFields={purchaseOrderSavedSearchFields}
            />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="purchase-orders-list">
          <table className="min-w-full" id="purchase-orders-list">
            <thead>
              <tr>
                {PURCHASE_ORDER_COLUMNS.map((column) => (
                  <th
                    key={column.id}
                    data-column={column.id}
                    className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
                    style={{
                      color: 'var(--text-muted)',
                      borderBottom: '1px solid var(--border-muted)',
                      backgroundColor: 'var(--card)',
                    }}
                  >
                    <RecordListHeaderLabel label={column.label} tooltip={'tooltip' in column ? column.tooltip : undefined} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No purchase orders found
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((purchaseOrder, index) => (
                  <tr
                    key={purchaseOrder.id}
                    style={index < purchaseOrders.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}
                  >
                    <td data-column="number" className="px-4 py-2 text-sm">
                      <Link
                        href={`/purchase-orders/${purchaseOrder.id}`}
                        className="font-medium hover:underline"
                        style={{ color: 'var(--accent-primary-strong)' }}
                      >
                        {purchaseOrder.number}
                      </Link>
                    </td>
                    <td data-column="vendor" className="px-4 py-2 text-sm">
                      <Link
                        href={`/vendors/${purchaseOrder.vendorId}`}
                        className="hover:underline"
                        style={{ color: 'var(--accent-primary-strong)' }}
                      >
                        {`${purchaseOrder.vendor.vendorNumber?.trim() || 'Vendor'} - ${purchaseOrder.vendor.name}`}
                      </Link>
                    </td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatRecordLabel(purchaseOrder.status, statusLabelMap)}
                    </td>
                    <td data-column="total" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtCurrency(
                        purchaseOrder.total,
                        purchaseOrder.currency?.code ?? purchaseOrder.currency?.currencyId ?? undefined,
                        moneySettings,
                      )}
                    </td>
                    <td data-column="subsidiary" className="px-4 py-2 text-sm">
                      {purchaseOrder.subsidiary && purchaseOrder.subsidiaryId ? (
                        <Link
                          href={`/subsidiaries/${purchaseOrder.subsidiaryId}`}
                          className="hover:underline"
                          style={{ color: 'var(--accent-primary-strong)' }}
                        >
                          {`${purchaseOrder.subsidiary.subsidiaryId} - ${purchaseOrder.subsidiary.name}`}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>-</span>
                      )}
                    </td>
                    <td data-column="currency" className="px-4 py-2 text-sm">
                      {purchaseOrder.currency && purchaseOrder.currencyId ? (
                        <Link
                          href={`/currencies/${purchaseOrder.currencyId}`}
                          className="hover:underline"
                          style={{ color: 'var(--accent-primary-strong)' }}
                        >
                          {`${purchaseOrder.currency.code} - ${purchaseOrder.currency.name}`}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>-</span>
                      )}
                    </td>
                    <td data-column="requisition" className="px-4 py-2 text-sm">
                      {purchaseOrder.requisition && purchaseOrder.requisitionId ? (
                        <Link
                          href={`/purchase-requisitions/${purchaseOrder.requisitionId}`}
                          className="hover:underline"
                          style={{ color: 'var(--accent-primary-strong)' }}
                        >
                          {purchaseOrder.requisition.number}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>-</span>
                      )}
                    </td>
                    <td data-column="db-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {purchaseOrder.id}
                    </td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(purchaseOrder.createdAt, moneySettings)}
                    </td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(purchaseOrder.updatedAt, moneySettings)}
                    </td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <ListRowActions
                        viewHref={`/purchase-orders/${purchaseOrder.id}`}
                        editButton={{
                          resource: 'purchase-orders',
                          id: purchaseOrder.id,
                          fields: [
                            {
                              name: 'status',
                              label: 'Status',
                              value: purchaseOrder.status ?? '',
                              type: 'select',
                              options: statusValues.map((value) => ({ value: value.toLowerCase(), label: value })),
                            },
                            { name: 'total', label: 'Total', value: purchaseOrder.total?.toString() ?? '', type: 'number' },
                          ],
                        }}
                        deleteButton={{ resource: 'purchase-orders', id: purchaseOrder.id }}
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
          total={totalPurchaseOrders}
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
