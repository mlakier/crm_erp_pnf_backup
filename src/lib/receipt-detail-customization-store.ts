import { promises as fs } from 'fs'
import path from 'path'
import {
  defaultReceiptDetailCustomization,
  RECEIPT_REFERENCE_SOURCES,
  type ReceiptDetailCustomizationConfig,
} from '@/lib/receipt-detail-customization'
import { mergeTransactionReferenceLayouts } from '@/lib/transaction-reference-layouts'
import {
  defaultTransactionGlImpactSettings,
  TRANSACTION_GL_IMPACT_COLUMNS,
  type TransactionGlImpactColumnKey,
} from '@/lib/transaction-gl-impact'

const STORE_PATH = path.join(process.cwd(), 'config', 'receipt-detail-customization.json')

function cloneDefaults(): ReceiptDetailCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultReceiptDetailCustomization())) as ReceiptDetailCustomizationConfig
}

function normalizeGlImpactColumns(
  candidate: unknown,
  fallback: ReceiptDetailCustomizationConfig['glImpactColumns'],
): ReceiptDetailCustomizationConfig['glImpactColumns'] {
  const source =
    candidate && typeof candidate === 'object'
      ? (candidate as Partial<
          Record<
            TransactionGlImpactColumnKey,
            Partial<ReceiptDetailCustomizationConfig['glImpactColumns'][TransactionGlImpactColumnKey]>
          >
        >)
      : {}

  const normalizedEntries: Array<[
    TransactionGlImpactColumnKey,
    ReceiptDetailCustomizationConfig['glImpactColumns'][TransactionGlImpactColumnKey],
  ]> = TRANSACTION_GL_IMPACT_COLUMNS.map((column, index) => {
      const override = source[column.id]
      return [
        column.id,
        {
          visible: override?.visible === undefined ? fallback[column.id].visible : override.visible === true,
          order:
            typeof override?.order === 'number' && Number.isFinite(override.order)
              ? Math.max(0, Math.trunc(override.order))
              : fallback[column.id].order ?? index,
          widthMode:
            override?.widthMode === 'auto' ||
            override?.widthMode === 'compact' ||
            override?.widthMode === 'normal' ||
            override?.widthMode === 'wide'
              ? override.widthMode
              : fallback[column.id].widthMode,
        },
      ]
    })

  return Object.fromEntries(
    normalizedEntries
      .sort((left, right) => left[1].order - right[1].order)
      .map(([id, value], index) => [id, { ...value, order: index }]),
  ) as ReceiptDetailCustomizationConfig['glImpactColumns']
}

export async function loadReceiptDetailCustomization(): Promise<ReceiptDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const defaults = cloneDefaults()
    const parsed = JSON.parse(raw) as Partial<ReceiptDetailCustomizationConfig>
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
      referenceLayouts: mergeTransactionReferenceLayouts(parsed.referenceLayouts, defaults.referenceLayouts, RECEIPT_REFERENCE_SOURCES),
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

export async function saveReceiptDetailCustomization(nextConfig: ReceiptDetailCustomizationConfig): Promise<ReceiptDetailCustomizationConfig> {
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
    referenceLayouts: mergeTransactionReferenceLayouts(nextConfig.referenceLayouts, defaults.referenceLayouts, RECEIPT_REFERENCE_SOURCES),
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
