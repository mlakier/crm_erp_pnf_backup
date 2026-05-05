import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import MasterDataListSection from '@/components/MasterDataListSection'
import { MasterDataBodyCell, MasterDataEmptyStateRow, MasterDataHeaderCell, MasterDataMutedCell } from '@/components/MasterDataTableCells'
import ListRowActions from '@/components/ListRowActions'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { MASTER_DATA_TABLE_DIVIDER_STYLE, getMasterDataRowStyle } from '@/lib/master-data-table'
import { formatMasterDataDate } from '@/lib/master-data-display'
import { loadCompanyPageLogo } from '@/lib/company-page-logo'
import { chartOfAccountsListDefinition } from '@/lib/master-data-list-definitions'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { loadListOptionsForSource } from '@/lib/list-source'
import { CHART_OF_ACCOUNTS_FORM_FIELDS } from '@/lib/chart-of-accounts-form-customization'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sanitizeSavedSearchDefinitionState, type SavedSearchCriterion } from '@/lib/saved-search-metadata'
import { loadEffectiveSavedSearchDefinition } from '@/lib/load-effective-saved-search-definition'
import {
  buildChartOfAccountsSavedSearchFields,
  CHART_OF_ACCOUNTS_SAVED_SEARCH_FILTERS,
} from '@/lib/chart-of-accounts-saved-search-metadata'

