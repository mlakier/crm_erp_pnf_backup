import { promises as fs } from 'fs'
import path from 'path'
import {
  SUBSIDIARY_STAT_CARDS,
  defaultSubsidiaryFormCustomization,
  SUBSIDIARY_FORM_FIELDS,
  type SubsidiaryFormCustomizationConfig,
  type SubsidiaryFormFieldKey,
  type SubsidiaryStatCardMetric,
} from '@/lib/subsidiary-form-customization'

const STORE_PATH = path.join(process.cwd(), 'config', 'subsidiary-form-customization.json')

function cloneDefaults(): SubsidiaryFormCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultSubsidiaryFormCustomization())) as SubsidiaryFormCustomizationConfig
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

function normalizeFieldPlacements(config: SubsidiaryFormCustomizationConfig): SubsidiaryFormCustomizationConfig {
  const nextConfig: SubsidiaryFormCustomizationConfig = {
    ...config,
    sectionRows: { ...config.sectionRows },
    fields: Object.fromEntries(
      SUBSIDIARY_FORM_FIELDS.map((field) => [field.id, { ...config.fields[field.id] }])
    ) as SubsidiaryFormCustomizationConfig['fields'],
  }

  for (const section of nextConfig.sections) {
    const sectionFields = SUBSIDIARY_FORM_FIELDS.filter((field) => nextConfig.fields[field.id].section === section)
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

function normalizeLegacyFieldKeys(
  fieldOverrides: Partial<Record<string, Partial<SubsidiaryFormCustomizationConfig['fields'][SubsidiaryFormFieldKey]>>>
): Partial<Record<SubsidiaryFormFieldKey, Partial<SubsidiaryFormCustomizationConfig['fields'][SubsidiaryFormFieldKey]>>> {
  const keyMap: Record<string, SubsidiaryFormFieldKey> = {
    defaultCurrencyId: 'localCurrencyId',
    reportingCurrencyId: 'groupCurrencyId',
  }

  return Object.fromEntries(
    Object.entries(fieldOverrides).map(([key, value]) => [keyMap[key] ?? key, value])
  ) as Partial<Record<SubsidiaryFormFieldKey, Partial<SubsidiaryFormCustomizationConfig['fields'][SubsidiaryFormFieldKey]>>>
}

function mergeWithDefaults(overrides: Partial<SubsidiaryFormCustomizationConfig>): SubsidiaryFormCustomizationConfig {
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
    ? normalizeLegacyFieldKeys(overrides.fields as Partial<Record<string, Partial<SubsidiaryFormCustomizationConfig['fields'][SubsidiaryFormFieldKey]>>>)
    : {}
  const statCardOverrides = Array.isArray(overrides.statCards) ? overrides.statCards : []

  for (const field of SUBSIDIARY_FORM_FIELDS) {
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

  for (const field of SUBSIDIARY_FORM_FIELDS) {
    const section = merged.fields[field.id].section
    if (!merged.sections.includes(section)) merged.sections.push(section)
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
    merged.fields[field.id].column = Math.min(merged.formColumns, Math.max(1, merged.fields[field.id].column))
  }

  const allowedMetrics = new Set<SubsidiaryStatCardMetric>(SUBSIDIARY_STAT_CARDS.map((card) => card.id))
  const normalizedStatCards = statCardOverrides
    .map((entry, index) => {
      const root = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : null
      if (!root) return null
      const metric = String(root.metric ?? '').trim() as SubsidiaryStatCardMetric
      if (!allowedMetrics.has(metric)) return null
      const size: 'sm' | 'md' | 'lg' = root.size === 'sm' || root.size === 'lg' ? root.size : 'md'
      return {
        id: String(root.id ?? `subsidiary-stat-${metric}`),
        metric,
        visible: root.visible === undefined ? true : root.visible === true,
        order: typeof root.order === 'number' && Number.isFinite(root.order) ? root.order : index,
        size,
        colorized: root.colorized === undefined ? true : root.colorized === true,
        linked: root.linked === undefined ? true : root.linked === true,
      }
    })
    .filter((card): card is NonNullable<typeof card> => Boolean(card))

  merged.statCards = (normalizedStatCards.length > 0 ? normalizedStatCards : cloneDefaults().statCards ?? []).map((card, index) => ({
    ...card,
    order: index,
  }))

  return normalizeFieldPlacements(merged)
}

export async function loadSubsidiaryFormCustomization(): Promise<SubsidiaryFormCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<SubsidiaryFormCustomizationConfig>
    return mergeWithDefaults(parsed)
  } catch {
    return cloneDefaults()
  }
}

export async function saveSubsidiaryFormCustomization(nextConfig: SubsidiaryFormCustomizationConfig): Promise<SubsidiaryFormCustomizationConfig> {
  const merged = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}
