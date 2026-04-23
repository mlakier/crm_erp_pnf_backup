import { getListSourceText, type FieldSourceType } from '@/lib/list-source'

export type EmployeeFormFieldKey =
  | 'employeeId'
  | 'eid'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'title'
  | 'laborType'
  | 'departmentId'
  | 'subsidiaryIds'
  | 'includeChildren'
  | 'managerId'
  | 'userId'
  | 'hireDate'
  | 'terminationDate'
  | 'inactive'

export type EmployeeFormFieldMeta = {
  id: EmployeeFormFieldKey
  label: string
  fieldType: string
  sourceType?: FieldSourceType
  sourceKey?: string
  source?: string
  description?: string
}

export type EmployeeFormFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type EmployeeFormCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<EmployeeFormFieldKey, EmployeeFormFieldCustomization>
}

export const EMPLOYEE_FORM_FIELDS: EmployeeFormFieldMeta[] = [
  { id: 'employeeId', label: 'Employee ID', fieldType: 'text', description: 'Unique employee number or code.' },
  { id: 'eid', label: 'EID', fieldType: 'text', description: 'External or enterprise employee identifier.' },
  { id: 'firstName', label: 'First Name', fieldType: 'text', description: 'Given name of the employee.' },
  { id: 'lastName', label: 'Last Name', fieldType: 'text', description: 'Family name of the employee.' },
  { id: 'email', label: 'Email', fieldType: 'text', description: 'Primary work email address.' },
  { id: 'phone', label: 'Phone', fieldType: 'text', description: 'Primary work phone number.' },
  { id: 'title', label: 'Title', fieldType: 'text', description: 'Job title or role label.' },
  { id: 'laborType', label: 'Labor Type', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-EMP-LABOR-TYPE', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-EMP-LABOR-TYPE' }), description: 'Labor classification used for staffing, costing, or billing.' },
  { id: 'departmentId', label: 'Department', fieldType: 'list', sourceType: 'reference', sourceKey: 'departments', source: getListSourceText({ sourceType: 'reference', sourceKey: 'departments' }), description: 'Department the employee belongs to.' },
  { id: 'subsidiaryIds', label: 'Subsidiaries', fieldType: 'list', sourceType: 'reference', sourceKey: 'subsidiaries', source: getListSourceText({ sourceType: 'reference', sourceKey: 'subsidiaries' }), description: 'Subsidiaries where the employee is available.' },
  { id: 'includeChildren', label: 'Include Children', fieldType: 'boolean', description: 'If enabled, child subsidiaries under selected subsidiaries also inherit employee availability.' },
  { id: 'managerId', label: 'Manager', fieldType: 'list', sourceType: 'reference', sourceKey: 'employees', source: getListSourceText({ sourceType: 'reference', sourceKey: 'employees' }), description: 'Direct manager of the employee.' },
  { id: 'userId', label: 'Linked User', fieldType: 'list', sourceType: 'reference', sourceKey: 'users', source: getListSourceText({ sourceType: 'reference', sourceKey: 'users' }), description: 'User account linked to this employee.' },
  { id: 'hireDate', label: 'Hire Date', fieldType: 'date', description: 'Date the employee joined the company.' },
  { id: 'terminationDate', label: 'Termination Date', fieldType: 'date', description: 'Date the employee left the company, if applicable.' },
  { id: 'inactive', label: 'Inactive', fieldType: 'list', sourceType: 'system', sourceKey: 'activeInactive', source: getListSourceText({ sourceType: 'system', sourceKey: 'activeInactive' }), description: 'Marks the employee unavailable for new activity while preserving history.' },
]

export const DEFAULT_EMPLOYEE_FORM_SECTIONS = [
  'Core',
  'Organization',
  'Access',
  'Employment',
  'Status',
] as const

export function defaultEmployeeFormCustomization(): EmployeeFormCustomizationConfig {
  const sectionMap: Record<EmployeeFormFieldKey, string> = {
    employeeId: 'Core',
    eid: 'Core',
    firstName: 'Core',
    lastName: 'Core',
    email: 'Core',
    phone: 'Core',
    title: 'Organization',
    laborType: 'Organization',
    departmentId: 'Organization',
    subsidiaryIds: 'Organization',
    includeChildren: 'Organization',
    managerId: 'Organization',
    userId: 'Access',
    hireDate: 'Employment',
    terminationDate: 'Employment',
    inactive: 'Status',
  }

  const columnMap: Record<EmployeeFormFieldKey, number> = {
    employeeId: 1,
    eid: 2,
    firstName: 1,
    lastName: 2,
    email: 1,
    phone: 2,
    title: 1,
    laborType: 2,
    departmentId: 1,
    subsidiaryIds: 2,
    includeChildren: 1,
    managerId: 1,
    userId: 1,
    hireDate: 1,
    terminationDate: 2,
    inactive: 1,
  }

  const rowMap: Record<EmployeeFormFieldKey, number> = {
    employeeId: 0,
    eid: 0,
    firstName: 1,
    lastName: 1,
    email: 2,
    phone: 2,
    title: 0,
    laborType: 0,
    departmentId: 1,
    subsidiaryIds: 1,
    includeChildren: 2,
    managerId: 3,
    userId: 0,
    hireDate: 0,
    terminationDate: 0,
    inactive: 0,
  }

  return {
    formColumns: 2,
    sections: [...DEFAULT_EMPLOYEE_FORM_SECTIONS],
    sectionRows: {
      Core: 3,
      Organization: 4,
      Access: 1,
      Employment: 1,
      Status: 1,
    },
    fields: Object.fromEntries(
      EMPLOYEE_FORM_FIELDS.map((field) => [
        field.id,
        {
          visible: true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<EmployeeFormFieldKey, EmployeeFormFieldCustomization>,
  }
}
