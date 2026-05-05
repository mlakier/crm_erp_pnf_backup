import Image from 'next/image'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fmtDocumentDate } from '@/lib/format'
import ListRowActions from '@/components/ListRowActions'
import ListSearchActions from '@/components/ListSearchActions'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadListValues } from '@/lib/load-list-values'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { buildReceiptDisplayNumberMap } from '@/lib/receipt-display-number'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { createRecordLabelMapFromValues, formatRecordLabel } from '@/lib/record-status-label'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sanitizeSavedSearchDefinitionState, type SavedSearchCriterion } from '@/lib/saved-search-metadata'
import { loadEffectiveSavedSearchDefinition } from '@/lib/load-effective-saved-search-definition'
import {
  RECEIPT_SAVED_SEARCH_FILTERS,
  buildReceiptListColumns,
  buildReceiptSavedSearchFields,
} from '@/lib/receipts-saved-search-metadata'

const RECEIPT_COLUMNS = buildReceiptListColumns()

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; view?: string }>
}) {
  const params = await searchParams
  const session = await getServerSession(authOptions)
  const selectedViewId = (params.view ?? '').trim()
  const defaultViewUserId = session?.user?.id ?? null
  const savedDefinition = sanitizeSavedSearchDefinitionState(
    await loadEffectiveSavedSearchDefinition({
      tableId: 'receipts-list',
      userId: defaultViewUserId,
      selectedViewId,
    }),
  )
  const { moneySettings } = await loadCompanyDisplaySettings()
  const statusFilter = params.status ?? savedDefinition.filterValues.status ?? 'all'
  const query = (params.q ?? savedDefinition.filterValues.keyword ?? '').trim()

  const [statusValues, allReceiptIds, purchaseOrders] = await Promise.all([
    loadListValues('RECEIPT-STATUS'),
    prisma.receipt.findMany({
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.purchaseOrder.findMany({
      orderBy: [{ number: 'asc' }],
      select: { id: true, number: true },
    }),
  ])
  const statusOptions = ['all', ...statusValues.map((value) => value.toLowerCase())]
  const statusLabelMap = createRecordLabelMapFromValues(statusValues)
  const receiptSavedSearchFields = buildReceiptSavedSearchFields({
    statusOptions: statusValues.map((value) => ({ value: value.toLowerCase(), label: value })),
    purchaseOrders,
  })
  const receiptNumberMap = buildReceiptDisplayNumberMap(allReceiptIds)
  const receiptNumberIdsById = new Map(allReceiptIds.map((receipt) => [receipt.id, receiptNumberMap.get(receipt.id) ?? receipt.id]))

  const getMatchingReceiptIds = (operator: string, value: string) => {
    const trimmed = value.trim().toLowerCase()
    if (!trimmed) return []
    return allReceiptIds
      .filter((receipt) => {
        const businessId = (receiptNumberIdsById.get(receipt.id) ?? '').toLowerCase()
        switch (operator) {
          case 'startsWith':
            return businessId.startsWith(trimmed)
          case 'is':
            return businessId === trimmed
          case 'isNot':
            return businessId !== trimmed
          case 'contains':
          default:
            return businessId.includes(trimmed)
        }
      })
      .map((receipt) => receipt.id)
  }

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

  const buildReceiptCriterionCondition = (criterion: SavedSearchCriterion) => {
    const value = criterion.value.trim()
    const stringFilter = buildStringFilter(criterion.operator, value)

    switch (criterion.fieldId) {
      case 'receipt-number': {
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        const matchingIds = getMatchingReceiptIds(criterion.operator, value)
        if (criterion.operator === 'isNot') {
          return matchingIds.length > 0 ? { NOT: { id: { in: matchingIds } } } : null
        }
        return matchingIds.length > 0 ? { id: { in: matchingIds } } : { id: '__no-match__' }
      }
      case 'purchase-order':
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        if (!value) return null
        return criterion.operator === 'isNot' ? { NOT: { purchaseOrderId: value } } : { purchaseOrderId: value }
      case 'quantity': {
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        if (!value) return null
        const quantity = Number(value)
        if (!Number.isFinite(quantity)) return null
        return criterion.operator === 'isNot' ? { NOT: { quantity } } : { quantity }
      }
      case 'date': {
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        if (!value) return null
        const parsed = new Date(value)
        if (Number.isNaN(parsed.getTime())) return null
        const start = new Date(parsed)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(end.getDate() + 1)
        return criterion.operator === 'isNot'
          ? { NOT: { date: { gte: start, lt: end } } }
          : { date: { gte: start, lt: end } }
      }
      case 'status':
        if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
        if (!value) return null
        return criterion.operator === 'isNot' ? { NOT: { status: value } } : { status: value }
      case 'notes':
        return stringFilter === '' ? { OR: [{ notes: null }, { notes: '' }] } : stringFilter ? { notes: stringFilter } : null
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
        condition: buildReceiptCriterionCondition(criterion),
      }))
      .filter((entry): entry is { criterion: SavedSearchCriterion; condition: NonNullable<ReturnType<typeof buildReceiptCriterionCondition>> } => Boolean(entry.condition))

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
  const keywordReceiptIds = query ? getMatchingReceiptIds('contains', query) : []
  const exportAllUrl = buildMasterDataExportUrl('receipts', query, undefined, {
    status: statusFilter !== 'all' ? statusFilter : undefined,
    view: selectedViewId || undefined,
  })
  const keywordWhere = query
    ? {
        OR: [
          ...(keywordReceiptIds.length > 0 ? [{ id: { in: keywordReceiptIds } }] : []),
          { status: { contains: query } },
          { notes: { contains: query } },
          { purchaseOrder: { number: { contains: query } } },
          { id: { contains: query } },
        ],
      }
    : null
  const statusWhere = statusFilter !== 'all' ? { status: statusFilter } : null
  const whereParts = [keywordWhere, statusWhere, criteriaWhere].filter(Boolean)
  const where: Prisma.ReceiptWhereInput = whereParts.length > 1 ? { AND: whereParts } : whereParts[0] ?? {}

  const totalReceipts = await prisma.receipt.count({ where })
  const pagination = getPagination(totalReceipts, params.page)

  const receipts = await prisma.receipt.findMany({
    where,
    include: { purchaseOrder: true },
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
    return `/receipts?${search.toString()}`
  }

  const settings = await loadCompanyInformationSettings()
  const logoFileId = settings.companyLogoPagesFileId
  const cabinetFiles = await loadCompanyCabinetFiles()
  const companyLogoPages = logoFileId ? cabinetFiles.find((file) => file.id === logoFileId) : null

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? (
          <Image src={companyLogoPages.url} alt="Company logo" width={160} height={64} className="h-16 w-auto rounded" unoptimized />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Receipts</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {totalReceipts} total
          </p>
        </div>
        <Link
          href="/receipts/new"
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Receipt
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((status) => {
          const active = statusFilter === status
          const href = `/receipts?${new URLSearchParams({
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
              placeholder="Search business id, purchase order, status, description"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <ListSearchActions
              tableId="receipts-list"
              exportFileName="receipts"
              exportAllUrl={exportAllUrl}
              columns={RECEIPT_COLUMNS}
              filterDefinitions={[
                RECEIPT_SAVED_SEARCH_FILTERS[0],
                {
                  ...RECEIPT_SAVED_SEARCH_FILTERS[1],
                  options: statusOptions.map((status) => ({
                    value: status,
                    label: status === 'all' ? 'All' : formatRecordLabel(status, statusLabelMap),
                  })),
                },
              ]}
              criteriaFields={receiptSavedSearchFields}
              resultFields={receiptSavedSearchFields}
            />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="receipts-list">
          <table className="min-w-full" id="receipts-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {RECEIPT_COLUMNS.map((column) => (
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
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No receipts found.
                  </td>
                </tr>
              ) : (
                receipts.map((receipt, index) => (
                  <tr
                    key={receipt.id}
                    style={index < receipts.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}
                  >
                    <td data-column="receipt-number" className="px-4 py-2 text-sm">
                      <Link
                        href={`/receipts/${receipt.id}`}
                        className="font-medium hover:underline"
                        style={{ color: 'var(--accent-primary-strong)' }}
                      >
                        {receiptNumberMap.get(receipt.id) ?? receipt.id}
                      </Link>
                    </td>
                    <td data-column="purchase-order" className="px-4 py-2 text-sm">
                      <Link
                        href={`/purchase-orders/${receipt.purchaseOrderId}`}
                        className="font-medium hover:underline"
                        style={{ color: 'var(--accent-primary-strong)' }}
                      >
                        {receipt.purchaseOrder.number}
                      </Link>
                    </td>
                    <td data-column="quantity" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {receipt.quantity}
                    </td>
                    <td data-column="date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(receipt.date, moneySettings)}
                    </td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatRecordLabel(receipt.status, statusLabelMap)}
                    </td>
                    <td data-column="notes" className="max-w-[200px] truncate px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {receipt.notes ?? '-'}
                    </td>
                    <td data-column="db-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {receipt.id}
                    </td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(receipt.createdAt, moneySettings)}
                    </td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(receipt.updatedAt, moneySettings)}
                    </td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <ListRowActions
                        viewHref={`/receipts/${receipt.id}`}
                        editButton={{
                          resource: 'receipts',
                          id: receipt.id,
                          fields: [
                            { name: 'quantity', label: 'Quantity', value: String(receipt.quantity), type: 'number' },
                            { name: 'date', label: 'Date', value: new Date(receipt.date).toISOString().split('T')[0], type: 'date' },
                            {
                              name: 'status',
                              label: 'Status',
                              value: receipt.status,
                              type: 'select',
                              options: statusValues.map((value) => ({ value: value.toLowerCase(), label: value })),
                            },
                            { name: 'notes', label: 'Notes', value: receipt.notes ?? '' },
                          ],
                        }}
                        deleteButton={{ resource: 'receipts', id: receipt.id }}
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
          total={totalReceipts}
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
