import { prisma } from '@/lib/prisma'
import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import DepartmentCreateForm from '@/components/DepartmentCreateForm'
import { loadDepartmentCustomization } from '@/lib/department-customization-store'
import { loadListValues } from '@/lib/load-list-values'
import { generateNextDepartmentId } from '@/lib/department-id'
import { CUSTOM_FIELD_TYPES, type CustomFieldDefinitionSummary } from '@/lib/custom-fields'
import { loadListOptionsForSource } from '@/lib/list-source'

export default async function NewDepartmentPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [employees, subsidiaries, customization, divisionOptions, planningCategoryOptions, inactiveOptions, customFields, nextDepartmentId, duplicateDepartment] = await Promise.all([
    prisma.employee.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, employeeId: true },
    }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    loadDepartmentCustomization(),
    loadListValues('DEPT-DIVISION'),
    loadListValues('DEPT-PLANNING-CATEGORY'),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    prisma.customFieldDefinition.findMany({
      where: { entityType: 'department', active: true },
      orderBy: [{ label: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, label: true, type: true, required: true, defaultValue: true, options: true, entityType: true },
    }),
    generateNextDepartmentId(),
    duplicateFrom
      ? prisma.department.findUnique({
          where: { id: duplicateFrom },
          include: { departmentSubsidiaries: { select: { subsidiaryId: true } } },
        })
      : Promise.resolve(null),
  ])

  const normalizedCustomFields: CustomFieldDefinitionSummary[] = customFields.flatMap((field) => (
    CUSTOM_FIELD_TYPES.includes(field.type as (typeof CUSTOM_FIELD_TYPES)[number])
      ? [{ ...field, type: field.type as CustomFieldDefinitionSummary['type'] }]
      : []
  ))

  return (
    <MasterDataCreatePageShell backHref="/departments" backLabel="<- Back to Departments" title="New Department" formId="create-department-form">
      <DepartmentCreateForm
        formId="create-department-form"
        showFooterActions={false}
        redirectBasePath="/departments"
        nextDepartmentId={nextDepartmentId}
        employees={employees}
        subsidiaries={subsidiaries}
        customization={customization}
        divisionOptions={divisionOptions}
        planningCategoryOptions={planningCategoryOptions}
        inactiveOptions={inactiveOptions}
        customFields={normalizedCustomFields}
        initialValues={duplicateDepartment ? {
          departmentNumber: duplicateDepartment.departmentNumber,
          name: `Copy of ${duplicateDepartment.name}`,
          description: duplicateDepartment.description,
          division: duplicateDepartment.division,
          subsidiaryIds: duplicateDepartment.departmentSubsidiaries.map((assignment) => assignment.subsidiaryId),
          includeChildren: duplicateDepartment.includeChildren,
          planningCategory: duplicateDepartment.planningCategory,
          managerEmployeeId: duplicateDepartment.managerEmployeeId,
          approverEmployeeId: duplicateDepartment.approverEmployeeId,
          inactive: !duplicateDepartment.active,
        } : undefined}
      />
    </MasterDataCreatePageShell>
  )
}
