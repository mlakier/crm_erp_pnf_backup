import { promises as fs } from 'fs'
import path from 'path'
import {
  BILL_LINE_COLUMNS,
  BILL_REFERENCE_SOURCES,
  defaultBillDetailCustomization,
  type BillDetailCustomizationConfig,
  type BillLineColumnKey,
} from '@/lib/bill-detail-customization'
import { mergeTransactionReferenceLayouts } from '@/lib/transaction-reference-layouts'
import {
  defaultTransactionGlImpactSettings,
  TRANSACTION_GL_IMPACT_COLUMNS,
  type TransactionGlImpactColumnKey,
} from '@/lib/transaction-gl-impact'

const STORE_PATH = path.join(process.cwd(), 'config', 'bill-detail-customization.json')

function cloneDefaults(): BillDetailCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultBillDetailCustomization())) as BillDetailCustomizationConfig
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

function mergeWithDefaults(overrides: Partial<BillDetailCustomizationConfig>): BillDetailCustomizationConfig {
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
      ? (overrides.fields as Partial<Record<keyof BillDetailCustomizationConfig['fields'], Partial<BillDetailCustomizationConfig['fields'][keyof BillDetailCustomizationConfig['fields']]>>>)
      : {}

  for (const fieldId of Object.keys(merged.fields) as Array<keyof BillDetailCustomizationConfig['fields']>) {
    const override = fieldOverrides[fieldId]
    if (!override || typeof override !== 'object') continue
    const section = normalizeText(override.section)
    merged.fields[fieldId] = {
      visible: override.visible === undefined ? merged.fields[fieldId].visible : override.visible === true,
      section: section ?? merged.fields[fieldId].section,
      order:
        typeof override.order === 'number' && Number.isFinite(override.order)
          ? override.order
          : merged.fields[fieldId].order,
      column: normalizeColumnCount(override.column, merged.fields[fieldId].column),
    }
  }

  for (const fieldId of Object.keys(merged.fields) as Array<keyof BillDetailCustomizationConfig['fields']>) {
    const section = merged.fields[fieldId].section
    if (!merged.sections.includes(section)) merged.sections.push(section)
    merged.sectionRows[section] = normalizeRowCount(sectionRowsInput[section], merged.sectionRows[section] ?? 2)
    merged.fields[fieldId].column = Math.min(merged.formColumns, Math.max(1, merged.fields[fieldId].column))
  }

  merged.referenceLayouts = mergeTransactionReferenceLayouts(
    overrides.referenceLayouts,
    merged.referenceLayouts,
    BILL_REFERENCE_SOURCES,
  )

  if (overrides.lineSettings && typeof overrides.lineSettings === 'object') {
    merged.lineSettings = {
      ...merged.lineSettings,
      ...(overrides.lineSettings.fontSize === 'xs' || overrides.lineSettings.fontSize === 'sm'
        ? { fontSize: overrides.lineSettings.fontSize }
        : {}),
    }
  }

  const lineColumnOverrides =
    overrides.lineColumns && typeof overrides.lineColumns === 'object'
      ? (overrides.lineColumns as Partial<Record<BillLineColumnKey, Partial<BillDetailCustomizationConfig['lineColumns'][BillLineColumnKey]>>>)
      : {}

  for (const column of BILL_LINE_COLUMNS) {
    const override = lineColumnOverrides[column.id]
    if (!override || typeof override !== 'object') continue
    merged.lineColumns[column.id] = {
      visible: override.visible === undefined ? merged.lineColumns[column.id].visible : override.visible === true,
      order:
        typeof override.order === 'number' && Number.isFinite(override.order)
          ? Math.max(0, Math.trunc(override.order))
          : merged.lineColumns[column.id].order,
      widthMode:
        override.widthMode === 'auto' ||
        override.widthMode === 'compact' ||
        override.widthMode === 'normal' ||
        override.widthMode === 'wide'
          ? override.widthMode
          : merged.lineColumns[column.id].widthMode,
      showColumnMode:
        override.showColumnMode === 'always' ||
        override.showColumnMode === 'itemOnly' ||
        override.showColumnMode === 'expenseOnly'
          ? override.showColumnMode
          : merged.lineColumns[column.id].showColumnMode,
      editDisplay:
        override.editDisplay === 'label' ||
        override.editDisplay === 'idAndLabel' ||
        override.editDisplay === 'id'
          ? override.editDisplay
          : merged.lineColumns[column.id].editDisplay,
      viewDisplay:
        override.viewDisplay === 'label' ||
        override.viewDisplay === 'idAndLabel' ||
        override.viewDisplay === 'id'
          ? override.viewDisplay
          : merged.lineColumns[column.id].viewDisplay,
      dropdownDisplay:
        override.dropdownDisplay === 'label' ||
        override.dropdownDisplay === 'idAndLabel' ||
        override.dropdownDisplay === 'id'
          ? override.dropdownDisplay
          : merged.lineColumns[column.id].dropdownDisplay,
      dropdownSort:
        override.dropdownSort === 'id' || override.dropdownSort === 'label'
          ? override.dropdownSort
          : merged.lineColumns[column.id].dropdownSort,
    }
  }

  merged.lineColumns = Object.fromEntries(
    [...BILL_LINE_COLUMNS]
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
          widthMode: merged.lineColumns[column.id].widthMode,
          showColumnMode: merged.lineColumns[column.id].showColumnMode,
          editDisplay: merged.lineColumns[column.id].editDisplay,
          viewDisplay: merged.lineColumns[column.id].viewDisplay,
          dropdownDisplay: merged.lineColumns[column.id].dropdownDisplay,
          dropdownSort: merged.lineColumns[column.id].dropdownSort,
        },
      ]),
  ) as Record<BillLineColumnKey, BillDetailCustomizationConfig['lineColumns'][BillLineColumnKey]>

  if (overrides.glImpactSettings && typeof overrides.glImpactSettings === 'object') {
    merged.glImpactSettings = {
      ...merged.glImpactSettings,
      ...(overrides.glImpactSettings.fontSize === 'xs' || overrides.glImpactSettings.fontSize === 'sm'
        ? { fontSize: overrides.glImpactSettings.fontSize }
        : {}),
    }
  } else {
    merged.glImpactSettings = defaultTransactionGlImpactSettings()
  }

  const glImpactColumnOverrides =
    overrides.glImpactColumns && typeof overrides.glImpactColumns === 'object'
      ? (overrides.glImpactColumns as Partial<
          Record<
            TransactionGlImpactColumnKey,
            Partial<BillDetailCustomizationConfig['glImpactColumns'][TransactionGlImpactColumnKey]>
          >
        >)
      : {}

  for (const column of TRANSACTION_GL_IMPACT_COLUMNS) {
    const override = glImpactColumnOverrides[column.id]
    if (!override || typeof override !== 'object') continue
    merged.glImpactColumns[column.id] = {
      visible: override.visible === undefined ? merged.glImpactColumns[column.id].visible : override.visible === true,
      order:
        typeof override.order === 'number' && Number.isFinite(override.order)
          ? Math.max(0, Math.trunc(override.order))
          : merged.glImpactColumns[column.id].order,
      widthMode:
        override.widthMode === 'auto' ||
        override.widthMode === 'compact' ||
        override.widthMode === 'normal' ||
        override.widthMode === 'wide'
          ? override.widthMode
          : merged.glImpactColumns[column.id].widthMode,
    }
  }

  merged.glImpactColumns = Object.fromEntries(
    [...TRANSACTION_GL_IMPACT_COLUMNS]
      .map((column) => ({
        id: column.id,
        visible: merged.glImpactColumns[column.id].visible !== false,
        order: merged.glImpactColumns[column.id].order,
      }))
      .sort((left, right) => left.order - right.order)
      .map((column, index) => [
        column.id,
        {
          visible: column.visible,
          order: index,
          widthMode: merged.glImpactColumns[column.id].widthMode,
        },
      ]),
  ) as Record<TransactionGlImpactColumnKey, BillDetailCustomizationConfig['glImpactColumns'][TransactionGlImpactColumnKey]>

  return merged
}

export async function loadBillDetailCustomization(): Promise<BillDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<BillDetailCustomizationConfig>
    return mergeWithDefaults(parsed)
  } catch {
    return cloneDefaults()
  }
}

export async function saveBillDetailCustomization(
  nextConfig: BillDetailCustomizationConfig,
): Promise<BillDetailCustomizationConfig> {
  const normalized = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  return normalized
}
