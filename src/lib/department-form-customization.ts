import { getListSourceText, type FieldSourceType } from '@/lib/list-source'

export type DepartmentFormFieldKey =
  | 'departmentId'
  | 'departmentNumber'
  | 'name'
  | 'description'
  | 'division'
  | 'subsidiaryIds'
  | 'includeChildren'
  | 'planningCategory'
  | 'managerEmployeeId'
  | 'approverEmployeeId'
  | 'inactive'

export type DepartmentFormFieldMeta = {
  id: DepartmentFormFieldKey
  label: string
  fieldType: string
  sourceType?: FieldSourceType
  sourceKey?: string
  source?: string
  description?: string
}

export type DepartmentFormFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type DepartmentFormCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<DepartmentFormFieldKey, DepartmentFormFieldCustomization>
}

export const DEPARTMENT_FORM_FIELDS: DepartmentFormFieldMeta[] = [
  { id: 'departmentId', label: 'Department ID', fieldType: 'text', description: 'Unique department code used across the company.' },
  { id: 'departmentNumber', label: 'Department Number', fieldType: 'text', description: 'Short numeric or business-facing department number used by the company.' },
  { id: 'name', label: 'Name', fieldType: 'text', description: 'Display name of the department.' },
  { id: 'description', label: 'Description', fieldType: 'text', description: 'Longer explanation of the department purpose or scope.' },
  { id: 'division', label: 'Division', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-DEPT-DIVISION', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-DEPT-DIVISION' }), description: 'Higher-level grouping for management reporting or organizational structure.' },
  { id: 'subsidiaryIds', label: 'Subsidiaries', fieldType: 'list', sourceType: 'reference', sourceKey: 'subsidiaries', source: getListSourceText({ sourceType: 'reference', sourceKey: 'subsidiaries' }), description: 'Subsidiaries where the department is available for use.' },
  { id: 'includeChildren', label: 'Include Children', fieldType: 'list', sourceType: 'system', sourceKey: 'boolean', source: getListSourceText({ sourceType: 'system', sourceKey: 'boolean' }), description: 'Includes child subsidiaries when a parent subsidiary is selected.' },
  { id: 'planningCategory', label: 'Department Planning Category', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LIST-DEPT-PLANNING-CATEGORY', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LIST-DEPT-PLANNING-CATEGORY' }), description: 'Planning category used for company-specific department planning and reporting.' },
  { id: 'managerEmployeeId', label: 'Department Manager', fieldType: 'list', sourceType: 'reference', sourceKey: 'employees', source: getListSourceText({ sourceType: 'reference', sourceKey: 'employees' }), description: 'Employee responsible for leading the department.' },
  { id: 'approverEmployeeId', label: 'Department Approver', fieldType: 'list', sourceType: 'reference', sourceKey: 'employees', source: getListSourceText({ sourceType: 'reference', sourceKey: 'employees' }), description: 'Employee that approves department transactions or requests.' },
  { id: 'inactive', label: 'Inactive', fieldType: 'list', sourceType: 'system', sourceKey: 'activeInactive', source: getListSourceText({ sourceType: 'system', sourceKey: 'activeInactive' }), description: 'Marks the department unavailable for new activity while preserving history.' },
]

export const DEFAULT_DEPARTMENT_FORM_SECTIONS = [
  'Core',
  'Organization',
  'Status',
] as const

export function defaultDepartmentFormCustomization(): DepartmentFormCustomizationConfig {
  const sectionMap: Record<DepartmentFormFieldKey, string> = {
    departmentId: 'Core',
    departmentNumber: 'Core',
    name: 'Core',
    description: 'Core',
    division: 'Organization',
    subsidiaryIds: 'Organization',
    includeChildren: 'Organization',
    planningCategory: 'Organization',
    managerEmployeeId: 'Organization',
    approverEmployeeId: 'Organization',
    inactive: 'Status',
  }

  const columnMap: Record<DepartmentFormFieldKey, number> = {
    departmentId: 1,
    departmentNumber: 2,
    name: 1,
    description: 1,
    division: 1,
    subsidiaryIds: 2,
    includeChildren: 1,
    planningCategory: 2,
    managerEmployeeId: 1,
    approverEmployeeId: 2,
    inactive: 1,
  }

  const rowMap: Record<DepartmentFormFieldKey, number> = {
    departmentId: 0,
    departmentNumber: 0,
    name: 1,
    description: 2,
    division: 0,
    subsidiaryIds: 0,
    includeChildren: 1,
    planningCategory: 1,
    managerEmployeeId: 2,
    approverEmployeeId: 2,
    inactive: 0,
  }

  return {
    formColumns: 2,
    sections: [...DEFAULT_DEPARTMENT_FORM_SECTIONS],
    sectionRows: {
      Core: 2,
      Organization: 3,
      Status: 1,
    },
    fields: Object.fromEntries(
      DEPARTMENT_FORM_FIELDS.map((field) => [
        field.id,
        {
          visible: true,
          section: sectionMap[field.id],
          order: rowMap[field.id],
          column: columnMap[field.id],
        },
      ])
    ) as Record<DepartmentFormFieldKey, DepartmentFormFieldCustomization>,
  }
}
