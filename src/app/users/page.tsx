import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import PaginationFooter from '@/components/PaginationFooter'
import CreatePageLinkButton from '@/components/CreatePageLinkButton'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import MasterDataListSection from '@/components/MasterDataListSection'
import { MasterDataBodyCell, MasterDataEmptyStateRow, MasterDataHeaderCell, MasterDataMutedCell } from '@/components/MasterDataTableCells'
import { getPagination } from '@/lib/pagination'
import { MASTER_DATA_TABLE_DIVIDER_STYLE, getMasterDataRowStyle } from '@/lib/master-data-table'
import { formatMasterDataDate } from '@/lib/master-data-display'
import { loadCompanyPageLogo } from '@/lib/company-page-logo'
import { loadUserFormCustomization } from '@/lib/user-form-customization-store'
import { userListDefinition } from '@/lib/master-data-list-definitions'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { USER_FORM_FIELDS } from '@/lib/user-form-customization'
import { buildFieldMetaById, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'
import { sanitizeSavedSearchDefinitionState, type SavedSearchCriterion } from '@/lib/saved-search-metadata'
import { buildUserSavedSearchFields, USER_SAVED_SEARCH_FILTERS } from '@/lib/users-saved-search-metadata'
import { loadEffectiveSavedSearchDefinition } from '@/lib/load-effective-saved-search-definition'
const USER_JOINED_COLUMN_IDS = new Set([
  'role.name',
  'department.name',
  'department.departmentId',
  'defaultSubsidiary.subsidiaryId',
  'approvalCurrency.code',
  'delegatedApprover.name',
  'delegatedApprover.email',
  'linkedEmployee.employeeId',
  'linkedEmployee.lastName',
])

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
  if (operator === 'isEmpty') return null
  if (operator === 'isNotEmpty') return null
  if (value !== 'true' && value !== 'false') return null
  const parsed = value === 'true'
  if (operator === 'isNot') return { not: parsed }
  return parsed
}

