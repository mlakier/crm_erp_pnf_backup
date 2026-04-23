import { prisma } from '@/lib/prisma'
import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import EmployeeCreateForm from '@/components/EmployeeCreateForm'
import { loadListOptionsForSource } from '@/lib/list-source'

export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [entities, departments, managers, users, inactiveOptions, laborTypeOptions, duplicateEmployee] = await Promise.all([
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.department.findMany({ orderBy: [{ departmentId: 'asc' }, { name: 'asc' }], select: { id: true, departmentId: true, name: true } }),
    prisma.employee.findMany({
      where: { active: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, employeeId: true },
    }),
    prisma.user.findMany({
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: { id: true, name: true, email: true, userId: true },
    }),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-EMP-LABOR-TYPE' }),
    duplicateFrom
      ? prisma.employee.findUnique({
          where: { id: duplicateFrom },
          select: {
            employeeId: true,
            eid: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            title: true,
            laborType: true,
            departmentId: true,
            subsidiaryId: true,
            includeChildren: true,
            managerId: true,
            hireDate: true,
            terminationDate: true,
            active: true,
            employeeSubsidiaries: { select: { subsidiaryId: true } },
          },
        })
      : Promise.resolve(null),
  ])

  return (
    <MasterDataCreatePageShell backHref="/employees" backLabel="<- Back to Employees" title="New Employee" formId="create-employee-form">
      <EmployeeCreateForm
        formId="create-employee-form"
        showFooterActions={false}
        redirectBasePath="/employees"
        entities={entities}
        departments={departments}
        managers={managers}
        users={users}
        inactiveOptions={inactiveOptions}
        laborTypeOptions={laborTypeOptions}
        initialValues={duplicateEmployee ? {
          employeeId: '',
          eid: '',
          firstName: duplicateEmployee.firstName,
          lastName: duplicateEmployee.lastName,
          email: '',
          phone: duplicateEmployee.phone,
          title: duplicateEmployee.title,
          laborType: duplicateEmployee.laborType,
          departmentId: duplicateEmployee.departmentId,
          subsidiaryIds: duplicateEmployee.employeeSubsidiaries.length > 0
            ? duplicateEmployee.employeeSubsidiaries.map((assignment) => assignment.subsidiaryId)
            : duplicateEmployee.subsidiaryId ? [duplicateEmployee.subsidiaryId] : [],
          includeChildren: duplicateEmployee.includeChildren,
          managerId: duplicateEmployee.managerId,
          hireDate: duplicateEmployee.hireDate ? duplicateEmployee.hireDate.toISOString().split('T')[0] : '',
          terminationDate: duplicateEmployee.terminationDate ? duplicateEmployee.terminationDate.toISOString().split('T')[0] : '',
          inactive: !duplicateEmployee.active,
        } : undefined}
        sectionDescriptions={{
          Core: 'Identity and primary contact details for the employee.',
          Organization: 'Reporting structure and organizational placement.',
          Access: 'User account linkage and access context.',
          Employment: 'Dates and employment lifecycle details.',
          Status: 'Availability and active-state controls.',
        }}
      />
    </MasterDataCreatePageShell>
  )
}
