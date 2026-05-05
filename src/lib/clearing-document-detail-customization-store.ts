import { promises as fs } from 'fs'
import path from 'path'
import {
  CLEARING_DOCUMENT_LINE_COLUMNS,
  CLEARING_DOCUMENT_REFERENCE_SOURCES,
  defaultClearingDocumentDetailCustomization,
  type ClearingDocumentDetailCustomizationConfig,
  type ClearingDocumentLineColumnCustomization,
  type ClearingDocumentLineColumnKey,
} from '@/lib/clearing-document-detail-customization'
import { mergeTransactionReferenceLayouts } from '@/lib/transaction-reference-layouts'
import {
  defaultTransactionGlImpactSettings,
  TRANSACTION_GL_IMPACT_COLUMNS,
  type TransactionGlImpactColumnKey,
} from '@/lib/transaction-gl-impact'

const STORE_PATH = path.join(process.cwd(), 'config', 'clearing-document-detail-customization.json')

function cloneDefaults(): ClearingDocumentDetailCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultClearingDocumentDetailCustomization())) as ClearingDocumentDetailCustomizationConfig
}

function normalizeLineColumns(
  input: unknown,
  fallback: ClearingDocumentDetailCustomizationConfig['lineColumns'],
): ClearingDocumentDetailCustomizationConfig['lineColumns'] {
  const overrides =
    input && typeof input === 'object'
      ? (input as Partial<Record<ClearingDocumentLineColumnKey, Partial<ClearingDocumentLineColumnCustomization>>>)
      : {}

  const merged = { ...fallback }

  for (const column of CLEARING_DOCUMENT_LINE_COLUMNS) {
    const override = overrides[column.id]
    if (!override || typeof override !== 'object') continue
    merged[column.id] = {
      visible: override.visible === undefined ? merged[column.id].visible : override.visible === true,
      order:
        typeof override.order === 'number' && Number.isFinite(override.order)
          ? Math.max(0, Math.trunc(override.order))
          : merged[column.id].order,
      widthMode:
        override.widthMode === 'auto'
        || override.widthMode === 'compact'
        || override.widthMode === 'normal'
        || override.widthMode === 'wide'
          ? override.widthMode
          : merged[column.id].widthMode,
    }
  }

  return Object.fromEntries(
    [...CLEARING_DOCUMENT_LINE_COLUMNS]
      .map((column) => ({
        id: column.id,
        visible: merged[column.id].visible !== false,
        order: merged[column.id].order,
      }))
      .sort((left, right) => left.order - right.order)
      .map((column, index) => [
        column.id,
        {
          visible: column.visible,
          order: index,
          widthMode: merged[column.id].widthMode,
        },
      ]),
  ) as ClearingDocumentDetailCustomizationConfig['lineColumns']
}

function normalizeGlImpactColumns(
  input: unknown,
  fallback: ClearingDocumentDetailCustomizationConfig['glImpactColumns'],
): ClearingDocumentDetailCustomizationConfig['glImpactColumns'] {
  const overrides =
    input && typeof input === 'object'
      ? (input as Partial<
          Record<
            TransactionGlImpactColumnKey,
            Partial<ClearingDocumentDetailCustomizationConfig['glImpactColumns'][TransactionGlImpactColumnKey]>
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
        override.widthMode === 'auto'
        || override.widthMode === 'compact'
        || override.widthMode === 'normal'
        || override.widthMode === 'wide'
          ? override.widthMode
          : merged[column.id].widthMode,
    }
  }

  return Object.fromEntries(
    [...TRANSACTION_GL_IMPACT_COLUMNS]
      .map((column) => ({
        id: column.id,
        visible: merged[column.id].visible !== false,
        order: merged[column.id].order,
      }))
      .sort((left, right) => left.order - right.order)
      .map((column, index) => [
        column.id,
        {
          visible: column.visible,
          order: index,
          widthMode: merged[column.id].widthMode,
        },
      ]),
  ) as ClearingDocumentDetailCustomizationConfig['glImpactColumns']
}

export async function loadClearingDocumentDetailCustomization(): Promise<ClearingDocumentDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const defaults = cloneDefaults()
    const parsed = JSON.parse(raw) as Partial<ClearingDocumentDetailCustomizationConfig>
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
        CLEARING_DOCUMENT_REFERENCE_SOURCES,
      ),
      lineSettings:
        parsed.lineSettings && typeof parsed.lineSettings === 'object'
          ? {
              ...defaults.lineSettings,
              ...(parsed.lineSettings.fontSize === 'xs' || parsed.lineSettings.fontSize === 'sm'
                ? { fontSize: parsed.lineSettings.fontSize }
                : {}),
            }
          : defaults.lineSettings,
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
      statCards: parsed.statCards ?? defaults.statCards,
    }
  } catch {
    return cloneDefaults()
  }
}

export async function saveClearingDocumentDetailCustomization(
  nextConfig: ClearingDocumentDetailCustomizationConfig,
): Promise<ClearingDocumentDetailCustomizationConfig> {
  const defaults = cloneDefaults()
  const normalized = {
    ...defaults,
    ...nextConfig,
    fields: {
      ...defaults.fields,
      ...(nextConfig.fields ?? {}),
    },
    sectionRows: {
      ...defaults.sectionRows,
      ...(nextConfig.sectionRows ?? {}),
    },
    referenceLayouts: mergeTransactionReferenceLayouts(
      nextConfig.referenceLayouts,
      defaults.referenceLayouts,
      CLEARING_DOCUMENT_REFERENCE_SOURCES,
    ),
    lineSettings:
      nextConfig.lineSettings && typeof nextConfig.lineSettings === 'object'
        ? {
            ...defaults.lineSettings,
            ...(nextConfig.lineSettings.fontSize === 'xs' || nextConfig.lineSettings.fontSize === 'sm'
              ? { fontSize: nextConfig.lineSettings.fontSize }
              : {}),
          }
        : defaults.lineSettings,
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
    statCards: nextConfig.statCards ?? defaults.statCards,
  }
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  return normalized
}
