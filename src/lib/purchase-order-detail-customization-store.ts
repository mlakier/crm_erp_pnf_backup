import { promises as fs } from 'fs'
import path from 'path'
import {
  defaultPurchaseOrderDetailCustomization,
  PURCHASE_ORDER_DETAIL_FIELDS,
  PURCHASE_ORDER_LINE_COLUMNS,
  type PurchaseOrderDetailCustomizationConfig,
  type PurchaseOrderDetailFieldKey,
  type PurchaseOrderLineColumnKey,
} from '@/lib/purchase-order-detail-customization'

const STORE_PATH = path.join(process.cwd(), 'config', 'purchase-order-detail-customization.json')

function cloneDefaults(): PurchaseOrderDetailCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultPurchaseOrderDetailCustomization())) as PurchaseOrderDetailCustomizationConfig
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
  config: PurchaseOrderDetailCustomizationConfig
): PurchaseOrderDetailCustomizationConfig {
  const nextConfig: PurchaseOrderDetailCustomizationConfig = {
    ...config,
    sectionRows: { ...config.sectionRows },
    fields: Object.fromEntries(
      PURCHASE_ORDER_DETAIL_FIELDS.map((field) => [field.id, { ...config.fields[field.id] }])
    ) as PurchaseOrderDetailCustomizationConfig['fields'],
    lineColumns: Object.fromEntries(
      PURCHASE_ORDER_LINE_COLUMNS.map((column) => [column.id, { ...config.lineColumns[column.id] }])
    ) as PurchaseOrderDetailCustomizationConfig['lineColumns'],
  }

  for (const section of nextConfig.sections) {
    const sectionFields = PURCHASE_ORDER_DETAIL_FIELDS.filter(
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

  const normalizedLineColumns = PURCHASE_ORDER_LINE_COLUMNS
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
  ) as Record<PurchaseOrderLineColumnKey, PurchaseOrderDetailCustomizationConfig['lineColumns'][PurchaseOrderLineColumnKey]>

  return nextConfig
}

function mergeWithDefaults(
  overrides: Partial<PurchaseOrderDetailCustomizationConfig>
): PurchaseOrderDetailCustomizationConfig {
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
    overrides.sectionRows && typeof overrides.sectionRows === 'object'
      ? (overrides.sectionRows as Record<string, unknown>)
      : {}

  for (const section of merged.sections) {
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
  }

  const fieldOverrides =
    overrides.fields && typeof overrides.fields === 'object'
      ? (overrides.fields as Partial<
          Record<
            PurchaseOrderDetailFieldKey,
            Partial<PurchaseOrderDetailCustomizationConfig['fields'][PurchaseOrderDetailFieldKey]>
          >
        > & {
          entityId?: Partial<PurchaseOrderDetailCustomizationConfig['fields']['subsidiaryId']>
        })
      : {}
  if (!fieldOverrides.subsidiaryId && fieldOverrides.entityId) {
    fieldOverrides.subsidiaryId = fieldOverrides.entityId
  }

  for (const field of PURCHASE_ORDER_DETAIL_FIELDS) {
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

  for (const field of PURCHASE_ORDER_DETAIL_FIELDS) {
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
            PurchaseOrderLineColumnKey,
            Partial<PurchaseOrderDetailCustomizationConfig['lineColumns'][PurchaseOrderLineColumnKey]>
          >
        >)
      : {}

  for (const column of PURCHASE_ORDER_LINE_COLUMNS) {
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

  return normalizeFieldPlacements(merged)
}

export async function loadPurchaseOrderDetailCustomization(): Promise<PurchaseOrderDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<PurchaseOrderDetailCustomizationConfig>
    return mergeWithDefaults(parsed)
  } catch {
    return cloneDefaults()
  }
}

export async function savePurchaseOrderDetailCustomization(
  nextConfig: PurchaseOrderDetailCustomizationConfig
): Promise<PurchaseOrderDetailCustomizationConfig> {
  const merged = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}
