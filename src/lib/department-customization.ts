export const DEPARTMENT_OPTIONAL_FIELD_KEYS = [
  'departmentNumber',
  'description',
  'division',
  'subsidiaryIds',
  'includeChildren',
  'planningCategory',
  'managerEmployeeId',
  'approverEmployeeId',
] as const

export type DepartmentOptionalFieldKey = (typeof DEPARTMENT_OPTIONAL_FIELD_KEYS)[number]

export type DepartmentFieldConfig = {
  visible: boolean
  required: boolean
}

export type DepartmentCustomizationConfig = {
  fields: Record<DepartmentOptionalFieldKey, DepartmentFieldConfig>
  listBindings: {
    divisionCustomListId: string | null
    divisionDefaultValue: string | null
  }
  tableVisibility: {
    departmentNumber: boolean
    name: boolean
    description: boolean
    division: boolean
    subsidiaries: boolean
    includeChildren: boolean
    planningCategory: boolean
    manager: boolean
    approver: boolean
    status: boolean
  }
  columnOrder: string[]
}

export const DEPARTMENT_COLUMN_IDS = [
  'department-id',
  'department-number',
  'name',
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
  'actions',
] as const

export const DEPARTMENT_DEFAULT_CUSTOMIZATION: DepartmentCustomizationConfig = {
  fields: {
    departmentNumber: { visible: true, required: false },
    description: { visible: true, required: false },
    division: { visible: true, required: false },
    subsidiaryIds: { visible: true, required: false },
    includeChildren: { visible: true, required: false },
    planningCategory: { visible: true, required: false },
    managerEmployeeId: { visible: true, required: false },
    approverEmployeeId: { visible: true, required: false },
  },
  listBindings: {
    divisionCustomListId: null,
    divisionDefaultValue: null,
  },
  tableVisibility: {
    departmentNumber: true,
    name: true,
    description: true,
    division: true,
    subsidiaries: true,
    includeChildren: true,
    planningCategory: true,
    manager: true,
    approver: true,
    status: true,
  },
  columnOrder: [...DEPARTMENT_COLUMN_IDS],
}

export function cloneDepartmentCustomizationDefaults(): DepartmentCustomizationConfig {
  return JSON.parse(JSON.stringify(DEPARTMENT_DEFAULT_CUSTOMIZATION)) as DepartmentCustomizationConfig
}

function sanitizeFieldConfig(value: unknown, fallback: DepartmentFieldConfig): DepartmentFieldConfig {
  if (!value || typeof value !== 'object') {
    return { ...fallback }
  }

  const input = value as { visible?: unknown; required?: unknown }
  return {
    visible: input.visible === true,
    required: input.required === true,
  }
}

function sanitizeColumnOrder(value: unknown): string[] {
  const allowed = new Set<string>(DEPARTMENT_COLUMN_IDS)
  const fixedFirst = ['department-id', 'name']
  const next: string[] = []

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      const key = String(entry ?? '').trim()
      if (!key || key === 'actions' || fixedFirst.includes(key)) return
      if (!allowed.has(key) || next.includes(key)) return
      next.push(key)
    })
  }

  const merged: string[] = ['department-id', 'name']

  for (const id of DEPARTMENT_COLUMN_IDS) {
    if (id === 'actions' || fixedFirst.includes(id)) continue
    if (!next.includes(id)) next.push(id)
  }

  merged.push(...next)
  merged.push('actions')
  return merged
}

export function mergeDepartmentCustomization(overrides: unknown): DepartmentCustomizationConfig {
  const merged = cloneDepartmentCustomizationDefaults()
  if (!overrides || typeof overrides !== 'object') return merged

  const root = overrides as {
    fields?: Record<string, unknown>
    listBindings?: { divisionCustomListId?: unknown; divisionDefaultValue?: unknown }
    tableVisibility?: Record<string, unknown>
    columnOrder?: unknown
  }

  const fieldInput = root.fields
  if (fieldInput && typeof fieldInput === 'object') {
    for (const key of DEPARTMENT_OPTIONAL_FIELD_KEYS) {
      merged.fields[key] = sanitizeFieldConfig(fieldInput[key], merged.fields[key])
    }
  }

  if (root.listBindings && typeof root.listBindings === 'object') {
    const rawId = String(root.listBindings.divisionCustomListId ?? '').trim()
    const rawDefaultValue = String(root.listBindings.divisionDefaultValue ?? '').trim()
    merged.listBindings.divisionCustomListId = rawId || null
    merged.listBindings.divisionDefaultValue = rawDefaultValue || null
  }

  if (root.tableVisibility && typeof root.tableVisibility === 'object') {
    const input = root.tableVisibility
    if (input.departmentNumber !== undefined) merged.tableVisibility.departmentNumber = input.departmentNumber === true
    if (input.name !== undefined) merged.tableVisibility.name = input.name === true
    if (input.description !== undefined) merged.tableVisibility.description = input.description === true
    if (input.division !== undefined) merged.tableVisibility.division = input.division === true
    if (input.subsidiaries !== undefined) merged.tableVisibility.subsidiaries = input.subsidiaries === true
    if (input.includeChildren !== undefined) merged.tableVisibility.includeChildren = input.includeChildren === true
    if (input.planningCategory !== undefined) merged.tableVisibility.planningCategory = input.planningCategory === true
    if (input.manager !== undefined) merged.tableVisibility.manager = input.manager === true
    if (input.approver !== undefined) merged.tableVisibility.approver = input.approver === true
    if (input.status !== undefined) merged.tableVisibility.status = input.status === true
  }

  merged.columnOrder = sanitizeColumnOrder(root.columnOrder)
  return merged
}