function buildUserCriterionCondition(criterion: SavedSearchCriterion) {
  const value = criterion.value.trim()
  const stringFilter = buildStringFilter(criterion.operator, value)

  switch (criterion.fieldId) {
    case 'id':
      return stringFilter === '' ? { OR: [{ userId: null }, { userId: '' }] } : stringFilter ? { userId: stringFilter } : null
    case 'name':
      return stringFilter === '' ? { OR: [{ name: null }, { name: '' }] } : stringFilter ? { name: stringFilter } : null
    case 'email':
      return stringFilter === '' ? { OR: [{ email: '' }] } : stringFilter ? { email: stringFilter } : null
    case 'role':
      if (criterion.operator === 'isEmpty') return { roleId: null }
      if (criterion.operator === 'isNotEmpty') return { NOT: { roleId: null } }
      if (!value) return null
      return criterion.operator === 'isNot' ? { NOT: { roleId: value } } : { roleId: value }
    case 'department':
      if (criterion.operator === 'isEmpty') return { departmentId: null }
      if (criterion.operator === 'isNotEmpty') return { NOT: { departmentId: null } }
      if (!value) return null
      return criterion.operator === 'isNot' ? { NOT: { departmentId: value } } : { departmentId: value }
    case 'default-subsidiary':
      if (criterion.operator === 'isEmpty') return { defaultSubsidiaryId: null }
      if (criterion.operator === 'isNotEmpty') return { NOT: { defaultSubsidiaryId: null } }
      if (!value) return null
      return criterion.operator === 'isNot' ? { NOT: { defaultSubsidiaryId: value } } : { defaultSubsidiaryId: value }
    case 'subsidiaries':
      if (!value) return null
      if (criterion.operator === 'isNot') return { subsidiaryAssignments: { none: { subsidiaryId: value } } }
      if (criterion.operator === 'isEmpty') return { subsidiaryAssignments: { none: {} } }
      if (criterion.operator === 'isNotEmpty') return { subsidiaryAssignments: { some: {} } }
      return { subsidiaryAssignments: { some: { subsidiaryId: value } } }
    case 'include-children': {
      const boolFilter = buildBooleanFilter(criterion.operator, value)
      return boolFilter === null ? null : { includeChildren: boolFilter }
    }
    case 'approval-limit':
      if (criterion.operator === 'isEmpty') return { approvalLimit: null }
      if (criterion.operator === 'isNotEmpty') return { NOT: { approvalLimit: null } }
      if (!value) return null
      return criterion.operator === 'isNot' ? { NOT: { approvalLimit: value } } : { approvalLimit: value }
    case 'delegated-approver':
      if (criterion.operator === 'isEmpty') return { delegatedApproverUserId: null }
      if (criterion.operator === 'isNotEmpty') return { NOT: { delegatedApproverUserId: null } }
      if (!value) return null
      return criterion.operator === 'isNot' ? { NOT: { delegatedApproverUserId: value } } : { delegatedApproverUserId: value }
    case 'locked': {
      const boolFilter = buildBooleanFilter(criterion.operator, value)
      return boolFilter === null ? null : { locked: boolFilter }
    }
    case 'employee':
      if (!value) return null
      if (criterion.operator === 'isNot') return { employee: { isNot: { id: value } } }
      if (criterion.operator === 'isEmpty') return { employee: { is: null } }
      if (criterion.operator === 'isNotEmpty') return { employee: { isNot: null } }
      return { employee: { is: { id: value } } }
    case 'inactive': {
      const boolFilter = buildBooleanFilter(criterion.operator, value)
      return boolFilter === null ? null : { inactive: boolFilter }
    }
    case 'role.name':
      return stringFilter ? { role: { is: { name: stringFilter } } } : criterion.operator === 'isEmpty' ? { role: { is: null } } : null
    case 'department.name':
      return stringFilter ? { department: { is: { name: stringFilter } } } : criterion.operator === 'isEmpty' ? { department: { is: null } } : null
    case 'department.departmentId':
      return stringFilter ? { department: { is: { departmentId: stringFilter } } } : criterion.operator === 'isEmpty' ? { department: { is: null } } : null
    case 'defaultSubsidiary.subsidiaryId':
      return stringFilter ? { defaultSubsidiary: { is: { subsidiaryId: stringFilter } } } : criterion.operator === 'isEmpty' ? { defaultSubsidiary: { is: null } } : null
    case 'approvalCurrency.code':
      return stringFilter ? { approvalCurrency: { is: { code: stringFilter } } } : criterion.operator === 'isEmpty' ? { approvalCurrency: { is: null } } : null
    case 'delegatedApprover.name':
      return stringFilter ? { delegatedApprover: { is: { name: stringFilter } } } : criterion.operator === 'isEmpty' ? { delegatedApprover: { is: null } } : null
    case 'delegatedApprover.email':
      return stringFilter ? { delegatedApprover: { is: { email: stringFilter } } } : criterion.operator === 'isEmpty' ? { delegatedApprover: { is: null } } : null
    case 'linkedEmployee.employeeId':
      return stringFilter ? { employee: { is: { employeeId: stringFilter } } } : criterion.operator === 'isEmpty' ? { employee: { is: null } } : null
    case 'linkedEmployee.lastName':
      return stringFilter ? { employee: { is: { lastName: stringFilter } } } : criterion.operator === 'isEmpty' ? { employee: { is: null } } : null
    default:
      return null
  }
}

