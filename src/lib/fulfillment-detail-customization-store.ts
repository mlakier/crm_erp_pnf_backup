import { promises as fs } from 'fs'
import path from 'path'
import {
  defaultFulfillmentDetailCustomization,
  FULFILLMENT_DETAIL_FIELDS,
  FULFILLMENT_LINE_COLUMNS,
  FULFILLMENT_STAT_CARDS,
  type FulfillmentDetailCustomizationConfig,
  type FulfillmentDetailFieldKey,
  type FulfillmentLineColumnKey,
  type FulfillmentStatCardSlot,
} from '@/lib/fulfillment-detail-customization'

const STORE_PATH = path.join(process.cwd(), 'config', 'fulfillment-detail-customization.json')

function cloneDefaults(): FulfillmentDetailCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultFulfillmentDetailCustomization())) as FulfillmentDetailCustomizationConfig
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

function mergeWithDefaults(
  overrides: Partial<FulfillmentDetailCustomizationConfig> & { statCards?: unknown },
): FulfillmentDetailCustomizationConfig {
  const merged = cloneDefaults()
  merged.formColumns = normalizeColumnCount(overrides.formColumns, merged.formColumns)

  const inputSections = Array.isArray(overrides.sections)
    ? overrides.sections.map((section) => normalizeText(section)).filter((section): section is string => Boolean(section))
    : []
  if (inputSections.length > 0) {
    merged.sections = Array.from(new Set(inputSections))
  }

  const sectionRowsInput =
    overrides.sectionRows && typeof overrides.sectionRows === 'object'
      ? (overrides.sectionRows as Record<string, unknown>)
      : {}

  for (const section of merged.sections) {
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
  }

  const fieldOverrides =
    overrides.fields && typeof overrides.fields === 'object'
      ? (overrides.fields as Partial<Record<FulfillmentDetailFieldKey, Partial<FulfillmentDetailCustomizationConfig['fields'][FulfillmentDetailFieldKey]>>>)
      : {}

  for (const field of FULFILLMENT_DETAIL_FIELDS) {
    const override = fieldOverrides[field.id]
    if (!override || typeof override !== 'object') continue
    const section = normalizeText(override.section)
    merged.fields[field.id] = {
      visible: override.visible === undefined ? merged.fields[field.id].visible : override.visible === true,
      section: section ?? merged.fields[field.id].section,
      order:
        typeof override.order === 'number' && Number.isFinite(override.order)
          ? override.order
          : merged.fields[field.id].order,
      column: normalizeColumnCount(override.column, merged.fields[field.id].column),
    }
  }

  for (const field of FULFILLMENT_DETAIL_FIELDS) {
    const section = merged.fields[field.id].section
    if (!merged.sections.includes(section)) merged.sections.push(section)
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
    merged.fields[field.id].column = Math.min(merged.formColumns, Math.max(1, merged.fields[field.id].column))
  }

  const lineColumnOverrides =
    overrides.lineColumns && typeof overrides.lineColumns === 'object'
      ? (overrides.lineColumns as Partial<Record<FulfillmentLineColumnKey, Partial<FulfillmentDetailCustomizationConfig['lineColumns'][FulfillmentLineColumnKey]>>>)
      : {}

  for (const column of FULFILLMENT_LINE_COLUMNS) {
    const override = lineColumnOverrides[column.id]
    if (!override || typeof override !== 'object') continue
    merged.lineColumns[column.id] = {
      visible: override.visible === undefined ? merged.lineColumns[column.id].visible : override.visible === true,
      order:
        typeof override.order === 'number' && Number.isFinite(override.order)
          ? Math.max(0, Math.trunc(override.order))
          : merged.lineColumns[column.id].order,
    }
  }

  merged.lineColumns = Object.fromEntries(
    [...FULFILLMENT_LINE_COLUMNS]
      .map((column) => ({
        id: column.id,
        visible: merged.lineColumns[column.id].visible !== false,
        order: merged.lineColumns[column.id].order,
      }))
      .sort((left, right) => left.order - right.order)
      .map((column, index) => [
        column.id,
        {
          visible: column.visible,
          order: index,
        },
      ]),
  ) as Record<FulfillmentLineColumnKey, FulfillmentDetailCustomizationConfig['lineColumns'][FulfillmentLineColumnKey]>

  const validStatIds = new Set(FULFILLMENT_STAT_CARDS.map((card) => card.id))
  const normalizedStatCards = (Array.isArray(overrides.statCards) ? overrides.statCards : [])
    .filter((card): card is FulfillmentStatCardSlot => Boolean(card) && typeof card === 'object')
    .filter((card) => validStatIds.has(card.metric))
    .map((card, index) => ({
      id: normalizeText(card.id) ?? `slot-${index + 1}`,
      metric: card.metric,
      visible: card.visible !== false,
      order:
        typeof card.order === 'number' && Number.isFinite(card.order)
          ? Math.max(0, Math.trunc(card.order))
          : index,
    }))
    .sort((left, right) => left.order - right.order)
    .map((card, index) => ({
      ...card,
      order: index,
    }))

  merged.statCards = normalizedStatCards.length > 0 ? normalizedStatCards : cloneDefaults().statCards

  return merged
}

export async function loadFulfillmentDetailCustomization(): Promise<FulfillmentDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<FulfillmentDetailCustomizationConfig> & { statCards?: unknown }
    return mergeWithDefaults(parsed)
  } catch {
    return cloneDefaults()
  }
}

export async function saveFulfillmentDetailCustomization(
  nextConfig: FulfillmentDetailCustomizationConfig,
): Promise<FulfillmentDetailCustomizationConfig> {
  const merged = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}
