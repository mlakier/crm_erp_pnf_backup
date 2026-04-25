import { promises as fs } from 'fs'
import path from 'path'
import {
  defaultItemFormCustomization,
  ITEM_FORM_FIELDS,
  type ItemFormCustomizationConfig,
  type ItemFormFieldKey,
} from '@/lib/item-form-customization'

const STORE_PATH = path.join(process.cwd(), 'config', 'item-form-customization.json')

function cloneDefaults(): ItemFormCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultItemFormCustomization())) as ItemFormCustomizationConfig
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text || null
}

function normalizeColumnCount(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(4, Math.max(1, Math.trunc(value)))
}

function normalizeRowCount(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(12, Math.max(1, Math.trunc(value)))
}

function normalizeFieldPlacements(config: ItemFormCustomizationConfig): ItemFormCustomizationConfig {
  const nextConfig: ItemFormCustomizationConfig = {
    ...config,
    sectionRows: { ...config.sectionRows },
    fields: Object.fromEntries(
      ITEM_FORM_FIELDS.map((field) => [field.id, { ...config.fields[field.id] }])
    ) as ItemFormCustomizationConfig['fields'],
  }

  for (const section of nextConfig.sections) {
    const sectionFields = ITEM_FORM_FIELDS.filter((field) => nextConfig.fields[field.id].section === section)
    const occupied = new Set<string>()
    let sectionRows = nextConfig.sectionRows[section] ?? 2

    for (const field of sectionFields) {
      const fieldConfig = nextConfig.fields[field.id]
      let column = Math.min(nextConfig.formColumns, Math.max(1, fieldConfig.column))
      let row = Math.max(0, Math.trunc(fieldConfig.order))
      let key = `${column}:${row}`

      while (row >= sectionRows || occupied.has(key)) {
        let placed = false
        for (let candidateRow = 0; candidateRow < sectionRows; candidateRow += 1) {
          for (let candidateColumn = 1; candidateColumn <= nextConfig.formColumns; candidateColumn += 1) {
            const candidateKey = `${candidateColumn}:${candidateRow}`
            if (!occupied.has(candidateKey)) {
              column = candidateColumn
              row = candidateRow
              key = candidateKey
              placed = true
              break
            }
          }
          if (placed) break
        }

        if (!placed) {
          row = sectionRows
          column = 1
          sectionRows += 1
          key = `${column}:${row}`
        }
      }

      occupied.add(key)
      nextConfig.fields[field.id] = {
        ...fieldConfig,
        column,
        order: row,
      }
    }

    nextConfig.sectionRows[section] = sectionRows
  }

  return nextConfig
}

function mergeWithDefaults(overrides: Partial<ItemFormCustomizationConfig>): ItemFormCustomizationConfig {
  const merged = cloneDefaults()
  merged.formColumns = normalizeColumnCount(overrides.formColumns, merged.formColumns)

  const inputSections = Array.isArray(overrides.sections)
    ? overrides.sections.map((section) => normalizeText(section)).filter((section): section is string => Boolean(section))
    : []
  if (inputSections.length > 0) {
    merged.sections = Array.from(new Set(inputSections))
  }

  if (!merged.sections.includes('Billing')) {
    const revenueRecognitionIndex = merged.sections.indexOf('Revenue Recognition')
    if (revenueRecognitionIndex >= 0) {
      merged.sections.splice(revenueRecognitionIndex + 1, 0, 'Billing')
    } else {
      merged.sections.push('Billing')
    }
  }

  const sectionRowsInput = overrides.sectionRows && typeof overrides.sectionRows === 'object'
    ? overrides.sectionRows as Record<string, unknown>
    : {}

  for (const section of merged.sections) {
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
  }

  const fieldOverrides = overrides.fields && typeof overrides.fields === 'object'
    ? overrides.fields as Partial<Record<ItemFormFieldKey, Partial<ItemFormCustomizationConfig['fields'][ItemFormFieldKey]>>>
    : {}

  for (const field of ITEM_FORM_FIELDS) {
    const override = fieldOverrides[field.id]
    if (!override || typeof override !== 'object') continue

    const section = normalizeText(override.section)
    merged.fields[field.id] = {
      visible: override.visible === undefined ? merged.fields[field.id].visible : override.visible === true,
      section: section ?? merged.fields[field.id].section,
      order: typeof override.order === 'number' && Number.isFinite(override.order) ? override.order : merged.fields[field.id].order,
      column: normalizeColumnCount(override.column, merged.fields[field.id].column),
    }
  }

  for (const billingFieldId of ['billingType', 'billingTrigger'] as const) {
    merged.fields[billingFieldId] = {
      ...merged.fields[billingFieldId],
      section: 'Billing',
    }
  }

  merged.fields.directRevenuePosting = {
    ...merged.fields.directRevenuePosting,
    section: 'Revenue Recognition',
    order: 3,
    column: Math.min(merged.formColumns, 2),
  }

  const billingRowDefaults: Record<'billingType' | 'billingTrigger', number> = {
    billingType: 0,
    billingTrigger: 0,
  }
  const billingColumnDefaults: Record<'billingType' | 'billingTrigger', number> = {
    billingType: 1,
    billingTrigger: 2,
  }

  for (const billingFieldId of ['billingType', 'billingTrigger'] as const) {
    const fieldConfig = merged.fields[billingFieldId]
    if (fieldConfig.section === 'Billing') {
      fieldConfig.order = billingRowDefaults[billingFieldId]
      fieldConfig.column = Math.min(merged.formColumns, billingColumnDefaults[billingFieldId])
    }
  }

  for (const field of ITEM_FORM_FIELDS) {
    const section = merged.fields[field.id].section
    if (!merged.sections.includes(section)) {
      merged.sections.push(section)
    }
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
    merged.fields[field.id].column = Math.min(merged.formColumns, Math.max(1, merged.fields[field.id].column))
  }

  return normalizeFieldPlacements(merged)
}

export async function loadItemFormCustomization(): Promise<ItemFormCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<ItemFormCustomizationConfig>
    return mergeWithDefaults(parsed)
  } catch {
    return cloneDefaults()
  }
}

export async function saveItemFormCustomization(nextConfig: ItemFormCustomizationConfig): Promise<ItemFormCustomizationConfig> {
  const merged = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}
