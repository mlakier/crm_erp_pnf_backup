import { promises as fs } from 'fs'
import path from 'path'
import {
  defaultAccountingPeriodFormCustomization,
  ACCOUNTING_PERIOD_FORM_FIELDS,
  type AccountingPeriodFormCustomizationConfig,
  type AccountingPeriodFormFieldKey,
} from '@/lib/accounting-period-form-customization'

const STORE_PATH = path.join(process.cwd(), 'config', 'accounting-period-form-customization.json')

function cloneDefaults(): AccountingPeriodFormCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultAccountingPeriodFormCustomization())) as AccountingPeriodFormCustomizationConfig
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

function normalizeFieldPlacements(config: AccountingPeriodFormCustomizationConfig): AccountingPeriodFormCustomizationConfig {
  const nextConfig: AccountingPeriodFormCustomizationConfig = {
    ...config,
    sectionRows: { ...config.sectionRows },
    fields: Object.fromEntries(
      ACCOUNTING_PERIOD_FORM_FIELDS.map((field) => [field.id, { ...config.fields[field.id] }])
    ) as AccountingPeriodFormCustomizationConfig['fields'],
  }

  for (const section of nextConfig.sections) {
    const sectionFields = ACCOUNTING_PERIOD_FORM_FIELDS.filter((field) => nextConfig.fields[field.id].section === section)
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

function mergeWithDefaults(overrides: Partial<AccountingPeriodFormCustomizationConfig>): AccountingPeriodFormCustomizationConfig {
  const merged = cloneDefaults()
  merged.formColumns = normalizeColumnCount(overrides.formColumns, merged.formColumns)

  const inputSections = Array.isArray(overrides.sections)
    ? overrides.sections.map((section) => normalizeText(section)).filter((section): section is string => Boolean(section))
    : []
  if (inputSections.length > 0) {
    merged.sections = Array.from(new Set(inputSections))
  }

  const sectionRowsInput = overrides.sectionRows && typeof overrides.sectionRows === 'object'
    ? overrides.sectionRows as Record<string, unknown>
    : {}

  for (const section of merged.sections) {
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
  }

  const fieldOverrides = overrides.fields && typeof overrides.fields === 'object'
    ? overrides.fields as Partial<Record<AccountingPeriodFormFieldKey, Partial<AccountingPeriodFormCustomizationConfig['fields'][AccountingPeriodFormFieldKey]>>>
    : {}

  for (const field of ACCOUNTING_PERIOD_FORM_FIELDS) {
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

  for (const field of ACCOUNTING_PERIOD_FORM_FIELDS) {
    const section = merged.fields[field.id].section
    if (!merged.sections.includes(section)) {
      merged.sections.push(section)
    }
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
    merged.fields[field.id].column = Math.min(merged.formColumns, Math.max(1, merged.fields[field.id].column))
  }

  return normalizeFieldPlacements(merged)
}

export async function loadAccountingPeriodFormCustomization(): Promise<AccountingPeriodFormCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AccountingPeriodFormCustomizationConfig>
    return mergeWithDefaults(parsed)
  } catch {
    return cloneDefaults()
  }
}

export async function saveAccountingPeriodFormCustomization(nextConfig: AccountingPeriodFormCustomizationConfig): Promise<AccountingPeriodFormCustomizationConfig> {
  const merged = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}