function buildStringFilter(operator: string, value: string) {
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

function buildBooleanFilter(operator: string, value: string) {
  if (operator === 'isEmpty' || operator === 'isNotEmpty') return null
  if (value !== 'true' && value !== 'false') return null
  const parsed = value === 'true'
  return operator === 'isNot' ? { not: parsed } : parsed
}

function buildDateFilter(field: 'createdAt' | 'updatedAt', operator: string, value: string) {
  if (operator === 'isEmpty' || operator === 'isNotEmpty') return null
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  const start = new Date(parsed)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return operator === 'isNot'
    ? { NOT: { [field]: { gte: start, lt: end } } }
    : { [field]: { gte: start, lt: end } }
}

function buildChartOfAccountsCriterionCondition(criterion: SavedSearchCriterion) {
  const value = criterion.value.trim()
  const stringFilter = buildStringFilter(criterion.operator, value)

  switch (criterion.fieldId) {
    case 'account-id':
      return stringFilter ? { accountId: stringFilter } : null
    case 'account-number':
      return stringFilter ? { accountNumber: stringFilter } : null
    case 'name':
      return stringFilter ? { name: stringFilter } : null
    case 'description':
      return stringFilter === '' ? { OR: [{ description: null }, { description: '' }] } : stringFilter ? { description: stringFilter } : null
    case 'type':
      if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
      if (!value) return null
      return criterion.operator === 'isNot' ? { NOT: { accountType: value } } : { accountType: value }
    case 'normal-balance':
      if (criterion.operator === 'isEmpty') return { normalBalance: null }
      if (criterion.operator === 'isNotEmpty') return { NOT: { normalBalance: null } }
      if (!value) return null
      return criterion.operator === 'isNot' ? { NOT: { normalBalance: value } } : { normalBalance: value }
    case 'fs-section':
      return stringFilter === '' ? { OR: [{ financialStatementSection: null }, { financialStatementSection: '' }] } : stringFilter ? { financialStatementSection: stringFilter } : null
    case 'fs-group':
      return stringFilter === '' ? { OR: [{ financialStatementGroup: null }, { financialStatementGroup: '' }] } : stringFilter ? { financialStatementGroup: stringFilter } : null
    case 'fs-category':
      if (criterion.operator === 'isEmpty') return { financialStatementCategory: null }
      if (criterion.operator === 'isNotEmpty') return { NOT: { financialStatementCategory: null } }
      if (!value) return null
      return criterion.operator === 'isNot' ? { NOT: { financialStatementCategory: value } } : { financialStatementCategory: value }
    case 'account-role':
      if (criterion.operator === 'isEmpty') return { accountRole: null }
      if (criterion.operator === 'isNotEmpty') return { NOT: { accountRole: null } }
      if (!value) return null
      return criterion.operator === 'isNot' ? { NOT: { accountRole: value } } : { accountRole: value }
    case 'rollforward-category':
      if (criterion.operator === 'isEmpty') return { rollforwardCategory: null }
      if (criterion.operator === 'isNotEmpty') return { NOT: { rollforwardCategory: null } }
      if (!value) return null
      return criterion.operator === 'isNot' ? { NOT: { rollforwardCategory: value } } : { rollforwardCategory: value }
    case 'parent-account':
      if (criterion.operator === 'isEmpty') return { parentAccountId: null }
      if (criterion.operator === 'isNotEmpty') return { NOT: { parentAccountId: null } }
      if (!value) return null
      return criterion.operator === 'isNot' ? { NOT: { parentAccountId: value } } : { parentAccountId: value }
    case 'posting':
      return buildBooleanFilter(criterion.operator, value) === null ? null : { isPosting: buildBooleanFilter(criterion.operator, value) }
    case 'control':
      return buildBooleanFilter(criterion.operator, value) === null ? null : { isControlAccount: buildBooleanFilter(criterion.operator, value) }
    case 'inventory':
      return buildBooleanFilter(criterion.operator, value) === null ? null : { inventory: buildBooleanFilter(criterion.operator, value) }
    case 'revalue-open-balance':
      return buildBooleanFilter(criterion.operator, value) === null ? null : { revalueOpenBalance: buildBooleanFilter(criterion.operator, value) }
    case 'summary':
      return buildBooleanFilter(criterion.operator, value) === null ? null : { summary: buildBooleanFilter(criterion.operator, value) }
    case 'subsidiaries':
      if (!value) return null
      if (criterion.operator === 'isEmpty') {
        return { AND: [{ parentSubsidiaryId: null }, { subsidiaryAssignments: { none: {} } }] }
      }
      if (criterion.operator === 'isNotEmpty') {
        return { OR: [{ parentSubsidiaryId: { not: null } }, { subsidiaryAssignments: { some: {} } }] }
      }
      if (criterion.operator === 'isNot') {
        return {
          AND: [
            { parentSubsidiaryId: { not: value } },
            { subsidiaryAssignments: { none: { subsidiaryId: value } } },
          ],
        }
      }
      return {
        OR: [
          { parentSubsidiaryId: value },
          { subsidiaryAssignments: { some: { subsidiaryId: value } } },
        ],
      }
    case 'include-children':
      return buildBooleanFilter(criterion.operator, value) === null ? null : { includeChildren: buildBooleanFilter(criterion.operator, value) }
    case 'active':
      if (criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty') return null
      if (value !== 'true' && value !== 'false') return null
      return criterion.operator === 'isNot'
        ? { NOT: { active: value === 'true' } }
        : { active: value === 'true' }
    case 'db-id':
      return stringFilter ? { id: stringFilter } : null
    case 'created':
      return buildDateFilter('createdAt', criterion.operator, value)
    case 'last-modified':
      return buildDateFilter('updatedAt', criterion.operator, value)
    default:
      return null
  }
}

function buildCriteriaWhere(criteria: SavedSearchCriterion[]) {
  const validRows = criteria
    .map((criterion) => ({
      criterion,
      condition: buildChartOfAccountsCriterionCondition(criterion),
    }))
    .filter((entry): entry is { criterion: SavedSearchCriterion; condition: NonNullable<ReturnType<typeof buildChartOfAccountsCriterionCondition>> } => Boolean(entry.condition))

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

export default async function ChartOfAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string; view?: string }>
}) {
  const params = await searchParams
  const session = await getServerSession(authOptions)
  const selectedViewId = (params.view ?? '').trim()
  const defaultViewUserId = session?.user?.id ?? null
  const savedDefinition = sanitizeSavedSearchDefinitionState(
    await loadEffectiveSavedSearchDefinition({
      tableId: chartOfAccountsListDefinition.tableId,
      userId: defaultViewUserId,
      selectedViewId,
    }),
  )
  const query = (params.q ?? savedDefinition.filterValues.keyword ?? '').trim()
  const sort = params.sort ?? savedDefinition.filterValues.sort ?? DEFAULT_RECORD_LIST_SORT
  const fieldMetaById = Object.fromEntries(
    CHART_OF_ACCOUNTS_FORM_FIELDS.map((field) => [field.id, field])
  ) as Record<(typeof CHART_OF_ACCOUNTS_FORM_FIELDS)[number]['id'], (typeof CHART_OF_ACCOUNTS_FORM_FIELDS)[number]>

  const keywordWhere = query
    ? {
        OR: [
          { accountId: { contains: query, mode: 'insensitive' as const } },
          { accountNumber: { contains: query, mode: 'insensitive' as const } },
          { name: { contains: query, mode: 'insensitive' as const } },
          { accountType: { contains: query, mode: 'insensitive' as const } },
          { accountRole: { contains: query, mode: 'insensitive' as const } },
          { rollforwardCategory: { contains: query, mode: 'insensitive' as const } },
          { financialStatementCategory: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : null
  const criteriaWhere = buildCriteriaWhere(savedDefinition.criteria)
  const whereParts = [keywordWhere, criteriaWhere].filter(Boolean)
  const where = whereParts.length > 1 ? { AND: whereParts } : whereParts[0] ?? {}

  const total = await prisma.chartOfAccounts.count({ where })
  const pagination = getPagination(total, params.page)

  const [accounts, accountOptions, accountTypeOptions, normalBalanceOptions, financialStatementCategoryOptions, accountRoleOptions, rollforwardCategoryOptions, companyLogoPages, subsidiaries] = await Promise.all([
    prisma.chartOfAccounts.findMany({
      where,
      include: {
        parentAccount: { select: { id: true, accountId: true, accountNumber: true, name: true } },
        parentSubsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        subsidiaryAssignments: {
          include: { subsidiary: { select: { id: true, subsidiaryId: true, name: true } } },
          orderBy: { subsidiary: { subsidiaryId: 'asc' } },
        },
      },
      orderBy:
        sort === 'id'
          ? [{ accountId: 'asc' as const }, { accountNumber: 'asc' as const }, { createdAt: 'desc' as const }]
          : sort === 'oldest'
          ? [{ createdAt: 'asc' as const }]
          : sort === 'name'
            ? [{ name: 'asc' as const }]
            : [{ createdAt: 'desc' as const }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.chartOfAccounts.findMany({ orderBy: [{ accountId: 'asc' }, { accountNumber: 'asc' }], select: { id: true, accountId: true, accountNumber: true, name: true } }),
    loadListOptionsForSource(fieldMetaById.accountType),
    loadListOptionsForSource(fieldMetaById.normalBalance),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-COA-FS-CATEGORY' }),
    loadListOptionsForSource(fieldMetaById.accountRole),
    loadListOptionsForSource(fieldMetaById.rollforwardCategory),
    loadCompanyPageLogo(),
    prisma.subsidiary.findMany({ orderBy: [{ subsidiaryId: 'asc' }, { name: 'asc' }], select: { id: true, subsidiaryId: true, name: true } }),
  ])
  const chartOfAccountsSavedSearchFields = buildChartOfAccountsSavedSearchFields({
    accountTypeOptions,
    normalBalanceOptions,
    financialStatementCategoryOptions: financialStatementCategoryOptions,
    accountRoleOptions,
    rollforwardCategoryOptions,
    parentAccountOptions: accountOptions.map((option) => ({
      value: option.id,
      label: `${option.accountId} - ${option.accountNumber} - ${option.name}`,
    })),
    subsidiaryOptions: subsidiaries.map((subsidiary) => ({
      value: subsidiary.id,
      label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
    })),
  })

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (query) search.set('q', query)
    if (sort) search.set('sort', sort)
    if (selectedViewId) search.set('view', selectedViewId)
    search.set('page', String(nextPage))
    return `/chart-of-accounts?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Chart of Accounts"
        total={total}
        logoUrl={companyLogoPages?.url}
        actions={
          <Link
            href="/chart-of-accounts/new"
            className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
            style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
          >
            <span className="mr-1.5 text-lg leading-none">+</span>
            New Account
          </Link>
        }
      />

      <MasterDataListSection
        query={params.q}
        searchPlaceholder={chartOfAccountsListDefinition.searchPlaceholder}
        tableId={chartOfAccountsListDefinition.tableId}
        exportFileName={chartOfAccountsListDefinition.exportFileName}
        exportAllUrl={buildMasterDataExportUrl('chart-of-accounts', query, sort, selectedViewId ? { view: selectedViewId } : undefined)}
        columns={chartOfAccountsListDefinition.columns}
        sort={sort}
        sortOptions={chartOfAccountsListDefinition.sortOptions}
        listTitle="Chart of Accounts"
        basePath="/chart-of-accounts"
        filterDefinitions={CHART_OF_ACCOUNTS_SAVED_SEARCH_FILTERS}
        criteriaFields={chartOfAccountsSavedSearchFields}
        resultFields={chartOfAccountsSavedSearchFields}
      >
        <table className="min-w-full" id={chartOfAccountsListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              <MasterDataHeaderCell columnId="account-id">Account Id</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="account-number">Account Number</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="name">Name</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="description">Description</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="type">Account Type</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="normal-balance">Normal Balance</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="fs-section">FS Section</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="fs-group">FS Group</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="fs-category">FS Category</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="account-role">Account Role</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="rollforward-category">Rollforward Category</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="parent-account">Parent Account</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="posting">Posting</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="control">Control</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="inventory">Inventory</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="revalue-open-balance">Revalue Open Balance</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="summary">Summary</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="subsidiaries">Subsidiaries</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="include-children">Include Children</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="active">Active</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="db-id">DB Id</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="created">Created</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="last-modified">Last Modified</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="actions">Actions</MasterDataHeaderCell>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={24}>No chart accounts found</MasterDataEmptyStateRow>
            ) : (
              accounts.map((account, index) => (
                <tr key={account.id} style={getMasterDataRowStyle(index, accounts.length)}>
                  <MasterDataBodyCell columnId="account-id">
                    <Link href={`/chart-of-accounts/${account.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                      {account.accountId}
                    </Link>
                  </MasterDataBodyCell>
                  <MasterDataMutedCell columnId="account-number">{account.accountNumber}</MasterDataMutedCell>
                  <MasterDataBodyCell columnId="name" className="px-4 py-2 text-sm text-white">{account.name}</MasterDataBodyCell>
                  <MasterDataMutedCell columnId="description">{account.description ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="type">{account.accountType}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="normal-balance">{account.normalBalance ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="fs-section">{account.financialStatementSection ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="fs-group">{account.financialStatementGroup ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="fs-category">{account.financialStatementCategory ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="account-role">{account.accountRole ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="rollforward-category">{account.rollforwardCategory ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="parent-account">
                    {account.parentAccount
                      ? `${account.parentAccount.accountId} - ${account.parentAccount.name}`
                      : '-'}
                  </MasterDataMutedCell>
                  <MasterDataMutedCell columnId="posting">{account.isPosting ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="control">{account.isControlAccount ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="inventory">{account.inventory ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="revalue-open-balance">{account.revalueOpenBalance ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="summary">{account.summary ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="subsidiaries">
                    {account.parentSubsidiary
                      ? account.parentSubsidiary.subsidiaryId
                      : account.subsidiaryAssignments.length > 0
                        ? account.subsidiaryAssignments.map((entry) => entry.subsidiary.subsidiaryId).join(', ')
                        : '-'}
                  </MasterDataMutedCell>
                  <MasterDataMutedCell columnId="include-children">{account.includeChildren ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="active">{account.active ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="db-id">{account.id}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="created">{formatMasterDataDate(account.createdAt)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="last-modified">{formatMasterDataDate(account.updatedAt)}</MasterDataMutedCell>
                  <MasterDataBodyCell columnId="actions">
                    <ListRowActions
                      viewHref={`/chart-of-accounts/${account.id}`}
                      editButton={{
                        resource: 'chart-of-accounts',
                        id: account.id,
                        fields: [
                          { name: 'accountId', label: 'Account Id', value: account.accountId },
                          { name: 'accountNumber', label: 'Account Number', value: account.accountNumber },
                          { name: 'name', label: 'Name', value: account.name },
                          { name: 'description', label: 'Description', value: account.description ?? '' },
                          {
                            name: 'accountType',
                            label: 'Account Type',
                            value: account.accountType,
                            type: 'select',
                            options: accountTypeOptions,
                          },
                          { name: 'normalBalance', label: 'Normal Balance', value: account.normalBalance ?? '', type: 'select', options: normalBalanceOptions },
                          { name: 'financialStatementSection', label: 'FS Section', value: account.financialStatementSection ?? '' },
                          { name: 'financialStatementGroup', label: 'FS Group', value: account.financialStatementGroup ?? '' },
                          { name: 'financialStatementCategory', label: 'FS Category', value: account.financialStatementCategory ?? '', type: 'select', options: financialStatementCategoryOptions },
                          { name: 'accountRole', label: 'Account Role', value: account.accountRole ?? '', type: 'select', options: accountRoleOptions },
                          { name: 'rollforwardCategory', label: 'Rollforward Category', value: account.rollforwardCategory ?? '', type: 'select', options: rollforwardCategoryOptions },
                          { name: 'isPosting', label: 'Posting Account', value: String(account.isPosting), type: 'checkbox' },
                          { name: 'isControlAccount', label: 'Control Account', value: String(account.isControlAccount), type: 'checkbox' },
                          { name: 'allowsManualPosting', label: 'Allow Manual Posting', value: String(account.allowsManualPosting), type: 'checkbox' },
                          { name: 'requiresSubledgerType', label: 'Requires Subledger Type', value: account.requiresSubledgerType ?? '' },
                          { name: 'cashFlowCategory', label: 'Cash Flow Category', value: account.cashFlowCategory ?? '' },
                          { name: 'parentAccountId', label: 'Parent Account', value: account.parentAccountId ?? '', type: 'select', placeholder: 'Select parent account', options: accountOptions.filter((option) => option.id !== account.id).map((option) => ({ value: option.id, label: `${option.accountId} - ${option.accountNumber} - ${option.name}` })) },
                          { name: 'closeToAccountId', label: 'Close To Account', value: account.closeToAccountId ?? '', type: 'select', placeholder: 'Select close-to account', options: accountOptions.filter((option) => option.id !== account.id).map((option) => ({ value: option.id, label: `${option.accountId} - ${option.accountNumber} - ${option.name}` })) },
                          { name: 'inventory', label: 'Inventory', value: String(account.inventory), type: 'checkbox' },
                          { name: 'revalueOpenBalance', label: 'Revalue Open Balance', value: String(account.revalueOpenBalance), type: 'checkbox' },
                          { name: 'eliminateIntercoTransactions', label: 'Eliminate Interco Transactions', value: String(account.eliminateIntercoTransactions), type: 'checkbox' },
                          { name: 'summary', label: 'Summary', value: String(account.summary), type: 'checkbox' },
                        ],
                      }}
                      deleteButton={{ resource: 'chart-of-accounts', id: account.id }}
                    />
                  </MasterDataBodyCell>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
      </MasterDataListSection>
    </div>
  )
}
