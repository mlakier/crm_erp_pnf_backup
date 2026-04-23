import { getListSourceText, type FieldSourceType } from '@/lib/list-source'

export type UserFormFieldKey =
  | 'userId'
  | 'name'
  | 'email'
  | 'roleId'
  | 'departmentId'
  | 'defaultSubsidiaryId'
  | 'subsidiaryIds'
  | 'includeChildren'
  | 'approvalLimit'
  | 'approvalCurrencyId'
  | 'delegatedApproverUserId'
  | 'delegationStartDate'
  | 'delegationEndDate'
  | 'employeeId'
  | 'locked'
  | 'mustChangePassword'
  | 'failedLoginAttempts'
  | 'lastLoginAt'
  | 'passwordChangedAt'
  | 'inactive'

export type UserFormFieldMeta = {
  id: UserFormFieldKey
  label: string
  fieldType: string
  sourceType?: FieldSourceType
  sourceKey?: string
  source?: string
  description?: string
}

export type UserFormFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type UserFormCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<UserFormFieldKey, UserFormFieldCustomization>
}

export const USER_FORM_FIELDS: UserFormFieldMeta[] = [
  { id: 'userId', label: 'User ID', fieldType: 'text', description: 'System-generated user identifier.' },
  { id: 'name', label: 'Name', fieldType: 'text', description: 'Display name for the user account.' },
  { id: 'email', label: 'Email', fieldType: 'text', description: 'Login email address for the user.' },
  { id: 'roleId', label: 'Role', fieldType: 'list', sourceType: 'reference', sourceKey: 'roles', source: getListSourceText({ sourceType: 'reference', sourceKey: 'roles' }), description: 'Primary system role assigned to the user.' },
  { id: 'departmentId', label: 'Department', fieldType: 'list', sourceType: 'reference', sourceKey: 'departments', source: getListSourceText({ sourceType: 'reference', sourceKey: 'departments' }), description: 'Department context used for workflow and reporting.' },
  { id: 'defaultSubsidiaryId', label: 'Default Subsidiary', fieldType: 'list', sourceType: 'reference', sourceKey: 'subsidiaries', source: getListSourceText({ sourceType: 'reference', sourceKey: 'subsidiaries' }), description: 'Default subsidiary context for new user activity.' },
  { id: 'subsidiaryIds', label: 'Subsidiaries', fieldType: 'list', sourceType: 'reference', sourceKey: 'subsidiaries', source: getListSourceText({ sourceType: 'reference', sourceKey: 'subsidiaries' }), description: 'Subsidiaries this user can access.' },
  { id: 'includeChildren', label: 'Include Children', fieldType: 'boolean', description: 'If enabled, child subsidiaries under selected subsidiaries are included in access scope.' },
  { id: 'approvalLimit', label: 'Approval Limit', fieldType: 'number', description: 'Maximum approval amount for routed workflows.' },
  { id: 'approvalCurrencyId', label: 'Approval Currency', fieldType: 'list', sourceType: 'reference', sourceKey: 'currencies', source: getListSourceText({ sourceType: 'reference', sourceKey: 'currencies' }), description: 'Currency used for the approval limit.' },
  { id: 'delegatedApproverUserId', label: 'Delegated Approver', fieldType: 'list', sourceType: 'reference', sourceKey: 'users', source: getListSourceText({ sourceType: 'reference', sourceKey: 'users' }), description: 'User who can approve on this user’s behalf during delegation.' },
  { id: 'delegationStartDate', label: 'Delegation Start Date', fieldType: 'date', description: 'Date delegation starts.' },
  { id: 'delegationEndDate', label: 'Delegation End Date', fieldType: 'date', description: 'Date delegation ends.' },
  { id: 'employeeId', label: 'Linked Employee', fieldType: 'list', sourceType: 'reference', sourceKey: 'employees', source: getListSourceText({ sourceType: 'reference', sourceKey: 'employees' }), description: 'Employee record linked to this user account.' },
  { id: 'locked', label: 'Locked', fieldType: 'boolean', description: 'Prevents account access until unlocked.' },
  { id: 'mustChangePassword', label: 'Must Change Password', fieldType: 'boolean', description: 'Requires password change at next login.' },
  { id: 'failedLoginAttempts', label: 'Failed Login Attempts', fieldType: 'number', description: 'Count of failed login attempts.' },
  { id: 'lastLoginAt', label: 'Last Login', fieldType: 'date', description: 'Most recent successful login date.' },
  { id: 'passwordChangedAt', label: 'Password Changed', fieldType: 'date', description: 'Most recent password change date.' },
  { id: 'inactive', label: 'Inactive', fieldType: 'list', sourceType: 'system', sourceKey: 'activeInactive', source: getListSourceText({ sourceType: 'system', sourceKey: 'activeInactive' }), description: 'Disables the user account while preserving history.' },
]

