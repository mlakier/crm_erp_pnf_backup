import Link from 'next/link'
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
import { USER_FORM_FIELDS } from '@/lib/user-form-customization'
import { buildFieldMetaById, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const userFieldMetaById = buildFieldMetaById(USER_FORM_FIELDS)

  const where = query
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
    : {}

  const total = await prisma.user.count({ where })
  const pagination = getPagination(total, params.page)

  const [users, companyLogoPages, roles, departments, employees, subsidiaries, currencies, approverUsers, fieldOptions, formCustomization] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        department: { select: { departmentId: true, name: true } },
        role: { select: { name: true } },
        defaultSubsidiary: { select: { subsidiaryId: true } },
        approvalCurrency: { select: { code: true } },
        delegatedApprover: { select: { userId: true, name: true, email: true } },
        subsidiaryAssignments: {
          include: { subsidiary: { select: { subsidiaryId: true } } },
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

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (sort) s.set('sort', sort)
    s.set('page', String(p))
    return `/users?${s.toString()}`
  }

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
        query={params.q}
        searchPlaceholder={userListDefinition.searchPlaceholder}
        tableId={userListDefinition.tableId}
        exportFileName={userListDefinition.exportFileName}
        columns={userListDefinition.columns}
        sort={sort}
        sortOptions={userListDefinition.sortOptions}
      >
        <table className="min-w-full" id={userListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              <MasterDataHeaderCell columnId="id">User ID</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="name">Name</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="email">Email</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="role">Role</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="department">Department</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="default-subsidiary">Default Subsidiary</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="subsidiaries">Subsidiaries</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="include-children">Include Children</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="approval-limit">Approval Limit</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="delegated-approver">Delegated Approver</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="locked">Locked</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="employee">Linked Employee</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="inactive">Inactive</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="created">Created</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="last-modified">Last Modified</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="actions">Actions</MasterDataHeaderCell>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={16}>No users found</MasterDataEmptyStateRow>
            ) : (
              users.map((user, index) => {
                const linkedEmployee = employeeByUserId.get(user.id)
                return (
                  <tr key={user.id} style={getMasterDataRowStyle(index, users.length)}>
                    <MasterDataBodyCell columnId="id">
                      <Link href={`/users/${user.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {user.userId ?? 'Pending'}
                      </Link>
                    </MasterDataBodyCell>
                    <MasterDataBodyCell columnId="name" className="px-4 py-2 text-sm font-medium text-white">{user.name ?? '-'}</MasterDataBodyCell>
                    <MasterDataMutedCell columnId="email">{user.email || '-'}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="role">{user.role?.name ?? '-'}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="department">{user.department ? `${user.department.departmentId} - ${user.department.name}` : '-'}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="default-subsidiary">{user.defaultSubsidiary?.subsidiaryId ?? '-'}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="subsidiaries">
                      {user.subsidiaryAssignments.length > 0 ? user.subsidiaryAssignments.map((assignment) => assignment.subsidiary.subsidiaryId).join(', ') : '-'}
                    </MasterDataMutedCell>
                    <MasterDataMutedCell columnId="include-children">{user.includeChildren ? 'Yes' : 'No'}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="approval-limit">
                      {user.approvalLimit === null || user.approvalLimit === undefined ? '-' : `${user.approvalLimit}${user.approvalCurrency ? ` ${user.approvalCurrency.code}` : ''}`}
                    </MasterDataMutedCell>
                    <MasterDataMutedCell columnId="delegated-approver">{user.delegatedApprover ? (user.delegatedApprover.userId ?? user.delegatedApprover.name ?? user.delegatedApprover.email) : '-'}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="locked">{user.locked ? 'Yes' : 'No'}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="employee">{linkedEmployee ? `${linkedEmployee.firstName} ${linkedEmployee.lastName}${linkedEmployee.employeeId ? ` (${linkedEmployee.employeeId})` : ''}` : '-'}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="inactive">{user.inactive ? 'Yes' : 'No'}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="created">{formatMasterDataDate(user.createdAt)}</MasterDataMutedCell>
                    <MasterDataMutedCell columnId="last-modified">{formatMasterDataDate(user.updatedAt)}</MasterDataMutedCell>
                    <MasterDataBodyCell columnId="actions">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="users"
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
                                  options: departments.map((d) => ({ value: d.id, label: `${d.departmentId} - ${d.name}` })),
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
