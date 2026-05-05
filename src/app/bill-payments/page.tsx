import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import ListSearchActions from '@/components/ListSearchActions'
import PaginationFooter from '@/components/PaginationFooter'
import ListRowActions from '@/components/ListRowActions'
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
  BILL_PAYMENT_SAVED_SEARCH_FILTERS,
  buildBillPaymentListColumns,
  buildBillPaymentSavedSearchFields,
} from '@/lib/bill-payments-saved-search-metadata'

const BP_COLUMNS = buildBillPaymentListColumns()

export default async function BillPaymentsPage({
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
      tableId: 'bill-payments-list',
      userId: defaultViewUserId,
      selectedViewId,
    }),
  )
  const { moneySettings } = await loadCompanyDisplaySettings()
  const query = (params.q ?? savedDefinition.filterValues.keyword ?? '').trim()
  const statusFilter = params.status ?? savedDefinition.filterValues.status ?? 'all'

  const [companySettings, cabinetFiles, statusValues, vendors] = await Promise.all([
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('BILL-PAYMENT-STATUS'),
    prisma.vendor.findMany({ orderBy: { name: 'asc' }, where: { inactive: false } }),
  ])
  const statusOptions = ['all', ...statusValues.map((value) => value.toLowerCase())]
  const statusLabelMap = createRecordLabelMapFromValues(statusValues)
  const billPaymentSavedSearchFields = buildBillPaymentSavedSearchFields({
    vendors,
    statusOptions: statusValues.map((value) => ({ value: value.toLowerCase(), label: value })),
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

  const buildBillPaymentCriterionCondition = (criterion: SavedSearchCriterion) => {
    const value = criterion.value.trim()
    const stringFilter = buildStringFilter(criterion.operator, value)

    switch (criterion.fieldId) {
      case 'number':
        return stringFilter === '' ? { OR: [{ number: null }, { number: '' }] } : stringFilter ? { number: stringFilter } : null
      case 'bill':
        return stringFilter ? { bill: { is: { number: stringFilter } } } : criterion.operator === 'isEmpty' ? { bill: { is: null } } : null
      case 'vendor':
        if (criterion.operator === 'isEmpty') return { OR: [{ bill: { is: null } }, { bill: { is: { vendorId: null } } }] }
        if (criterion.operator === 'isNotEmpty') return { bill: { is: { vendorId: { not: null } } } }
        if (!value) return null
        return criterion.operator === 'isNot'
          ? { NOT: { bill: { is: { vendorId: value } } } }
          : { bill: { is: { vendorId: value } } }
      case 'amount': {
        if (criterion.operator === 'isEmpty') return { amount: null }
        if (criterion.operator === 'isNotEmpty') return { NOT: { amount: null } }
        if (!value) return null
        const amount = Number(value)
        if (!Number.isFinite(amount)) return null
        return criterion.operator === 'isNot' ? { NOT: { amount } } : { amount }
      }
      case 'date': {
        if (criterion.operator === 'isEmpty') return { date: null }
        if (criterion.operator === 'isNotEmpty') return { NOT: { date: null } }
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
      case 'method':
        return stringFilter === '' ? { OR: [{ method: null }, { method: '' }] } : stringFilter ? { method: stringFilter } : null
      case 'reference':
        return stringFilter === '' ? { OR: [{ reference: null }, { reference: '' }] } : stringFilter ? { reference: stringFilter } : null
      case 'status':
        if (criterion.operator === 'isEmpty') return { OR: [{ status: null }, { status: '' }] }
        if (criterion.operator === 'isNotEmpty') return { NOT: { OR: [{ status: null }, { status: '' }] } }
        if (!value) return null
        return criterion.operator === 'isNot' ? { NOT: { status: value } } : { status: value }
      case 'notes':
        return stringFilter === '' ? { OR: [{ notes: null }, { notes: '' }] } : stringFilter ? { notes: stringFilter } : null
      case 'db-id':
        return stringFilter === '' ? { OR: [{ id: null }, { id: '' }] } : stringFilter ? { id: stringFilter } : null
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
        condition: buildBillPaymentCriterionCondition(criterion),
      }))
      .filter((entry): entry is { criterion: SavedSearchCriterion; condition: NonNullable<ReturnType<typeof buildBillPaymentCriterionCondition>> } => Boolean(entry.condition))

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
          { reference: { contains: query } },
          { bill: { number: { contains: query } } },
          { bill: { vendor: { name: { contains: query } } } },
          { bill: { vendor: { vendorNumber: { contains: query } } } },
          { notes: { contains: query } },
        ],
      }
    : null
  const statusWhere = statusFilter !== 'all' ? { status: statusFilter } : null
  const whereParts = [keywordWhere, statusWhere, criteriaWhere].filter(Boolean)
  const where: Prisma.BillPaymentWhereInput = whereParts.length > 1 ? { AND: whereParts } : whereParts[0] ?? {}

  const [totalRows] = await Promise.all([
    prisma.billPayment.count({ where }),
  ])
  const exportAllUrl = buildMasterDataExportUrl('bill-payments', query, undefined, {
    status: statusFilter !== 'all' ? statusFilter : undefined,
    view: selectedViewId || undefined,
  })
  const editStatusOptions = statusValues.map((value) => ({ value: value.toLowerCase(), label: value }))

  const pagination = getPagination(totalRows, params.page)
  const rows = await prisma.billPayment.findMany({
    where,
    include: {
      bill: { include: { vendor: true, currency: true } },
    },
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
    return `/bill-payments?${search.toString()}`
  }

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages =
    cabinetFiles.find((file) => file.id === selectedLogoValue) ??
    cabinetFiles.find((file) => file.originalName === selectedLogoValue) ??
    cabinetFiles.find((file) => file.storedName === selectedLogoValue) ??
    (!selectedLogoValue ? cabinetFiles[0] : undefined)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? <img src={companyLogoPages.url} alt="Company logo" className="h-16 w-auto rounded" /> : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Bill Payments</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {totalRows} total
          </p>
        </div>
        <Link
          href="/bill-payments/new"
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
          style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
        >
          <span className="mr-1.5 text-lg leading-none">+</span>
          New Bill Payment
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {statusOptions.map((status) => {
          const active = statusFilter === status
          const href = `/bill-payments?${new URLSearchParams({
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
        <form
          className="border-b px-6 py-4"
          method="get"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="status" value={statusFilter} />
          {selectedViewId ? <input type="hidden" name="view" value={selectedViewId} /> : null}
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search business id, bill, vendor, status, reference"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <ListSearchActions
              tableId="bill-payments-list"
              exportFileName="bill-payments"
              exportAllUrl={exportAllUrl}
              columns={BP_COLUMNS}
              filterDefinitions={[
                BILL_PAYMENT_SAVED_SEARCH_FILTERS[0],
                {
                  ...BILL_PAYMENT_SAVED_SEARCH_FILTERS[1],
                  options: statusOptions.map((status) => ({
                    value: status,
                    label: status === 'all' ? 'All' : formatRecordLabel(status, statusLabelMap),
                  })),
                },
              ]}
              criteriaFields={billPaymentSavedSearchFields}
              resultFields={billPaymentSavedSearchFields}
            />
          </div>
        </form>

        <div className="record-list-scroll-region overflow-x-auto" data-column-selector-table="bill-payments-list">
          <table className="min-w-full" id="bill-payments-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {BP_COLUMNS.map((column) => (
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No bill payments yet.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} style={index < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="number" className="px-4 py-2 text-sm">
                      <Link href={`/bill-payments/${row.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {row.number}
                      </Link>
                    </td>
                    <td data-column="bill" className="px-4 py-2 text-sm">
                      {row.bill ? (
                        <Link href={`/bills/${row.billId}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {row.bill.number}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>-</span>
                      )}
                    </td>
                    <td data-column="vendor" className="px-4 py-2 text-sm">
                      {row.bill?.vendor ? (
                        <Link href={`/vendors/${row.bill.vendorId}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {`${row.bill.vendor.vendorNumber?.trim() || 'Vendor'} - ${row.bill.vendor.name}`}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>-</span>
                      )}
                    </td>
                    <td data-column="amount" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtCurrency(
                        row.amount,
                        row.bill?.currency?.code ?? row.bill?.currency?.currencyId ?? undefined,
                        moneySettings,
                      )}
                    </td>
                    <td data-column="date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(row.date, moneySettings)}
                    </td>
                    <td data-column="method" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.method ?? '-'}
                    </td>
                    <td data-column="reference" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.reference ?? '-'}
                    </td>
                    <td data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatRecordLabel(row.status, statusLabelMap)}
                    </td>
                    <td data-column="notes" className="max-w-[200px] truncate px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.notes ?? '-'}
                    </td>
                    <td data-column="db-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.id}
                    </td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(row.createdAt, moneySettings)}
                    </td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDocumentDate(row.updatedAt, moneySettings)}
                    </td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <ListRowActions
                        viewHref={`/bill-payments/${row.id}`}
                        editButton={{
                          id: row.id,
                          endpoint: '/api/bill-payments',
                          fields: [
                            { name: 'status', label: 'Status', type: 'select', value: row.status, options: editStatusOptions },
                            { name: 'amount', label: 'Amount', type: 'number', value: String(row.amount) },
                            { name: 'notes', label: 'Notes', type: 'text', value: row.notes ?? '' },
                          ],
                        }}
                        deleteButton={{ id: row.id, endpoint: '/api/bill-payments', label: row.number }}
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
          total={totalRows}
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
