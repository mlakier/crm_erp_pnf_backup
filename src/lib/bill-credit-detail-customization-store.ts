import { promises as fs } from 'fs'
import path from 'path'
import {
  BILL_CREDIT_REFERENCE_SOURCES,
  defaultBillCreditDetailCustomization,
  type BillCreditDetailCustomizationConfig,
} from '@/lib/bill-credit-detail-customization'
import { mergeTransactionReferenceLayouts } from '@/lib/transaction-reference-layouts'
import {
  CREDIT_DOCUMENT_LINE_COLUMNS,
  defaultCreditDocumentLineSettings,
  type CreditDocumentLineColumnKey,
} from '@/lib/credit-document-detail-customization-shared'
import {
  defaultTransactionGlImpactSettings,
  TRANSACTION_GL_IMPACT_COLUMNS,
  type TransactionGlImpactColumnKey,
} from '@/lib/transaction-gl-impact'

const STORE_PATH = path.join(process.cwd(), 'config', 'bill-credit-detail-customization.json')

function cloneDefaults(): BillCreditDetailCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultBillCreditDetailCustomization())) as BillCreditDetailCustomizationConfig
}

function normalizeLineColumns(
  input: unknown,
  fallback: BillCreditDetailCustomizationConfig['lineColumns'],
): BillCreditDetailCustomizationConfig['lineColumns'] {
  const overrides =
    input && typeof input === 'object'
      ? (input as Partial<
          Record<
            CreditDocumentLineColumnKey,
            Partial<BillCreditDetailCustomizationConfig['lineColumns'][CreditDocumentLineColumnKey]>
          >
        >)
      : {}

  const merged = { ...fallback }

  for (const column of CREDIT_DOCUMENT_LINE_COLUMNS) {
    const override = overrides[column.id]
    if (!override || typeof override !== 'object') continue
    merged[column.id] = {
      visible: override.visible === undefined ? merged[column.id].visible : override.visible === true,
      order:
        typeof override.order === 'number' && Number.isFinite(override.order)
          ? Math.max(0, Math.trunc(override.order))
          : merged[column.id].order,
      widthMode:
        override.widthMode === 'auto' ||
        override.widthMode === 'compact' ||
        override.widthMode === 'normal' ||
        override.widthMode === 'wide'
          ? override.widthMode
          : merged[column.id].widthMode,
    }
  }

  return Object.fromEntries(
    [...CREDIT_DOCUMENT_LINE_COLUMNS]
      .map((column) => ({ id: column.id, visible: merged[column.id].visible !== false, order: merged[column.id].order }))
      .sort((left, right) => left.order - right.order)
      .map((column, index) => [
        column.id,
        {
          visible: column.visible,
          order: index,
          widthMode: merged[column.id].widthMode,
        },
      ]),
  ) as BillCreditDetailCustomizationConfig['lineColumns']
}

function normalizeGlImpactColumns(
  input: unknown,
  fallback: BillCreditDetailCustomizationConfig['glImpactColumns'],
): BillCreditDetailCustomizationConfig['glImpactColumns'] {
  const overrides =
    input && typeof input === 'object'
      ? (input as Partial<
          Record<
            TransactionGlImpactColumnKey,
            Partial<BillCreditDetailCustomizationConfig['glImpactColumns'][TransactionGlImpactColumnKey]>
          >
        >)
      : {}

  const merged = { ...fallback }

  for (const column of TRANSACTION_GL_IMPACT_COLUMNS) {
    const override = overrides[column.id]
    if (!override || typeof override !== 'object') continue
    merged[column.id] = {
      visible: override.visible === undefined ? merged[column.id].visible : override.visible === true,
      order:
        typeof override.order === 'number' && Number.isFinite(override.order)
          ? Math.max(0, Math.trunc(override.order))
          : merged[column.id].order,
      widthMode:
        override.widthMode === 'auto' ||
        override.widthMode === 'compact' ||
        override.widthMode === 'normal' ||
        override.widthMode === 'wide'
          ? override.widthMode
          : merged[column.id].widthMode,
    }
  }

  return Object.fromEntries(
    [...TRANSACTION_GL_IMPACT_COLUMNS]
      .map((column) => ({ id: column.id, visible: merged[column.id].visible !== false, order: merged[column.id].order }))
      .sort((left, right) => left.order - right.order)
      .map((column, index) => [
        column.id,
        {
          visible: column.visible,
          order: index,
          widthMode: merged[column.id].widthMode,
        },
      ]),
  ) as BillCreditDetailCustomizationConfig['glImpactColumns']
}

