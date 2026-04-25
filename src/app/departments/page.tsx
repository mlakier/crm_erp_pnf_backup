import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreatePageLinkButton from '@/components/CreatePageLinkButton'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import MasterDataListSection from '@/components/MasterDataListSection'
import { MasterDataBodyCell, MasterDataEmptyStateRow, MasterDataHeaderCell, MasterDataMutedCell } from '@/components/MasterDataTableCells'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { MASTER_DATA_TABLE_DIVIDER_STYLE, getMasterDataRowStyle } from '@/lib/master-data-table'
import { displayMasterDataValue, formatMasterDataDate } from '@/lib/master-data-display'
import { loadCompanyPageLogo } from '@/lib/company-page-logo'
import { loadDepartmentCustomization } from '@/lib/department-customization-store'
import { buildFieldMetaById, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { DEPARTMENT_FORM_FIELDS } from '@/lib/department-form-customization'
import { loadDepartmentFormCustomization } from '@/lib/department-form-customization-store'
import { loadListValues } from '@/lib/load-list-values'
import {
  departmentColumnLabels,
  departmentListDefinition,
} from '@/lib/master-data-list-definitions'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'

function joinSubsidiaryLabels(
  assignments: Array<{ subsidiary: { subsidiaryId: string } }>,
) {
  const labels = assignments.map(({ subsidiary }) => subsidiary.subsidiaryId)
  if (labels.length === 0) return '-'
  return labels.join(', ')
}

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT

  const where = query
    ? {
        OR: [
          { departmentId: { contains: query, mode: 'insensitive' as const } },
          { departmentNumber: { contains: query, mode: 'insensitive' as const } },
          { name: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } },
          { division: { contains: query, mode: 'insensitive' as const } },
          { planningCategory: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const total = await prisma.department.count({ where })
  const pagination = getPagination(total, params.page)
  const fieldMetaById = buildFieldMetaById(DEPARTMENT_FORM_FIELDS)
  const orderBy =
    sort === 'id'
      ? [{ departmentId: 'asc' as const }, { createdAt: 'desc' as const }]
      : sort === 'oldest'
        ? [{ createdAt: 'asc' as const }]
        : sort === 'name'
          ? [{ name: 'asc' as const }, { departmentId: 'asc' as const }]
          : [{ createdAt: 'desc' as const }]

  const [
    departments,
    employees,
    subsidiaries,
    companyLogoPages,
    customization,
    formCustomization,
    planningCategoryValues,
    fieldOptions,
  ] = await Promise.all([
    prisma.department.findMany({
      where,
      include: {
        departmentSubsidiaries: {
          include: { subsidiary: true },
          orderBy: { subsidiary: { subsidiaryId: 'asc' } },
        },
      },
      orderBy,
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.employee.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, employeeId: true },
    }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    loadCompanyPageLogo(),
    loadDepartmentCustomization(),
    loadDepartmentFormCustomization(),
    loadListValues('DEPT-PLANNING-CATEGORY'),
    loadFieldOptionsMap(fieldMetaById, ['inactive']),
  ])
  const inactiveOptions = fieldOptions.inactive ?? []

  const configuredColumnOrder = Array.isArray(customization.columnOrder) ? customization.columnOrder : []
  const fixedFirst = ['department-id', 'name']
  const defaultOrder = [
    'department-number',
    'description',
    'division',
    'subsidiaries',
    'include-children',
    'planning-category',
    'manager',
    'approver',
    'status',
    'created',
    'last-modified',
  ]
  const orderedMiddle = [
    ...configuredColumnOrder.filter((id) => !fixedFirst.includes(id) && id !== 'actions' && defaultOrder.includes(id)),
    ...defaultOrder.filter((id) => !configuredColumnOrder.includes(id)),
  ]

  const orderedColumns = [
    'department-id',
    'name',
    ...orderedMiddle.filter((id) => {
      if (id === 'department-number') return customization.tableVisibility.departmentNumber
      if (id === 'description') return customization.tableVisibility.description
      if (id === 'division') return customization.tableVisibility.division
      if (id === 'subsidiaries') return customization.tableVisibility.subsidiaries
      if (id === 'include-children') return customization.tableVisibility.includeChildren
      if (id === 'planning-category') return customization.tableVisibility.planningCategory
      if (id === 'manager') return customization.tableVisibility.manager
      if (id === 'approver') return customization.tableVisibility.approver
      if (id === 'status') return customization.tableVisibility.status
      return true
    }),
    'actions',
  ]

  const employeeLabelById = new Map(
    employees.map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}${employee.employeeId ? ` (${employee.employeeId})` : ''}`]),
  )

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (sort) s.set('sort', sort)
    s.set('page', String(p))
    return `/departments?${s.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Departments"
        total={total}
        logoUrl={companyLogoPages?.url}
        actions={
          <CreatePageLinkButton href="/departments/new" label="New Department" />
        }
      />

      <MasterDataListSection
        query={params.q}
        searchPlaceholder={departmentListDefinition.searchPlaceholder}
        tableId={departmentListDefinition.tableId}
        exportFileName={departmentListDefinition.exportFileName}
        exportAllUrl={buildMasterDataExportUrl('departments', params.q, sort)}
        columns={departmentListDefinition.columns}
        sort={sort}
        sortOptions={departmentListDefinition.sortOptions}
      >
        <table className="min-w-full" id={departmentListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              {orderedColumns.map((columnId) => (
                <MasterDataHeaderCell key={columnId} columnId={columnId}>
                  {departmentColumnLabels[columnId] ?? columnId}
                </MasterDataHeaderCell>
              ))}
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={orderedColumns.length}>No departments found</MasterDataEmptyStateRow>
            ) : (
              departments.map((department, index) => (
                <tr key={department.id} style={getMasterDataRowStyle(index, departments.length)}>
                  {orderedColumns.map((columnId) => {
                    if (columnId === 'department-id') {
                      return (
                        <MasterDataBodyCell key={`${department.id}-${columnId}`} columnId="department-id" className="px-4 py-2 text-sm font-medium text-white">
                          <Link href={`/departments/${department.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                            {department.departmentId}
                          </Link>
                        </MasterDataBodyCell>
                      )
                    }

                    if (columnId === 'department-number') {
                      return <MasterDataMutedCell key={`${department.id}-${columnId}`} columnId="department-number">{displayMasterDataValue(department.departmentNumber)}</MasterDataMutedCell>
                    }

                    if (columnId === 'name') {
                      return <MasterDataMutedCell key={`${department.id}-${columnId}`} columnId="name">{department.name}</MasterDataMutedCell>
                    }

                    if (columnId === 'description') {
                      return <MasterDataMutedCell key={`${department.id}-${columnId}`} columnId="description">{displayMasterDataValue(department.description)}</MasterDataMutedCell>
                    }

                    if (columnId === 'division') {
                      return <MasterDataMutedCell key={`${department.id}-${columnId}`} columnId="division">{displayMasterDataValue(department.division)}</MasterDataMutedCell>
                    }

                    if (columnId === 'subsidiaries') {
                      return <MasterDataMutedCell key={`${department.id}-${columnId}`} columnId="subsidiaries">{joinSubsidiaryLabels(department.departmentSubsidiaries)}</MasterDataMutedCell>
                    }

                    if (columnId === 'include-children') {
                      return <MasterDataMutedCell key={`${department.id}-${columnId}`} columnId="include-children">{department.includeChildren ? 'Yes' : 'No'}</MasterDataMutedCell>
                    }

                    if (columnId === 'planning-category') {
                      return <MasterDataMutedCell key={`${department.id}-${columnId}`} columnId="planning-category">{displayMasterDataValue(department.planningCategory)}</MasterDataMutedCell>
                    }

                    if (columnId === 'manager') {
                      return <MasterDataMutedCell key={`${department.id}-${columnId}`} columnId="manager">{displayMasterDataValue(employeeLabelById.get(department.managerEmployeeId ?? ''))}</MasterDataMutedCell>
                    }

                    if (columnId === 'approver') {
                      return <MasterDataMutedCell key={`${department.id}-${columnId}`} columnId="approver">{displayMasterDataValue(employeeLabelById.get(department.approverEmployeeId ?? ''))}</MasterDataMutedCell>
                    }

                    if (columnId === 'status') {
                      return <MasterDataMutedCell key={`${department.id}-${columnId}`} columnId="status">{department.active ? 'No' : 'Yes'}</MasterDataMutedCell>
                    }

                    if (columnId === 'created') {
                      return <MasterDataMutedCell key={`${department.id}-${columnId}`} columnId="created">{formatMasterDataDate(department.createdAt)}</MasterDataMutedCell>
                    }

                    if (columnId === 'last-modified') {
                      return <MasterDataMutedCell key={`${department.id}-${columnId}`} columnId="last-modified">{formatMasterDataDate(department.updatedAt)}</MasterDataMutedCell>
                    }

                    const editFields = [
                      { name: 'departmentId', label: 'Department Id', value: department.departmentId },
                      { name: 'departmentNumber', label: 'Department Number', value: department.departmentNumber ?? '' },
                      { name: 'name', label: 'Name', value: department.name },
                      ...(formCustomization.fields.description.visible ? [{ name: 'description', label: 'Description', value: department.description ?? '' }] : []),
                      ...(formCustomization.fields.division.visible ? [{ name: 'division', label: 'Division', value: department.division ?? '' }] : []),
                      ...(formCustomization.fields.subsidiaryIds.visible
                        ? [{
                            name: 'subsidiaryIds',
                            label: 'Subsidiaries',
                            value: department.departmentSubsidiaries.map(({ subsidiary }) => subsidiary.id).join(','),
                            type: 'select' as const,
                            multiple: true,
                            options: subsidiaries.map((subsidiary) => ({
                              value: subsidiary.id,
                              label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
                            })),
                          }]
                        : []),
                      ...(formCustomization.fields.includeChildren.visible
                        ? [{
                            name: 'includeChildren',
                            label: 'Include Children',
                            value: String(department.includeChildren),
                            type: 'select' as const,
                            options: [
                              { value: 'false', label: 'No' },
                              { value: 'true', label: 'Yes' },
                            ],
                          }]
                        : []),
                      ...(formCustomization.fields.planningCategory.visible
                        ? [{
                            name: 'planningCategory',
                            label: 'Department Planning Category',
                            value: department.planningCategory ?? '',
                            type: 'select' as const,
                            options: planningCategoryValues.map((option) => ({ value: option, label: option })),
                          }]
                        : []),
                      ...(formCustomization.fields.managerEmployeeId.visible
                        ? [{
                            name: 'managerEmployeeId',
                            label: 'Department Manager',
                            value: department.managerEmployeeId ?? '',
                            type: 'select' as const,
                            placeholder: 'Select manager',
                            options: employees.map((employee) => ({
                              value: employee.id,
                              label: employeeLabelById.get(employee.id) ?? employee.id,
                            })),
                          }]
                        : []),
                      ...(formCustomization.fields.approverEmployeeId.visible
                        ? [{
                            name: 'approverEmployeeId',
                            label: 'Department Approver',
                            value: department.approverEmployeeId ?? '',
                            type: 'select' as const,
                            placeholder: 'Select approver',
                            options: employees.map((employee) => ({
                              value: employee.id,
                              label: employeeLabelById.get(employee.id) ?? employee.id,
                            })),
                          }]
                        : []),
                      {
                        name: 'inactive',
                        label: 'Inactive',
                        value: String(!department.active),
                        type: 'select' as const,
                        options: inactiveOptions,
                      },
                    ]

                    return (
                      <MasterDataBodyCell key={`${department.id}-${columnId}`} columnId="actions">
                        <div className="flex items-center gap-2">
                          <EditButton resource="departments" id={department.id} fields={editFields} />
                          <DeleteButton resource="departments" id={department.id} />
                        </div>
                      </MasterDataBodyCell>
                    )
                  })}
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
