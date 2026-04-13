export const DEPARTMENT_OPTIONAL_FIELD_KEYS = ['description', 'division', 'entityId', 'managerId'] as const

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
    name: boolean
    description: boolean
    division: boolean
    subsidiary: boolean
    manager: boolean
    status: boolean
  }
  columnOrder: string[]
}

export const DEPARTMENT_COLUMN_IDS = [
  'code',
  'name',
  'description',
  'division',
  'subsidiary',
  'manager',
  'status',
  'created',
  'last-modified',
  'actions',
] as const

export const DEPARTMENT_DEFAULT_CUSTOMIZATION: DepartmentCustomizationConfig = {
  fields: {
    description: { visible: true, required: false },
    division: { visible: true, required: false },
    entityId: { visible: true, required: false },
    managerId: { visible: true, required: false },
  },
  listBindings: {
    divisionCustomListId: null,
    divisionDefaultValue: null,
  },
  tableVisibility: {
    name: true,
    description: true,
    division: true,
    subsidiary: true,
    manager: true,
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
  const fixedFirst = ['code', 'name']
  const next: string[] = []

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      const key = String(entry ?? '').trim()
      if (!key || key === 'actions' || fixedFirst.includes(key)) return
      if (!allowed.has(key) || next.includes(key)) return
      next.push(key)
    })
  }

  const merged: string[] = ['code', 'name']

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
    merged.tableVisibility.name = input.name === true
    merged.tableVisibility.description = input.description === true
    merged.tableVisibility.division = input.division === true
    merged.tableVisibility.subsidiary = input.subsidiary === true
    merged.tableVisibility.manager = input.manager === true
    merged.tableVisibility.status = input.status === true
  }

  merged.columnOrder = sanitizeColumnOrder(root.columnOrder)
  return merged
}
