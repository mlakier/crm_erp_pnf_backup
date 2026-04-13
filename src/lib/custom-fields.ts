export const CUSTOM_FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'checkbox'] as const

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]

export type CustomFieldDefinitionSummary = {
  id: string
  name: string
  label: string
  type: CustomFieldType
  required: boolean
  defaultValue: string | null
  options: string | null
  entityType: string
}

export function normalizeCustomFieldEntityType(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeCustomFieldName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function parseCustomFieldOptions(value: string | null | undefined) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.map((entry) => String(entry ?? '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

export function formatCustomFieldValue(type: CustomFieldType, value: string | null | undefined) {
  if (value == null || value === '') return null
  if (type === 'checkbox') {
    return value === 'true' ? 'Yes' : 'No'
  }

  if (type === 'date') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString()
    }
  }

  return value
}