export const DEFAULT_USER_FORM_SECTIONS = [
  'Core',
  'Access',
  'Subsidiary Access',
  'Approval',
  'Linkage',
  'Security',
  'Status',
] as const

export function defaultUserFormCustomization(): UserFormCustomizationConfig {
  const sectionMap: Record<UserFormFieldKey, string> = {
    userId: 'Core',
    name: 'Core',
    email: 'Core',
    roleId: 'Access',
    departmentId: 'Access',
    defaultSubsidiaryId: 'Subsidiary Access',
    subsidiaryIds: 'Subsidiary Access',
    includeChildren: 'Subsidiary Access',
    approvalLimit: 'Approval',
    approvalCurrencyId: 'Approval',
    delegatedApproverUserId: 'Approval',
    delegationStartDate: 'Approval',
    delegationEndDate: 'Approval',
    employeeId: 'Linkage',
    locked: 'Security',
    mustChangePassword: 'Security',
    failedLoginAttempts: 'Security',
    lastLoginAt: 'Security',
    passwordChangedAt: 'Security',
    inactive: 'Status',
  }

  const columnMap: Record<UserFormFieldKey, number> = {
    userId: 1,
    name: 1,
    email: 2,
    roleId: 1,
    departmentId: 2,
    defaultSubsidiaryId: 1,
    subsidiaryIds: 1,
    includeChildren: 2,
    approvalLimit: 1,
    approvalCurrencyId: 2,
    delegatedApproverUserId: 1,
    delegationStartDate: 1,
    delegationEndDate: 2,
    employeeId: 1,
    locked: 1,
    mustChangePassword: 2,
    failedLoginAttempts: 1,
    lastLoginAt: 1,
    passwordChangedAt: 2,
    inactive: 1,
  }

  const rowMap: Record<UserFormFieldKey, number> = {
    userId: 0,
    name: 1,
    email: 1,
    roleId: 0,
    departmentId: 0,
    defaultSubsidiaryId: 0,
    subsidiaryIds: 1,
    includeChildren: 1,
    approvalLimit: 0,
    approvalCurrencyId: 0,
    delegatedApproverUserId: 1,
    delegationStartDate: 2,
    delegationEndDate: 2,
    employeeId: 0,
    locked: 0,
    mustChangePassword: 0,
    failedLoginAttempts: 1,
    lastLoginAt: 2,
    passwordChangedAt: 2,
    inactive: 0,
  }

  return {
    formColumns: 2,
    sections: [...DEFAULT_USER_FORM_SECTIONS],
    sectionRows: {
      Core: 2,
      Access: 1,
      'Subsidiary Access': 2,
      Approval: 3,
      Linkage: 1,
      Security: 3,
      Status: 1,
    },
    fields: Object.fromEntries(
      USER_FORM_FIELDS.map((field) => [
        field.id,
        {
          visible: true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<UserFormFieldKey, UserFormFieldCustomization>,
  }
}