export async function loadBillCreditDetailCustomization(): Promise<BillCreditDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const defaults = cloneDefaults()
    const parsed = JSON.parse(raw) as Partial<BillCreditDetailCustomizationConfig>
    return {
      ...defaults,
      ...parsed,
      fields: {
        ...defaults.fields,
        ...(parsed.fields ?? {}),
      },
      sectionRows: {
        ...defaults.sectionRows,
        ...(parsed.sectionRows ?? {}),
      },
      referenceLayouts: mergeTransactionReferenceLayouts(
        parsed.referenceLayouts,
        defaults.referenceLayouts,
        BILL_CREDIT_REFERENCE_SOURCES,
      ),
      lineSettings:
        parsed.lineSettings && typeof parsed.lineSettings === 'object'
          ? {
              ...defaults.lineSettings,
              ...(parsed.lineSettings.fontSize === 'xs' || parsed.lineSettings.fontSize === 'sm'
                ? { fontSize: parsed.lineSettings.fontSize }
                : {}),
            }
          : defaultCreditDocumentLineSettings(),
      lineColumns: normalizeLineColumns(parsed.lineColumns, defaults.lineColumns),
      glImpactSettings:
        parsed.glImpactSettings && typeof parsed.glImpactSettings === 'object'
          ? {
              ...defaults.glImpactSettings,
              ...(parsed.glImpactSettings.fontSize === 'xs' || parsed.glImpactSettings.fontSize === 'sm'
                ? { fontSize: parsed.glImpactSettings.fontSize }
                : {}),
            }
          : defaultTransactionGlImpactSettings(),
      glImpactColumns: normalizeGlImpactColumns(parsed.glImpactColumns, defaults.glImpactColumns),
    }
  } catch {
    return cloneDefaults()
  }
}

export async function saveBillCreditDetailCustomization(
  nextConfig: BillCreditDetailCustomizationConfig,
): Promise<BillCreditDetailCustomizationConfig> {
  const defaults = cloneDefaults()
  const normalized = {
    ...defaults,
    ...nextConfig,
    referenceLayouts: mergeTransactionReferenceLayouts(
      nextConfig.referenceLayouts,
      defaults.referenceLayouts,
      BILL_CREDIT_REFERENCE_SOURCES,
    ),
    lineSettings:
      nextConfig.lineSettings && typeof nextConfig.lineSettings === 'object'
        ? {
            ...defaults.lineSettings,
            ...(nextConfig.lineSettings.fontSize === 'xs' || nextConfig.lineSettings.fontSize === 'sm'
              ? { fontSize: nextConfig.lineSettings.fontSize }
              : {}),
          }
        : defaultCreditDocumentLineSettings(),
    lineColumns: normalizeLineColumns(nextConfig.lineColumns, defaults.lineColumns),
    glImpactSettings:
      nextConfig.glImpactSettings && typeof nextConfig.glImpactSettings === 'object'
        ? {
            ...defaults.glImpactSettings,
            ...(nextConfig.glImpactSettings.fontSize === 'xs' || nextConfig.glImpactSettings.fontSize === 'sm'
              ? { fontSize: nextConfig.glImpactSettings.fontSize }
              : {}),
          }
        : defaultTransactionGlImpactSettings(),
    glImpactColumns: normalizeGlImpactColumns(nextConfig.glImpactColumns, defaults.glImpactColumns),
  }
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  return normalized
}
