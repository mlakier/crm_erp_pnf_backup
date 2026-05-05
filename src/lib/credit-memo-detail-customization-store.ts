import { promises as fs } from 'fs'
import path from 'path'
import {
  CREDIT_MEMO_REFERENCE_SOURCES,
  defaultCreditMemoDetailCustomization,
  type CreditMemoDetailCustomizationConfig,
} from '@/lib/credit-memo-detail-customization'
import { mergeTransactionReferenceLayouts } from '@/lib/transaction-reference-layouts'
import {
  defaultTransactionGlImpactSettings,
  TRANSACTION_GL_IMPACT_COLUMNS,
  type TransactionGlImpactColumnKey,
} from '@/lib/transaction-gl-impact'
import {
  CREDIT_DOCUMENT_LINE_COLUMNS,
  defaultCreditDocumentLineSettings,
  type CreditDocumentLineColumnKey,
} from '@/lib/credit-document-detail-customization-shared'

const STORE_PATH = path.join(process.cwd(), 'config', 'credit-memo-detail-customization.json')

function cloneDefaults(): CreditMemoDetailCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultCreditMemoDetailCustomization())) as CreditMemoDetailCustomizationConfig
}

function normalizeLineColumns(
  input: unknown,
  fallback: CreditMemoDetailCustomizationConfig['lineColumns'],
): CreditMemoDetailCustomizationConfig['lineColumns'] {
  const overrides =
    input && typeof input === 'object'
      ? (input as Partial<
          Record<
            CreditDocumentLineColumnKey,
            Partial<CreditMemoDetailCustomizationConfig['lineColumns'][CreditDocumentLineColumnKey]>
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
  ) as CreditMemoDetailCustomizationConfig['lineColumns']
}

function normalizeGlImpactColumns(
  input: unknown,
  fallback: CreditMemoDetailCustomizationConfig['glImpactColumns'],
): CreditMemoDetailCustomizationConfig['glImpactColumns'] {
  const overrides =
    input && typeof input === 'object'
      ? (input as Partial<
          Record<
            TransactionGlImpactColumnKey,
            Partial<CreditMemoDetailCustomizationConfig['glImpactColumns'][TransactionGlImpactColumnKey]>
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
  ) as CreditMemoDetailCustomizationConfig['glImpactColumns']
}

export async function loadCreditMemoDetailCustomization(): Promise<CreditMemoDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const defaults = cloneDefaults()
    const parsed = JSON.parse(raw) as Partial<CreditMemoDetailCustomizationConfig>
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
        CREDIT_MEMO_REFERENCE_SOURCES,
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

export async function saveCreditMemoDetailCustomization(
  nextConfig: CreditMemoDetailCustomizationConfig,
): Promise<CreditMemoDetailCustomizationConfig> {
  const defaults = cloneDefaults()
  const normalized = {
    ...defaults,
    ...nextConfig,
    referenceLayouts: mergeTransactionReferenceLayouts(
      nextConfig.referenceLayouts,
      defaults.referenceLayouts,
      CREDIT_MEMO_REFERENCE_SOURCES,
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
