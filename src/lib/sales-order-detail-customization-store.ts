import { promises as fs } from 'fs'
import path from 'path'
import {
  defaultSalesOrderDetailCustomization,
  SALES_ORDER_DETAIL_FIELDS,
  SALES_ORDER_LINE_COLUMNS,
  SALES_ORDER_STAT_CARDS,
  type SalesOrderDetailCustomizationConfig,
  type SalesOrderDetailFieldKey,
  type SalesOrderLineColumnKey,
  type SalesOrderStatCardKey,
  type SalesOrderStatCardSlot,
} from '@/lib/sales-order-detail-customization'

const STORE_PATH = path.join(process.cwd(), 'config', 'sales-order-detail-customization.json')

function cloneDefaults(): SalesOrderDetailCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultSalesOrderDetailCustomization())) as SalesOrderDetailCustomizationConfig
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

function normalizeFieldPlacements(
  config: SalesOrderDetailCustomizationConfig
): SalesOrderDetailCustomizationConfig {
  const nextConfig: SalesOrderDetailCustomizationConfig = {
    ...config,
    sectionRows: { ...config.sectionRows },
    fields: Object.fromEntries(
      SALES_ORDER_DETAIL_FIELDS.map((field) => [field.id, { ...config.fields[field.id] }])
    ) as SalesOrderDetailCustomizationConfig['fields'],
    lineColumns: Object.fromEntries(
      SALES_ORDER_LINE_COLUMNS.map((column) => [column.id, { ...config.lineColumns[column.id] }])
    ) as SalesOrderDetailCustomizationConfig['lineColumns'],
    statCards: [...config.statCards].map((card) => ({ ...card })),
  }

  for (const section of nextConfig.sections) {
    const sectionFields = SALES_ORDER_DETAIL_FIELDS.filter(
      (field) => nextConfig.fields[field.id].section === section
    )
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

  const normalizedLineColumns = SALES_ORDER_LINE_COLUMNS
    .map((column) => ({
      id: column.id,
      visible: nextConfig.lineColumns[column.id]?.visible !== false,
      order:
        typeof nextConfig.lineColumns[column.id]?.order === 'number' &&
        Number.isFinite(nextConfig.lineColumns[column.id].order)
          ? nextConfig.lineColumns[column.id].order
          : 0,
    }))
    .sort((left, right) => left.order - right.order)

  nextConfig.lineColumns = Object.fromEntries(
    normalizedLineColumns.map((column, index) => [
      column.id,
      {
        visible: column.visible,
        order: index,
      },
    ])
  ) as Record<SalesOrderLineColumnKey, SalesOrderDetailCustomizationConfig['lineColumns'][SalesOrderLineColumnKey]>

  const validStatIds = new Set(SALES_ORDER_STAT_CARDS.map((card) => card.id))
  const normalizedStatCards = nextConfig.statCards
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

  nextConfig.statCards = normalizedStatCards.length > 0 ? normalizedStatCards : cloneDefaults().statCards

  return nextConfig
}

function normalizeLegacyStatCards(
  value: unknown
): SalesOrderStatCardSlot[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map((entry, index) => ({
        id: normalizeText(entry.id) ?? `slot-${index + 1}`,
        metric: String(entry.metric ?? '') as SalesOrderStatCardKey,
        visible: entry.visible !== false,
        order:
          typeof entry.order === 'number' && Number.isFinite(entry.order)
            ? Math.max(0, Math.trunc(entry.order))
            : index,
      }))
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([metric, config], index) => {
      const typedConfig = config && typeof config === 'object' ? (config as Record<string, unknown>) : {}
      return {
        id: `slot-${index + 1}`,
        metric: metric as SalesOrderStatCardKey,
        visible: typedConfig.visible !== false,
        order:
          typeof typedConfig.order === 'number' && Number.isFinite(typedConfig.order)
            ? Math.max(0, Math.trunc(typedConfig.order))
            : index,
      }
    })
  }

  return []
}

function mergeWithDefaults(
  overrides: Partial<SalesOrderDetailCustomizationConfig> & { statCards?: unknown }
): SalesOrderDetailCustomizationConfig {
  const merged = cloneDefaults()
  merged.formColumns = normalizeColumnCount(overrides.formColumns, merged.formColumns)

  const inputSections = Array.isArray(overrides.sections)
    ? overrides.sections
        .map((section) => normalizeText(section))
        .filter((section): section is string => Boolean(section))
    : []
  if (inputSections.length > 0) {
    merged.sections = Array.from(new Set(inputSections))
  }

  const sectionRowsInput =
    overrides.sectionRows && typeof overrides.sectionRows === "object"
      ? (overrides.sectionRows as Record<string, unknown>)
      : {}

  for (const section of merged.sections) {
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
  }

  const fieldOverrides =
    overrides.fields && typeof overrides.fields === 'object'
      ? (overrides.fields as Partial<
          Record<
            SalesOrderDetailFieldKey,
            Partial<SalesOrderDetailCustomizationConfig['fields'][SalesOrderDetailFieldKey]>
          >
        > & {
          entityId?: Partial<SalesOrderDetailCustomizationConfig['fields']['subsidiaryId']>
        })
      : {}
  if (!fieldOverrides.subsidiaryId && fieldOverrides.entityId) {
    fieldOverrides.subsidiaryId = fieldOverrides.entityId
  }

  for (const field of SALES_ORDER_DETAIL_FIELDS) {
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

  for (const field of SALES_ORDER_DETAIL_FIELDS) {
    const section = merged.fields[field.id].section
    if (!merged.sections.includes(section)) {
      merged.sections.push(section)
    }
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
    merged.fields[field.id].column = Math.min(merged.formColumns, Math.max(1, merged.fields[field.id].column))
  }

  const lineColumnOverrides =
    overrides.lineColumns && typeof overrides.lineColumns === 'object'
      ? (overrides.lineColumns as Partial<
          Record<
            SalesOrderLineColumnKey,
            Partial<SalesOrderDetailCustomizationConfig['lineColumns'][SalesOrderLineColumnKey]>
          >
        >)
      : {}

  for (const column of SALES_ORDER_LINE_COLUMNS) {
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

  const normalizedStatCards = normalizeLegacyStatCards(overrides.statCards)
  if (normalizedStatCards.length > 0) {
    merged.statCards = normalizedStatCards
  }

  return normalizeFieldPlacements(merged)
}

export async function loadSalesOrderDetailCustomization(): Promise<SalesOrderDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<SalesOrderDetailCustomizationConfig> & { statCards?: unknown }
    return mergeWithDefaults(parsed)
  } catch {
    return cloneDefaults()
  }
}

export async function saveSalesOrderDetailCustomization(
  nextConfig: SalesOrderDetailCustomizationConfig
): Promise<SalesOrderDetailCustomizationConfig> {
  const merged = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}
