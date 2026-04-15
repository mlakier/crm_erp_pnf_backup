import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import DepartmentCreateForm from '@/components/DepartmentCreateForm'
import DepartmentCustomizeForm from '@/components/DepartmentCustomizeForm'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { loadDepartmentCustomization } from '@/lib/department-customization-store'
import { loadCustomListState } from '@/lib/custom-list-store'
import {
  CUSTOM_FIELD_TYPES,
  CustomFieldDefinitionSummary,
} from '@/lib/custom-fields'

const COLS = [
  { id: 'department-id', label: 'Department Id' },
  { id: 'name', label: 'Name' },
  { id: 'description', label: 'Description' },
  { id: 'division', label: 'Division' },
  { id: 'subsidiary', label: 'Subsidiary' },
  { id: 'manager', label: 'Manager' },
  { id: 'status', label: 'Inactive' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

const COLUMN_LABELS: Record<string, string> = {
  'department-id': 'Department Id',
  name: 'Name',
  description: 'Description',
  division: 'Division',
  subsidiary: 'Subsidiary',
  manager: 'Manager',
  status: 'Inactive',
  created: 'Created',
  'last-modified': 'Last Modified',
  actions: 'Actions',
}

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()

  const where = query
    ? { OR: [{ departmentId: { contains: query } }, { name: { contains: query } }, { description: { contains: query } }, { division: { contains: query } }] }
    : {}

  const total = await prisma.department.count({ where })
  const pagination = getPagination(total, params.page)

  const [departments, managers, subsidiaries, companySettings, cabinetFiles, customization, customListState, customFields] = await Promise.all([
    prisma.department.findMany({ where, include: { entity: true }, orderBy: [{ departmentId: 'asc' }, { name: 'asc' }], skip: pagination.skip, take: pagination.pageSize }),
    prisma.employee.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, employeeId: true },
    }),
    prisma.entity.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadDepartmentCustomization(),
    loadCustomListState(),
    prisma.customFieldDefinition.findMany({
      where: { entityType: 'department', active: true },
      orderBy: [{ label: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, label: true, type: true, required: true, defaultValue: true, options: true, entityType: true },
    }),
  ])

  const configuredColumnOrder = Array.isArray(customization.columnOrder) ? customization.columnOrder : []
  const fixedFirst = ['department-id', 'name']
  const defaultOrder = ['description', 'division', 'subsidiary', 'manager', 'status', 'created', 'last-modified']
  const orderedMiddle = [
    ...configuredColumnOrder.filter((id) => !fixedFirst.includes(id) && id !== 'actions' && defaultOrder.includes(id)),
    ...defaultOrder.filter((id) => !configuredColumnOrder.includes(id)),
  ]

  const orderedColumns = [
    'department-id',
    'name',
    ...orderedMiddle.filter((id) => {
      if (id === 'description') return customization.tableVisibility.description
      if (id === 'division') return customization.tableVisibility.division
      if (id === 'subsidiary') return customization.tableVisibility.subsidiary
      if (id === 'manager') return customization.tableVisibility.manager
      if (id === 'status') return customization.tableVisibility.status
      return true
    }),
    'actions',
  ]

  const divisionCustomListId = customization.listBindings.divisionCustomListId
  const divisionRows = divisionCustomListId ? customListState.customRows[divisionCustomListId] ?? [] : []
  const divisionOptions = divisionRows.map((row) => row.value)
  const customListOptions = customListState.customLists.map((list) => ({ id: list.id, label: list.label }))
  const normalizedCustomFields: CustomFieldDefinitionSummary[] = customFields.flatMap((field) => (
    CUSTOM_FIELD_TYPES.includes(field.type as (typeof CUSTOM_FIELD_TYPES)[number])
      ? [{
          ...field,
          type: field.type as CustomFieldDefinitionSummary['type'],
        }]
      : []
  ))

  const managerById = new Map(
    managers.map((manager) => [manager.id, `${manager.firstName} ${manager.lastName}${manager.employeeId ? ` (${manager.employeeId})` : ''}`])
  )

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    s.set('page', String(p))
    return `/departments?${s.toString()}`
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
          <h1 className="text-xl font-semibold text-white">Departments</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <CreateModalButton buttonLabel="Customize" title="Customize Departments" buttonClassName="!text-sm" buttonStyle={{ backgroundColor: 'transparent', border: '1px solid var(--border-muted)' }} modalWidthClassName="max-w-6xl">
            <DepartmentCustomizeForm initialConfig={customization} customLists={customListOptions} customListRows={customListState.customRows} customFields={normalizedCustomFields} />
          </CreateModalButton>
          <CreateModalButton buttonLabel="New Department" title="New Department">
            <DepartmentCreateForm managers={managers} subsidiaries={subsidiaries} customization={customization} divisionOptions={divisionOptions} customFields={normalizedCustomFields} />
          </CreateModalButton>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search Department Id, name, description, or division"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="page" value="1" />
            <ExportButton tableId="departments-list" fileName="departments" />
            <ColumnSelector tableId="departments-list" columns={COLS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="departments-list">
          <table className="min-w-full" id="departments-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                {orderedColumns.map((columnId) => (
                  <th key={columnId} data-column={columnId} className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>
                    {COLUMN_LABELS[columnId] ?? columnId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={orderedColumns.length} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No departments found
                  </td>
                </tr>
              ) : (
                departments.map((department, index) => (
                  <tr key={department.id} style={index < departments.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    {orderedColumns.map((columnId) => {
                      if (columnId === 'department-id') {
                        return (
                          <td key={`${department.id}-${columnId}`} data-column="department-id" className="px-4 py-2 text-sm font-medium text-white">
                            <Link href={`/departments/${department.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{department.departmentId}</Link>
                          </td>
                        )
                      }

                      if (columnId === 'name') {
                        return <td key={`${department.id}-${columnId}`} data-column="name" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{department.name}</td>
                      }

                      if (columnId === 'description') {
                        return <td key={`${department.id}-${columnId}`} data-column="description" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{department.description ?? '—'}</td>
                      }

                      if (columnId === 'division') {
                        return <td key={`${department.id}-${columnId}`} data-column="division" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{department.division ?? '—'}</td>
                      }

                      if (columnId === 'subsidiary') {
                        return <td key={`${department.id}-${columnId}`} data-column="subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{department.entity ? `${department.entity.subsidiaryId} - ${department.entity.name}` : '—'}</td>
                      }

                      if (columnId === 'manager') {
                        return <td key={`${department.id}-${columnId}`} data-column="manager" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{managerById.get(department.managerId ?? '') ?? '—'}</td>
                      }

                      if (columnId === 'status') {
                        return <td key={`${department.id}-${columnId}`} data-column="status" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{department.active ? 'No' : 'Yes'}</td>
                      }

                      if (columnId === 'created') {
                        return <td key={`${department.id}-${columnId}`} data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(department.createdAt).toLocaleDateString()}</td>
                      }

                      if (columnId === 'last-modified') {
                        return <td key={`${department.id}-${columnId}`} data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(department.updatedAt).toLocaleDateString()}</td>
                      }

                      const editFields = [
                        { name: 'departmentId', label: 'Department Id', value: department.departmentId },
                        { name: 'name', label: 'Name', value: department.name },
                        ...(customization.fields.description.visible
                          ? [{ name: 'description', label: 'Description', value: department.description ?? '' }]
                          : []),
                        ...(customization.fields.division.visible
                          ? [{ name: 'division', label: 'Division', value: department.division ?? '' }]
                          : []),
                        ...(customization.fields.entityId.visible
                          ? [
                              {
                                name: 'entityId',
                                label: 'Subsidiary',
                                value: department.entityId ?? '',
                                type: 'select' as const,
                                placeholder: 'Select subsidiary',
                                options: subsidiaries.map((subsidiary) => ({
                                  value: subsidiary.id,
                                  label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
                                })),
                              },
                            ]
                          : []),
                        ...(customization.fields.managerId.visible
                          ? [
                              {
                                name: 'managerId',
                                label: 'Manager',
                                value: department.managerId ?? '',
                                type: 'select' as const,
                                placeholder: 'Select manager',
                                options: managers.map((manager) => ({
                                  value: manager.id,
                                  label: `${manager.firstName} ${manager.lastName}${manager.employeeId ? ` (${manager.employeeId})` : ''}`,
                                })),
                              },
                            ]
                          : []),
                        {
                          name: 'inactive',
                          label: 'Inactive',
                          value: String(!department.active),
                          type: 'select' as const,
                          options: [
                            { value: 'false', label: 'No' },
                            { value: 'true', label: 'Yes' },
                          ],
                        },
                      ]

                      return (
                        <td key={`${department.id}-${columnId}`} data-column="actions" className="px-4 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <EditButton resource="departments" id={department.id} fields={editFields} />
                            <DeleteButton resource="departments" id={department.id} />
                          </div>
                        </td>
                      )
                    })}
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
