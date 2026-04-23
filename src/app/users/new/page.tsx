import { prisma } from '@/lib/prisma'
import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import UserCreateForm from '@/components/UserCreateForm'
import { loadListOptionsForSource } from '@/lib/list-source'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadUserFormCustomization } from '@/lib/user-form-customization-store'

export default async function NewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string; employeeId?: string }>
}) {
  const { duplicateFrom, employeeId } = await searchParams
  const [roles, departments, employees, subsidiaries, currencies, approverUsers, inactiveOptions, formCustomization, formRequirements, duplicateUser, sourceEmployee] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
    prisma.department.findMany({ orderBy: [{ departmentId: 'asc' }, { name: 'asc' }] }),
    prisma.employee.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, employeeId: true, userId: true },
    }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.user.findMany({ orderBy: [{ userId: 'asc' }, { name: 'asc' }], select: { id: true, userId: true, name: true, email: true } }),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    loadUserFormCustomization(),
    loadFormRequirements(),
    duplicateFrom
      ? prisma.user.findUnique({
          where: { id: duplicateFrom },
          include: { subsidiaryAssignments: { select: { subsidiaryId: true } } },
        })
      : Promise.resolve(null),
    employeeId
      ? prisma.employee.findUnique({
          where: { id: employeeId },
          select: { id: true, firstName: true, lastName: true, email: true, departmentId: true, userId: true },
        })
      : Promise.resolve(null),
  ])
  const employeePrefill = sourceEmployee && !sourceEmployee.userId
    ? {
        name: `${sourceEmployee.firstName} ${sourceEmployee.lastName}`,
        email: sourceEmployee.email,
        departmentId: sourceEmployee.departmentId,
        employeeId: sourceEmployee.id,
      }
    : undefined

  return (
    <MasterDataCreatePageShell backHref="/users" backLabel="<- Back to Users" title="New User" formId="create-user-form">
      <UserCreateForm
        formId="create-user-form"
        showFooterActions={false}
        redirectBasePath="/users"
        roles={roles}
        departments={departments}
        employees={employees}
        subsidiaries={subsidiaries}
        currencies={currencies}
        approverUsers={approverUsers}
        inactiveOptions={inactiveOptions}
        initialLayoutConfig={formCustomization}
        initialRequirements={{ ...formRequirements.userCreate }}
        initialValues={duplicateUser ? {
          name: duplicateUser.name ? `Copy of ${duplicateUser.name}` : '',
          roleId: duplicateUser.roleId,
          departmentId: duplicateUser.departmentId,
          defaultSubsidiaryId: duplicateUser.defaultSubsidiaryId,
          subsidiaryIds: duplicateUser.subsidiaryAssignments.map((assignment) => assignment.subsidiaryId),
          includeChildren: duplicateUser.includeChildren,
          approvalLimit: duplicateUser.approvalLimit,
          approvalCurrencyId: duplicateUser.approvalCurrencyId,
          delegatedApproverUserId: duplicateUser.delegatedApproverUserId,
          delegationStartDate: duplicateUser.delegationStartDate?.toISOString().slice(0, 10),
          delegationEndDate: duplicateUser.delegationEndDate?.toISOString().slice(0, 10),
          locked: duplicateUser.locked,
          mustChangePassword: duplicateUser.mustChangePassword,
          failedLoginAttempts: duplicateUser.failedLoginAttempts,
          inactive: duplicateUser.inactive,
        } : employeePrefill}
        sectionDescriptions={{
          Core: 'Primary identity fields for the user account.',
          Access: 'Role and organizational access context.',
          'Subsidiary Access': 'Default subsidiary and multi-subsidiary access scope.',
          Approval: 'Approval limit and temporary approver delegation.',
          Linkage: 'Link between this user account and an employee record.',
          Security: 'Account lockout and credential state.',
          Status: 'Availability and account-state controls.',
        }}
      />
    </MasterDataCreatePageShell>
  )
}