function buildCriteriaWhere(criteria: SavedSearchCriterion[]) {
  const validRows = criteria
    .map((criterion) => ({
      criterion,
      condition: buildUserCriterionCondition(criterion),
    }))
    .filter((entry): entry is { criterion: SavedSearchCriterion; condition: NonNullable<ReturnType<typeof buildUserCriterionCondition>> } => Boolean(entry.condition))

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

function formatUserCriterionSummary(
  criterion: SavedSearchCriterion,
  fields: ReturnType<typeof buildUserSavedSearchFields>,
) {
  const field = fields.find((entry) => entry.id === criterion.fieldId)
  if (!field) return null

  const operatorLabel =
    criterion.operator === 'startsWith'
      ? 'starts with'
      : criterion.operator === 'is'
        ? 'is'
        : criterion.operator === 'isNot'
          ? 'is not'
          : criterion.operator === 'isEmpty'
            ? 'is empty'
            : criterion.operator === 'isNotEmpty'
              ? 'is not empty'
              : 'contains'

  const optionLabel = field.options?.find((option) => option.value === criterion.value)?.label
  const valueLabel =
    criterion.operator === 'isEmpty' || criterion.operator === 'isNotEmpty'
      ? ''
      : optionLabel ?? criterion.value.trim()

  const parts: string[] = []
  if (criterion.openParens > 0) parts.push('('.repeat(criterion.openParens))
  parts.push(field.label)
  parts.push(operatorLabel)
  if (valueLabel) parts.push(valueLabel)
  if (criterion.closeParens > 0) parts.push(')'.repeat(criterion.closeParens))
  return parts.join(' ')
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string; view?: string }>
}) {
  const params = await searchParams
  const session = await getServerSession(authOptions)
  const selectedViewId = (params.view ?? '').trim()
  const defaultViewUserId = session?.user?.id ?? null
  const userFieldMetaById = buildFieldMetaById(USER_FORM_FIELDS)
  const savedDefinition = sanitizeSavedSearchDefinitionState(
    await loadEffectiveSavedSearchDefinition({
      tableId: userListDefinition.tableId,
      userId: defaultViewUserId,
      selectedViewId,
    }),
  )
  const query = (params.q ?? savedDefinition.filterValues.keyword ?? '').trim()
  const sort = params.sort ?? savedDefinition.filterValues.sort ?? DEFAULT_RECORD_LIST_SORT
  const criteriaWhere = buildCriteriaWhere(savedDefinition.criteria)
  const keywordWhere = query
    ? {
        OR: [
          { userId: { contains: query, mode: 'insensitive' as const } },
          { name: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
          { role: { name: { contains: query, mode: 'insensitive' as const } } },
          { defaultSubsidiary: { is: { subsidiaryId: { contains: query, mode: 'insensitive' as const } } } },
          { subsidiaryAssignments: { some: { subsidiary: { subsidiaryId: { contains: query, mode: 'insensitive' as const } } } } },
        ],
      }
    : null

  const where = [keywordWhere, criteriaWhere].filter(Boolean)
  const combinedWhere = where.length > 1 ? { AND: where } : where[0] ?? {}

  const total = await prisma.user.count({ where: combinedWhere })
  const pagination = getPagination(total, params.page)

  const [users, companyLogoPages, roles, departments, employees, subsidiaries, currencies, approverUsers, fieldOptions, formCustomization] = await Promise.all([
    prisma.user.findMany({
      where: combinedWhere,
      include: {
        department: { select: { departmentId: true, departmentNumber: true, name: true } },
        role: { select: { name: true } },
        defaultSubsidiary: { select: { subsidiaryId: true, name: true } },
        approvalCurrency: { select: { code: true } },
        delegatedApprover: { select: { userId: true, name: true, email: true } },
        subsidiaryAssignments: {
          include: { subsidiary: { select: { subsidiaryId: true, name: true } } },
          orderBy: { subsidiary: { subsidiaryId: 'asc' } },
        },
      },
      orderBy:
        sort === 'id'
          ? [{ userId: 'asc' as const }, { createdAt: 'desc' as const }]
          : sort === 'oldest'
          ? [{ createdAt: 'asc' as const }]
          : sort === 'name'
            ? [{ name: 'asc' as const }]
            : [{ createdAt: 'desc' as const }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    loadCompanyPageLogo(),
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
    prisma.department.findMany({ orderBy: [{ departmentId: 'asc' }, { name: 'asc' }] }),
    prisma.employee.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, employeeId: true, userId: true },
    }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.user.findMany({ orderBy: [{ userId: 'asc' }, { name: 'asc' }], select: { id: true, userId: true, name: true, email: true } }),
    loadFieldOptionsMap(userFieldMetaById as never, ['inactive']),
    loadUserFormCustomization(),
  ])

  const employeeByUserId = new Map(
    employees.filter((employee) => employee.userId).map((employee) => [employee.userId as string, employee])
  )
  const userSavedSearchFields = buildUserSavedSearchFields({
    roles,
    departments,
    subsidiaries,
    approverUsers,
    employees,
  })
  const activeCriteriaSummaries = savedDefinition.criteria
    .map((criterion, index) => {
      const summary = formatUserCriterionSummary(criterion, userSavedSearchFields)
      if (!summary) return null
      return {
        id: criterion.id,
        joiner: index > 0 ? criterion.joiner.toUpperCase() : null,
        summary,
      }
    })
    .filter((entry): entry is { id: string; joiner: string | null; summary: string } => Boolean(entry))

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (query) s.set('q', query)
    if (sort) s.set('sort', sort)
    if (selectedViewId) s.set('view', selectedViewId)
    s.set('page', String(p))
    return `/users?${s.toString()}`
  }

  const getHeaderTooltip = (columnId: string) => {
    switch (columnId) {
      case 'role.name':
        return 'Joined field: Role name'
      case 'department.name':
        return 'Joined field: Department name'
      case 'department.departmentId':
        return 'Joined field: Department ID'
      case 'defaultSubsidiary.subsidiaryId':
        return 'Joined field: Default subsidiary ID'
      case 'approvalCurrency.code':
        return 'Joined field: Approval currency code'
      case 'delegatedApprover.name':
        return 'Joined field: Delegated approver name'
      case 'delegatedApprover.email':
        return 'Joined field: Delegated approver email'
      case 'linkedEmployee.employeeId':
        return 'Joined field: Linked employee ID'
      case 'linkedEmployee.lastName':
        return 'Joined field: Linked employee last name'
      default:
        return undefined
    }
  }

  const getHeaderStyle = (columnId: string) =>
    USER_JOINED_COLUMN_IDS.has(columnId)
      ? {
          color: 'var(--accent-primary-strong)',
        }
      : undefined

  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Users"
        total={total}
        logoUrl={companyLogoPages?.url}
        actions={
          <CreatePageLinkButton href="/users/new" label="New User" />
        }
      />

      <MasterDataListSection
        query={query}
        topContent={
          activeCriteriaSummaries.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Active Criteria
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeCriteriaSummaries.map((criterion) => (
                  <div key={criterion.id} className="flex items-center gap-2">
                    {criterion.joiner ? (
                      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        {criterion.joiner}
                      </span>
                    ) : null}
                    <span
                      className="inline-flex items-center rounded-full border px-3 py-1 text-xs"
                      style={{
                        borderColor: 'rgba(59,130,246,0.35)',
                        backgroundColor: 'rgba(59,130,246,0.12)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {criterion.summary}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        }
        searchPlaceholder={userListDefinition.searchPlaceholder}
        tableId={userListDefinition.tableId}
        exportFileName={userListDefinition.exportFileName}
        exportAllUrl={buildMasterDataExportUrl('users', query, sort, selectedViewId ? { view: selectedViewId } : undefined)}
        columns={userListDefinition.columns}
        sort={sort}
        sortOptions={userListDefinition.sortOptions}
        listTitle="Users"
        basePath="/users"
        filterDefinitions={USER_SAVED_SEARCH_FILTERS}
        criteriaFields={userSavedSearchFields}
        resultFields={userSavedSearchFields}
      >
        <table className="min-w-full" id={userListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              {userListDefinition.columns.map((column) => (
                <MasterDataHeaderCell
                  key={column.id}
                  columnId={column.id}
                  style={getHeaderStyle(column.id)}
                  tooltip={getHeaderTooltip(column.id)}
                >
                  {column.label}
                </MasterDataHeaderCell>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={userListDefinition.columns.length}>No users found</MasterDataEmptyStateRow>
            ) : (
              users.map((user, index) => {
                const linkedEmployee = employeeByUserId.get(user.id)
                return (
                  <tr key={user.id} style={getMasterDataRowStyle(index, users.length)}>
                    {userListDefinition.columns.map((column) => {
                      switch (column.id) {
                        case 'id':
                          return (
                            <MasterDataBodyCell key={column.id} columnId={column.id}>
                              <Link href={`/users/${user.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                                {user.userId ?? 'Pending'}
                              </Link>
                            </MasterDataBodyCell>
                          )
                        case 'name':
                          return (
                            <MasterDataBodyCell key={column.id} columnId={column.id} className="px-4 py-2 text-sm font-medium text-white">
                              {user.name ?? '-'}
                            </MasterDataBodyCell>
                          )
                        case 'email':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.email || '-'}</MasterDataMutedCell>
                        case 'role':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.role?.name ?? '-'}</MasterDataMutedCell>
                        case 'department':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.department ? `${user.department.departmentNumber ?? user.department.departmentId} - ${user.department.name}` : '-'}</MasterDataMutedCell>
                        case 'default-subsidiary':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.defaultSubsidiary ? `${user.defaultSubsidiary.subsidiaryId} - ${user.defaultSubsidiary.name}` : '-'}</MasterDataMutedCell>
                        case 'subsidiaries':
                          return (
                            <MasterDataMutedCell key={column.id} columnId={column.id}>
                              {user.subsidiaryAssignments.length > 0
                                ? user.subsidiaryAssignments
                                    .map((assignment) => `${assignment.subsidiary.subsidiaryId} - ${assignment.subsidiary.name}`)
                                    .join(', ')
                                : '-'}
                            </MasterDataMutedCell>
                          )
                        case 'include-children':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.includeChildren ? 'Yes' : 'No'}</MasterDataMutedCell>
                        case 'approval-limit':
                          return (
                            <MasterDataMutedCell key={column.id} columnId={column.id}>
                              {user.approvalLimit === null || user.approvalLimit === undefined ? '-' : `${user.approvalLimit}${user.approvalCurrency ? ` ${user.approvalCurrency.code}` : ''}`}
                            </MasterDataMutedCell>
                          )
                        case 'delegated-approver':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.delegatedApprover ? (user.delegatedApprover.userId ?? user.delegatedApprover.name ?? user.delegatedApprover.email) : '-'}</MasterDataMutedCell>
                        case 'locked':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.locked ? 'Yes' : 'No'}</MasterDataMutedCell>
                        case 'employee':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{linkedEmployee ? `${linkedEmployee.firstName} ${linkedEmployee.lastName}${linkedEmployee.employeeId ? ` (${linkedEmployee.employeeId})` : ''}` : '-'}</MasterDataMutedCell>
                        case 'inactive':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.inactive ? 'Yes' : 'No'}</MasterDataMutedCell>
                        case 'role.name':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.role?.name ?? '-'}</MasterDataMutedCell>
                        case 'department.name':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.department?.name ?? '-'}</MasterDataMutedCell>
                        case 'department.departmentId':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.department?.departmentId ?? '-'}</MasterDataMutedCell>
                        case 'defaultSubsidiary.subsidiaryId':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.defaultSubsidiary?.subsidiaryId ?? '-'}</MasterDataMutedCell>
                        case 'approvalCurrency.code':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.approvalCurrency?.code ?? '-'}</MasterDataMutedCell>
                        case 'delegatedApprover.name':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.delegatedApprover?.name ?? '-'}</MasterDataMutedCell>
                        case 'delegatedApprover.email':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{user.delegatedApprover?.email ?? '-'}</MasterDataMutedCell>
                        case 'linkedEmployee.employeeId':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{linkedEmployee?.employeeId ?? '-'}</MasterDataMutedCell>
                        case 'linkedEmployee.lastName':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{linkedEmployee?.lastName ?? '-'}</MasterDataMutedCell>
                        case 'created':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{formatMasterDataDate(user.createdAt)}</MasterDataMutedCell>
                        case 'last-modified':
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>{formatMasterDataDate(user.updatedAt)}</MasterDataMutedCell>
                        case 'actions':
                          return (
                            <MasterDataBodyCell key={column.id} columnId={column.id}>
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/users/${user.id}`}
                                  className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                                  style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                                >
                                  Open
                                </Link>
                                <EditButton
                                  endpoint="/api/users"
                                  id={user.id}
                                  fields={[
                                    ...(formCustomization.fields.name.visible ? [{ name: 'name', label: 'Name', value: user.name ?? '' }] : []),
                                    ...(formCustomization.fields.email.visible ? [{ name: 'email', label: 'Email', value: user.email, type: 'email' as const }] : []),
                                    ...(formCustomization.fields.roleId.visible
                                      ? [{
                                          name: 'roleId',
                                          label: 'Role',
                                          value: user.roleId ?? '',
                                          type: 'select' as const,
                                          placeholder: 'Select role',
                                          options: roles.map((r) => ({ value: r.id, label: r.name })),
                                        }]
                                      : []),
                                    ...(formCustomization.fields.departmentId.visible
                                      ? [{
                                          name: 'departmentId',
                                          label: 'Department',
                                          value: user.departmentId ?? '',
                                          type: 'select' as const,
                                          placeholder: 'Select department',
                                          options: departments.map((d) => ({ value: d.id, label: `${d.departmentNumber ?? d.departmentId} - ${d.name}` })),
                                        }]
                                      : []),
                                    ...(formCustomization.fields.defaultSubsidiaryId.visible
                                      ? [{
                                          name: 'defaultSubsidiaryId',
                                          label: 'Default Subsidiary',
                                          value: user.defaultSubsidiaryId ?? '',
                                          type: 'select' as const,
                                          placeholder: 'Select subsidiary',
                                          options: subsidiaries.map((s) => ({ value: s.id, label: `${s.subsidiaryId} - ${s.name}` })),
                                        }]
                                      : []),
                                    ...(formCustomization.fields.subsidiaryIds.visible
                                      ? [{
                                          name: 'subsidiaryIds',
                                          label: 'Subsidiaries',
                                          value: user.subsidiaryAssignments.map((assignment) => assignment.subsidiaryId).join(','),
                                          type: 'select' as const,
                                          multiple: true,
                                          placeholder: 'Select subsidiaries',
                                          options: subsidiaries.map((s) => ({ value: s.id, label: `${s.subsidiaryId} - ${s.name}` })),
                                        }]
                                      : []),
                                    ...(formCustomization.fields.includeChildren.visible
                                      ? [{ name: 'includeChildren', label: 'Include Children', value: user.includeChildren ? 'true' : 'false', type: 'checkbox' as const, placeholder: 'Include Children' }]
                                      : []),
                                    ...(formCustomization.fields.approvalLimit.visible
                                      ? [{ name: 'approvalLimit', label: 'Approval Limit', value: user.approvalLimit === null || user.approvalLimit === undefined ? '' : String(user.approvalLimit), type: 'number' as const }]
                                      : []),
                                    ...(formCustomization.fields.approvalCurrencyId.visible
                                      ? [{
                                          name: 'approvalCurrencyId',
                                          label: 'Approval Currency',
                                          value: user.approvalCurrencyId ?? '',
                                          type: 'select' as const,
                                          placeholder: 'Select currency',
                                          options: currencies.map((currency) => ({ value: currency.id, label: `${currency.code} - ${currency.name}` })),
                                        }]
                                      : []),
                                    ...(formCustomization.fields.delegatedApproverUserId.visible
                                      ? [{
                                          name: 'delegatedApproverUserId',
                                          label: 'Delegated Approver',
                                          value: user.delegatedApproverUserId ?? '',
                                          type: 'select' as const,
                                          placeholder: 'Select user',
                                          options: approverUsers.filter((entry) => entry.id !== user.id).map((entry) => ({ value: entry.id, label: `${entry.userId ? `${entry.userId} - ` : ''}${entry.name ?? entry.email}` })),
                                        }]
                                      : []),
                                    ...(formCustomization.fields.delegationStartDate.visible
                                      ? [{ name: 'delegationStartDate', label: 'Delegation Start Date', value: user.delegationStartDate ? user.delegationStartDate.toISOString().slice(0, 10) : '', type: 'date' as const }]
                                      : []),
                                    ...(formCustomization.fields.delegationEndDate.visible
                                      ? [{ name: 'delegationEndDate', label: 'Delegation End Date', value: user.delegationEndDate ? user.delegationEndDate.toISOString().slice(0, 10) : '', type: 'date' as const }]
                                      : []),
                                    ...(formCustomization.fields.employeeId.visible
                                      ? [{
                                          name: 'employeeId',
                                          label: 'Linked Employee',
                                          value: linkedEmployee?.id ?? '',
                                          type: 'select' as const,
                                          placeholder: 'Select employee',
                                          options: employees
                                            .filter((employee) => !employee.userId || employee.userId === user.id)
                                            .map((employee) => ({
                                              value: employee.id,
                                              label: `${employee.firstName} ${employee.lastName}${employee.employeeId ? ` (${employee.employeeId})` : ''}`,
                                            })),
                                        }]
                                      : []),
                                    ...(formCustomization.fields.locked.visible
                                      ? [{ name: 'locked', label: 'Locked', value: user.locked ? 'true' : 'false', type: 'checkbox' as const, placeholder: 'Locked' }]
                                      : []),
                                    ...(formCustomization.fields.mustChangePassword.visible
                                      ? [{ name: 'mustChangePassword', label: 'Must Change Password', value: user.mustChangePassword ? 'true' : 'false', type: 'checkbox' as const, placeholder: 'Must Change Password' }]
                                      : []),
                                    ...(formCustomization.fields.failedLoginAttempts.visible
                                      ? [{ name: 'failedLoginAttempts', label: 'Failed Login Attempts', value: String(user.failedLoginAttempts), type: 'number' as const }]
                                      : []),
                                    ...(formCustomization.fields.lastLoginAt.visible
                                      ? [{ name: 'lastLoginAt', label: 'Last Login', value: user.lastLoginAt ? user.lastLoginAt.toISOString().slice(0, 10) : '', type: 'date' as const }]
                                      : []),
                                    ...(formCustomization.fields.passwordChangedAt.visible
                                      ? [{ name: 'passwordChangedAt', label: 'Password Changed', value: user.passwordChangedAt ? user.passwordChangedAt.toISOString().slice(0, 10) : '', type: 'date' as const }]
                                      : []),
                                    ...(formCustomization.fields.inactive.visible
                                      ? [{ name: 'inactive', label: 'Inactive', value: user.inactive ? 'true' : 'false', type: 'select' as const, options: fieldOptions.inactive ?? [] }]
                                      : []),
                                  ]}
                                />
                                <DeleteButton resource="users" id={user.id} />
                              </div>
                            </MasterDataBodyCell>
                          )
                        default:
                          return <MasterDataMutedCell key={column.id} columnId={column.id}>-</MasterDataMutedCell>
                      }
                    })}
                  </tr>
                )
              })
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
