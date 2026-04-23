import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import UserDetailCustomizeMode from '@/components/UserDetailCustomizeMode'
import UserSecurityActions from '@/components/UserSecurityActions'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import {
  RecordDetailEmptyState,
  RecordDetailField,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadUserFormCustomization } from '@/lib/user-form-customization-store'
import { USER_FORM_FIELDS, type UserFormFieldKey } from '@/lib/user-form-customization'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

function formatDateInput(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : ''
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string; customize?: string }>
}) {
  const { id } = await params
  const { edit, customize } = await searchParams
  const isEditing = edit === '1'
  const isCustomizing = customize === '1'

  const fieldMetaById = buildFieldMetaById(USER_FORM_FIELDS)

  const [user, fieldOptions, linkedEmployee, formCustomization, formRequirements] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        department: true,
        defaultSubsidiary: true,
        approvalCurrency: true,
        delegatedApprover: true,
        subsidiaryAssignments: {
          include: { subsidiary: { select: { id: true, subsidiaryId: true, name: true } } },
          orderBy: { subsidiary: { subsidiaryId: 'asc' } },
        },
      },
    }),
    loadFieldOptionsMap(fieldMetaById as never, ['roleId', 'departmentId', 'defaultSubsidiaryId', 'subsidiaryIds', 'approvalCurrencyId', 'delegatedApproverUserId', 'employeeId', 'inactive']),
    prisma.employee.findFirst({
      where: { userId: id },
      include: {
        subsidiary: true,
        departmentRef: true,
      },
    }),
    loadUserFormCustomization(),
    loadFormRequirements(),
  ])

  if (!user) notFound()

  const detailHref = `/users/${user.id}`
  const sectionDescriptions: Record<string, string> = {
    Core: 'Primary identity fields for the user account.',
    Access: 'Role and organizational access context.',
    'Subsidiary Access': 'Default subsidiary and multi-subsidiary access scope.',
    Approval: 'Approval limit and temporary approver delegation.',
    Linkage: 'Link between this user account and an employee record.',
    Security: 'Account lockout and credential state.',
    Status: 'Availability and account-state controls.',
  }
  const subsidiaryIds = user.subsidiaryAssignments.map((assignment) => assignment.subsidiaryId)

  const fieldDefinitions: Record<UserFormFieldKey, InlineRecordSection['fields'][number]> = {
    userId: {
      name: 'userId',
      label: 'User ID',
      value: user.userId ?? '',
      helpText: 'System-generated user identifier.',
    },
    name: {
      name: 'name',
      label: 'Name',
      value: user.name ?? '',
      helpText: 'Display name for the user account.',
    },
    email: {
      name: 'email',
      label: 'Email',
      value: user.email,
      type: 'email',
      helpText: 'Login email address for the user.',
    },
    roleId: {
      name: 'roleId',
      label: 'Role',
      value: user.roleId ?? '',
      type: 'select',
      options: fieldOptions.roleId ?? [],
      helpText: 'Primary system role assigned to the user.',
      sourceText: getFieldSourceText(fieldMetaById as never, 'roleId'),
    },
    departmentId: {
      name: 'departmentId',
      label: 'Department',
      value: user.departmentId ?? '',
      type: 'select',
      options: fieldOptions.departmentId ?? [],
      helpText: 'Department context used for workflow and reporting.',
      sourceText: getFieldSourceText(fieldMetaById as never, 'departmentId'),
    },
    defaultSubsidiaryId: {
      name: 'defaultSubsidiaryId',
      label: 'Default Subsidiary',
      value: user.defaultSubsidiaryId ?? '',
      type: 'select',
      options: fieldOptions.defaultSubsidiaryId ?? [],
      helpText: 'Default subsidiary context for new user activity.',
      sourceText: getFieldSourceText(fieldMetaById as never, 'defaultSubsidiaryId'),
    },
    subsidiaryIds: {
      name: 'subsidiaryIds',
      label: 'Subsidiaries',
      value: subsidiaryIds.join(','),
      type: 'select',
      multiple: true,
      options: fieldOptions.subsidiaryIds ?? [],
      placeholder: 'Select subsidiaries',
      helpText: 'Subsidiaries this user can access.',
      sourceText: getFieldSourceText(fieldMetaById as never, 'subsidiaryIds'),
    },
    includeChildren: {
      name: 'includeChildren',
      label: 'Include Children',
      value: user.includeChildren ? 'true' : 'false',
      type: 'checkbox',
      placeholder: 'Include Children',
      helpText: 'If enabled, child subsidiaries under selected subsidiaries are included in access scope.',
    },
    approvalLimit: {
      name: 'approvalLimit',
      label: 'Approval Limit',
      value: user.approvalLimit === null || user.approvalLimit === undefined ? '' : String(user.approvalLimit),
      type: 'number',
      helpText: 'Maximum approval amount for routed workflows.',
    },
    approvalCurrencyId: {
      name: 'approvalCurrencyId',
      label: 'Approval Currency',
      value: user.approvalCurrencyId ?? '',
      type: 'select',
      options: fieldOptions.approvalCurrencyId ?? [],
      helpText: 'Currency used for the approval limit.',
      sourceText: getFieldSourceText(fieldMetaById as never, 'approvalCurrencyId'),
    },
    delegatedApproverUserId: {
      name: 'delegatedApproverUserId',
      label: 'Delegated Approver',
      value: user.delegatedApproverUserId ?? '',
      type: 'select',
      options: (fieldOptions.delegatedApproverUserId ?? []).filter((option) => option.value !== user.id),
      helpText: 'User who can approve on this user’s behalf during delegation.',
      sourceText: getFieldSourceText(fieldMetaById as never, 'delegatedApproverUserId'),
    },
    delegationStartDate: {
      name: 'delegationStartDate',
      label: 'Delegation Start Date',
      value: formatDateInput(user.delegationStartDate),
      type: 'date',
      helpText: 'Date delegation starts.',
    },
    delegationEndDate: {
      name: 'delegationEndDate',
      label: 'Delegation End Date',
      value: formatDateInput(user.delegationEndDate),
      type: 'date',
      helpText: 'Date delegation ends.',
    },
    employeeId: {
      name: 'employeeId',
      label: 'Linked Employee',
      value: linkedEmployee?.id ?? '',
      type: 'select',
      options: fieldOptions.employeeId ?? [],
      helpText: 'Employee record linked to this user account.',
      sourceText: getFieldSourceText(fieldMetaById as never, 'employeeId'),
    },
    locked: {
      name: 'locked',
      label: 'Locked',
      value: user.locked ? 'true' : 'false',
      type: 'checkbox',
      placeholder: 'Locked',
      helpText: 'Prevents account access until unlocked.',
    },
    mustChangePassword: {
      name: 'mustChangePassword',
      label: 'Must Change Password',
      value: user.mustChangePassword ? 'true' : 'false',
      type: 'checkbox',
      placeholder: 'Must Change Password',
      helpText: 'Requires password change at next login.',
    },
    failedLoginAttempts: {
      name: 'failedLoginAttempts',
      label: 'Failed Login Attempts',
      value: String(user.failedLoginAttempts),
      type: 'number',
      helpText: 'Count of failed login attempts.',
    },
    lastLoginAt: {
      name: 'lastLoginAt',
      label: 'Last Login',
      value: formatDateInput(user.lastLoginAt),
      type: 'date',
      helpText: 'Most recent successful login date.',
    },
    passwordChangedAt: {
      name: 'passwordChangedAt',
      label: 'Password Changed',
      value: formatDateInput(user.passwordChangedAt),
      type: 'date',
      helpText: 'Most recent password change date.',
    },
    inactive: {
      name: 'inactive',
      label: 'Inactive',
      value: user.inactive ? 'true' : 'false',
      type: 'select',
      options: fieldOptions.inactive ?? [],
      helpText: 'Disables the user account while preserving history.',
      sourceText: getFieldSourceText(fieldMetaById as never, 'inactive'),
    },
  }

  const customizeFields = buildCustomizePreviewFields(USER_FORM_FIELDS, fieldDefinitions)
  const detailSections: InlineRecordSection[] = buildConfiguredInlineSections({
    fields: USER_FORM_FIELDS,
    layout: formCustomization,
    fieldDefinitions,
    sectionDescriptions,
  })
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'user',
    entityId: user.id,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'user', entityId: user.id })

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/users'}
      backLabel={isCustomizing ? '<- Back to User Detail' : '<- Back to Users'}
      meta={user.userId ?? 'Pending'}
      title={user.name ?? user.email}
      badge={
        user.role?.name ? (
          <span className="inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
            {user.role.name}
          </span>
        ) : null
      }
      actions={
        <>
          {isEditing && !isCustomizing ? (
            <>
              <Link href={detailHref} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                Cancel
              </Link>
              <button
                type="submit"
                form={`inline-record-form-${user.id}`}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Save
              </button>
            </>
          ) : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailCreateMenu newHref="/users/new" duplicateHref={`/users/new?duplicateFrom=${user.id}`} /> : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailExportMenu title={user.name ?? user.email} fileName={`user-${user.userId ?? user.id}`} sections={detailSections} /> : null}
          {!isEditing && !isCustomizing ? (
            <Link href={`${detailHref}?customize=1`} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
              Customize
            </Link>
          ) : null}
          {!isEditing && !isCustomizing ? (
            <Link href={`${detailHref}?edit=1`} className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>
              Edit
            </Link>
          ) : null}
          {!isCustomizing ? <DeleteButton resource="users" id={user.id} /> : null}
        </>
      }
    >
        {isCustomizing ? (
          <UserDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={formCustomization}
            initialRequirements={{ ...formRequirements.userCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
          />
        ) : (
          <InlineRecordDetails
            resource="users"
            id={user.id}
            title="User details"
            sections={detailSections}
            editing={isEditing}
            columns={formCustomization.formColumns}
            showInternalActions={false}
          />
        )}

        {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} /> : null}

        {!isCustomizing ? (
          <RecordDetailSection title="Security" count={1}>
            <div className="grid gap-4 px-6 py-4 sm:grid-cols-2">
              <RecordDetailField label="Password">
                <div className="space-y-2">
                  <p style={{ color: 'var(--text-muted)' }}>Not displayed</p>
                  <UserSecurityActions locked={user.locked} />
                </div>
              </RecordDetailField>
            </div>
          </RecordDetailSection>
        ) : null}

        <RecordDetailSection title="Linked Employee" count={linkedEmployee ? 1 : 0}>
          {linkedEmployee ? (
            <div className="grid gap-x-10 gap-y-4 px-6 py-4 sm:grid-cols-2">
              <RecordDetailField label="Employee">
                <Link href={`/employees/${linkedEmployee.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                  {linkedEmployee.firstName} {linkedEmployee.lastName}
                </Link>
              </RecordDetailField>
              <RecordDetailField label="Employee ID">{linkedEmployee.employeeId ?? '-'}</RecordDetailField>
              <RecordDetailField label="Department">{linkedEmployee.departmentRef ? `${linkedEmployee.departmentRef.departmentId} - ${linkedEmployee.departmentRef.name}` : '-'}</RecordDetailField>
              <RecordDetailField label="Subsidiary">{linkedEmployee.subsidiary ? `${linkedEmployee.subsidiary.subsidiaryId} - ${linkedEmployee.subsidiary.name}` : '-'}</RecordDetailField>
            </div>
          ) : (
            <RecordDetailEmptyState message="No employee linked to this user." />
          )}
        </RecordDetailSection>
        <SystemNotesSection notes={systemNotes} />
    </RecordDetailPageShell>
  )
}
