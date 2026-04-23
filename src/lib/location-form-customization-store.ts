import { promises as fs } from 'fs'
import path from 'path'
import {
  defaultLocationFormCustomization,
  LOCATION_FORM_FIELDS,
  type LocationFormCustomizationConfig,
  type LocationFormFieldKey,
} from '@/lib/location-form-customization'

const STORE_PATH = path.join(process.cwd(), 'config', 'location-form-customization.json')

function cloneDefaults(): LocationFormCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultLocationFormCustomization())) as LocationFormCustomizationConfig
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text || null
}

function normalizeColumnCount(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(4, Math.max(1, Math.trunc(value)))
}

function normalizeRowCount(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(12, Math.max(1, Math.trunc(value)))
}

function mergeWithDefaults(overrides: Partial<LocationFormCustomizationConfig>): LocationFormCustomizationConfig {
  const merged = cloneDefaults()
  merged.formColumns = normalizeColumnCount(overrides.formColumns, merged.formColumns)

  const sections = Array.isArray(overrides.sections)
    ? overrides.sections.map((section) => normalizeText(section)).filter((section): section is string => Boolean(section))
    : []
  if (sections.length > 0) merged.sections = Array.from(new Set(sections))

  const sectionRowsInput = overrides.sectionRows && typeof overrides.sectionRows === 'object'
    ? overrides.sectionRows as Record<string, unknown>
    : {}
  for (const section of merged.sections) {
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
  }

  const fieldOverrides = overrides.fields && typeof overrides.fields === 'object'
    ? overrides.fields as Partial<Record<LocationFormFieldKey, Partial<LocationFormCustomizationConfig['fields'][LocationFormFieldKey]>>>
    : {}

  for (const field of LOCATION_FORM_FIELDS) {
    const override = fieldOverrides[field.id]
    if (!override || typeof override !== 'object') continue
    const section = normalizeText(override.section)
    merged.fields[field.id] = {
      visible: override.visible === undefined ? merged.fields[field.id].visible : override.visible === true,
      section: section ?? merged.fields[field.id].section,
      order: typeof override.order === 'number' && Number.isFinite(override.order) ? Math.max(0, Math.trunc(override.order)) : merged.fields[field.id].order,
      column: normalizeColumnCount(override.column, merged.fields[field.id].column),
    }
  }

  for (const field of LOCATION_FORM_FIELDS) {
    const section = merged.fields[field.id].section
    if (!merged.sections.includes(section)) merged.sections.push(section)
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
    merged.fields[field.id].column = Math.min(merged.formColumns, Math.max(1, merged.fields[field.id].column))
  }

  return merged
}

export async function loadLocationFormCustomization(): Promise<LocationFormCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    return mergeWithDefaults(JSON.parse(raw) as Partial<LocationFormCustomizationConfig>)
  } catch {
    return cloneDefaults()
  }
}

export async function saveLocationFormCustomization(nextConfig: LocationFormCustomizationConfig): Promise<LocationFormCustomizationConfig> {
  const merged = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}
