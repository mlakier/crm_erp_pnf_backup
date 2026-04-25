import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import MasterDataListSection from '@/components/MasterDataListSection'
import { MasterDataBodyCell, MasterDataEmptyStateRow, MasterDataHeaderCell, MasterDataMutedCell } from '@/components/MasterDataTableCells'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { MASTER_DATA_TABLE_DIVIDER_STYLE, getMasterDataRowStyle } from '@/lib/master-data-table'
import { formatMasterDataDate } from '@/lib/master-data-display'
import { loadCompanyPageLogo } from '@/lib/company-page-logo'
import { buildFieldMetaById, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { EMPLOYEE_FORM_FIELDS } from '@/lib/employee-form-customization'
import { loadEmployeeFormCustomization } from '@/lib/employee-form-customization-store'
import { employeeListDefinition } from '@/lib/master-data-list-definitions'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'

function formatSubsidiaryIds(assignments: Array<{ subsidiary: { subsidiaryId: string } }>) {
  return assignments.map((assignment) => assignment.subsidiary.subsidiaryId).join(', ') || '-'
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const queryTokens = query.split(/\s+/).filter(Boolean)

  const employeeSearchFields = (value: string) => [
    { employeeId: { contains: value, mode: 'insensitive' as const } },
    { eid: { contains: value, mode: 'insensitive' as const } },
    { firstName: { contains: value, mode: 'insensitive' as const } },
    { lastName: { contains: value, mode: 'insensitive' as const } },
    { email: { contains: value, mode: 'insensitive' as const } },
    { title: { contains: value, mode: 'insensitive' as const } },
    { laborType: { contains: value, mode: 'insensitive' as const } },
    { departmentRef: { is: { departmentId: { contains: value, mode: 'insensitive' as const } } } },
    { departmentRef: { is: { name: { contains: value, mode: 'insensitive' as const } } } },
  ]

  const where = query
    ? { AND: queryTokens.map((token) => ({ OR: employeeSearchFields(token) })) }
    : {}

  const total = await prisma.employee.count({ where })
  const pagination = getPagination(total, params.page)
  const fieldMetaById = buildFieldMetaById(EMPLOYEE_FORM_FIELDS)

  const [employees, departments, managers, users, linkedUsers, companyLogoPages, fieldOptions, formCustomization] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        subsidiary: true,
        employeeSubsidiaries: {
          include: { subsidiary: true },
          orderBy: { subsidiary: { subsidiaryId: 'asc' } },
        },
        departmentRef: true,
        user: { select: { id: true, userId: true, name: true, email: true } },
      },
      orderBy:
        sort === 'id'
          ? [{ employeeId: 'asc' as const }, { createdAt: 'desc' as const }]
          : sort === 'oldest'
          ? [{ createdAt: 'asc' as const }]
          : sort === 'name'
            ? [{ lastName: 'asc' as const }, { firstName: 'asc' as const }]
            : [{ createdAt: 'desc' as const }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.department.findMany({
      orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
      select: { id: true, departmentId: true, name: true },
    }),
    prisma.employee.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, employeeId: true },
    }),
    prisma.user.findMany({
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: { id: true, userId: true, name: true, email: true },
    }),
    prisma.employee.findMany({
      where: { userId: { not: null } },
      select: { userId: true },
    }),
    loadCompanyPageLogo(),
    loadFieldOptionsMap(fieldMetaById, ['laborType', 'inactive', 'subsidiaryIds']),
    loadEmployeeFormCustomization(),
  ])
  const inactiveOptions = fieldOptions.inactive ?? []
  const laborTypeOptions = fieldOptions.laborType ?? []
  const subsidiaryOptions = fieldOptions.subsidiaryIds ?? []

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (sort) s.set('sort', sort)
    s.set('page', String(p))
    return `/employees?${s.toString()}`
  }

  const linkedUserIdSet = new Set(linkedUsers.map((entry) => entry.userId).filter((value): value is string => Boolean(value)))
  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Employees"
        total={total}
        logoUrl={companyLogoPages?.url}
        actions={
          <Link
            href="/employees/new"
            className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
            style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
          >
            <span className="mr-1.5 text-lg leading-none">+</span>
            New Employee
          </Link>
        }
      />

      <MasterDataListSection
        query={params.q}
        searchPlaceholder={employeeListDefinition.searchPlaceholder}
        tableId={employeeListDefinition.tableId}
        exportFileName={employeeListDefinition.exportFileName}
        exportAllUrl={buildMasterDataExportUrl('employees', params.q, sort)}
        columns={employeeListDefinition.columns}
        sort={sort}
        sortOptions={employeeListDefinition.sortOptions}
      >
        <table className="min-w-full" id={employeeListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              <MasterDataHeaderCell columnId="employee-id">Employee Id</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="eid">EID</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="name">Name</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="email">Email</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="title">Title</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="labor-type">Labor Type</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="department">Department</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="subsidiaries">Subsidiaries</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="include-children">Include Children</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="linked-user">Linked User</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="inactive">Inactive</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="created">Created</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="last-modified">Last Modified</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="actions">Actions</MasterDataHeaderCell>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={14}>No employees found</MasterDataEmptyStateRow>
            ) : (
              employees.map((employee, index) => (
                <tr key={employee.id} style={getMasterDataRowStyle(index, employees.length)}>
                  <MasterDataBodyCell columnId="employee-id" className="px-4 py-2 text-sm font-medium">
                    <Link href={`/employees/${employee.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                      {employee.employeeId ?? 'Pending'}
                    </Link>
                  </MasterDataBodyCell>
                  <MasterDataMutedCell columnId="eid">{employee.eid ?? '-'}</MasterDataMutedCell>
                  <MasterDataBodyCell columnId="name" className="px-4 py-2 text-sm font-medium text-white">{employee.firstName} {employee.lastName}</MasterDataBodyCell>
                  <MasterDataMutedCell columnId="email">{employee.email ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="title">{employee.title ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="labor-type">{employee.laborType ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="department">{employee.departmentRef?.departmentId ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="subsidiaries">{formatSubsidiaryIds(employee.employeeSubsidiaries)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="include-children">{employee.includeChildren ? 'Yes' : 'No'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="linked-user">{employee.user ? `${employee.user.name ?? employee.user.email}${employee.user.userId ? ` (${employee.user.userId})` : ''}` : '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="inactive">{employee.active ? 'No' : 'Yes'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="created">{formatMasterDataDate(employee.createdAt)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="last-modified">{formatMasterDataDate(employee.updatedAt)}</MasterDataMutedCell>
                  <MasterDataBodyCell columnId="actions">
                    <div className="flex items-center gap-2">
                      <EditButton
                        resource="employees"
                        id={employee.id}
                        fields={[
                          ...(formCustomization.fields.employeeId.visible ? [{ name: 'employeeId', label: 'Employee ID', value: employee.employeeId ?? '' }] : []),
                          ...(formCustomization.fields.eid.visible ? [{ name: 'eid', label: 'EID', value: employee.eid ?? '' }] : []),
                          ...(formCustomization.fields.firstName.visible ? [{ name: 'firstName', label: 'First Name', value: employee.firstName }] : []),
                          ...(formCustomization.fields.lastName.visible ? [{ name: 'lastName', label: 'Last Name', value: employee.lastName }] : []),
                          ...(formCustomization.fields.email.visible ? [{ name: 'email', label: 'Email', value: employee.email ?? '', type: 'email' as const }] : []),
                          ...(formCustomization.fields.phone.visible ? [{ name: 'phone', label: 'Phone', value: employee.phone ?? '' }] : []),
                          ...(formCustomization.fields.title.visible ? [{ name: 'title', label: 'Title', value: employee.title ?? '' }] : []),
                          ...(formCustomization.fields.laborType.visible
                            ? [{
                                name: 'laborType',
                                label: 'Labor Type',
                                value: employee.laborType ?? '',
                                type: 'select' as const,
                                placeholder: 'Select labor type',
                                options: laborTypeOptions,
                              }]
                            : []),
                          ...(formCustomization.fields.departmentId.visible
                            ? [{
                                name: 'departmentId',
                                label: 'Department',
                                value: employee.departmentId ?? '',
                                type: 'select' as const,
                                placeholder: 'Select department',
                                options: departments.map((department) => ({ value: department.id, label: `${department.departmentId} - ${department.name}` })),
                              }]
                            : []),
                          ...(formCustomization.fields.subsidiaryIds.visible
                            ? [{
                                name: 'subsidiaryIds',
                                label: 'Subsidiaries',
                                value: employee.employeeSubsidiaries.map((assignment) => assignment.subsidiaryId).join(','),
                                type: 'select' as const,
                                multiple: true,
                                placeholder: 'Select subsidiaries',
                                options: subsidiaryOptions,
                              }]
                            : []),
                          ...(formCustomization.fields.includeChildren.visible
                            ? [{
                                name: 'includeChildren',
                                label: 'Include Children',
                                value: String(employee.includeChildren),
                                type: 'checkbox' as const,
                                placeholder: 'Include Children',
                              }]
                            : []),
                          ...(formCustomization.fields.managerId.visible
                            ? [{
                                name: 'managerId',
                                label: 'Manager',
                                value: employee.managerId ?? '',
                                type: 'select' as const,
                                placeholder: 'Select manager',
                                options: managers
                                  .filter((manager) => manager.id !== employee.id)
                                  .map((manager) => ({
                                    value: manager.id,
                                    label: `${manager.firstName} ${manager.lastName}${manager.employeeId ? ` (${manager.employeeId})` : ''}`,
                                  })),
                              }]
                            : []),
                          ...(formCustomization.fields.userId.visible
                            ? [{
                                name: 'userId',
                                label: 'Linked User',
                                value: employee.userId ?? '',
                                type: 'select' as const,
                                placeholder: 'Select user',
                                options: [
                                  ...(employee.user
                                    ? [{
                                        value: employee.user.id,
                                        label: `${employee.user.name ?? employee.user.email}${employee.user.userId ? ` (${employee.user.userId})` : ''}`,
                                      }]
                                    : []),
                                  ...users
                                    .filter((user) => user.id === employee.userId || !linkedUserIdSet.has(user.id))
                                    .filter((user) => user.id !== employee.userId)
                                    .map((user) => ({
                                      value: user.id,
                                      label: `${user.name ?? user.email}${user.userId ? ` (${user.userId})` : ''}`,
                                    })),
                                ],
                              }]
                            : []),
                          ...(formCustomization.fields.hireDate.visible
                            ? [{
                                name: 'hireDate',
                                label: 'Hire Date',
                                value: employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : '',
                                type: 'date' as const,
                              }]
                            : []),
                          ...(formCustomization.fields.terminationDate.visible
                            ? [{
                                name: 'terminationDate',
                                label: 'Termination Date',
                                value: employee.terminationDate ? new Date(employee.terminationDate).toISOString().split('T')[0] : '',
                                type: 'date' as const,
                              }]
                            : []),
                          ...(formCustomization.fields.inactive.visible
                            ? [{
                                name: 'inactive',
                                label: 'Inactive',
                                value: String(!employee.active),
                                type: 'select' as const,
                                options: inactiveOptions,
                              }]
                            : []),
                        ]}
                      />
                      <DeleteButton resource="employees" id={employee.id} />
                    </div>
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
