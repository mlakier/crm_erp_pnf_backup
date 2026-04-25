import { promises as fs } from 'fs'
import path from 'path'
import {
  defaultInvoiceDetailCustomization,
  INVOICE_DETAIL_FIELDS,
  INVOICE_LINE_COLUMNS,
  INVOICE_STAT_CARDS,
  type InvoiceDetailCustomizationConfig,
  type InvoiceDetailFieldKey,
  type InvoiceLineColumnKey,
  type InvoiceStatCardKey,
  type InvoiceStatCardSlot,
} from '@/lib/invoice-detail-customization'

const STORE_PATH = path.join(process.cwd(), 'config', 'invoice-detail-customization.json')

function cloneDefaults(): InvoiceDetailCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultInvoiceDetailCustomization())) as InvoiceDetailCustomizationConfig
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

function mergeWithDefaults(overrides: Partial<InvoiceDetailCustomizationConfig>): InvoiceDetailCustomizationConfig {
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
      ? (overrides.fields as Partial<Record<InvoiceDetailFieldKey, Partial<InvoiceDetailCustomizationConfig['fields'][InvoiceDetailFieldKey]>>>)
      : {}

  for (const field of INVOICE_DETAIL_FIELDS) {
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

  for (const field of INVOICE_DETAIL_FIELDS) {
    const section = merged.fields[field.id].section
    if (!merged.sections.includes(section)) merged.sections.push(section)
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
    merged.fields[field.id].column = Math.min(merged.formColumns, Math.max(1, merged.fields[field.id].column))
  }

  const lineColumnOverrides =
    overrides.lineColumns && typeof overrides.lineColumns === 'object'
      ? (overrides.lineColumns as Partial<Record<InvoiceLineColumnKey, Partial<InvoiceDetailCustomizationConfig['lineColumns'][InvoiceLineColumnKey]>>>)
      : {}

  for (const column of INVOICE_LINE_COLUMNS) {
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
    [...INVOICE_LINE_COLUMNS]
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
  ) as Record<InvoiceLineColumnKey, InvoiceDetailCustomizationConfig['lineColumns'][InvoiceLineColumnKey]>

  const validStatIds = new Set(INVOICE_STAT_CARDS.map((card) => card.id))
  const normalizedStatCards = (Array.isArray(overrides.statCards) ? overrides.statCards : [])
    .filter((card): card is InvoiceStatCardSlot => Boolean(card) && typeof card === 'object')
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

export async function loadInvoiceDetailCustomization(): Promise<InvoiceDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<InvoiceDetailCustomizationConfig>
    return mergeWithDefaults(parsed)
  } catch {
    return cloneDefaults()
  }
}

export async function saveInvoiceDetailCustomization(
  nextConfig: InvoiceDetailCustomizationConfig,
): Promise<InvoiceDetailCustomizationConfig> {
  const merged = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}
