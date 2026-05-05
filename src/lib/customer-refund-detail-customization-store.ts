import { promises as fs } from 'fs'
import path from 'path'
import {
  CUSTOMER_REFUND_REFERENCE_SOURCES,
  defaultCustomerRefundDetailCustomization,
  type CustomerRefundDetailCustomizationConfig,
} from '@/lib/customer-refund-detail-customization'
import { mergeTransactionReferenceLayouts } from '@/lib/transaction-reference-layouts'
import {
  defaultTransactionGlImpactSettings,
  TRANSACTION_GL_IMPACT_COLUMNS,
  type TransactionGlImpactColumnKey,
} from '@/lib/transaction-gl-impact'

const STORE_PATH = path.join(process.cwd(), 'config', 'customer-refund-detail-customization.json')

function cloneDefaults(): CustomerRefundDetailCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultCustomerRefundDetailCustomization())) as CustomerRefundDetailCustomizationConfig
}

function mergeSections(
  savedSections: unknown,
  defaultSections: string[],
) {
  const normalizedSaved = Array.isArray(savedSections)
    ? savedSections.filter((section): section is string => typeof section === 'string' && section.trim().length > 0)
    : []

  const seen = new Set<string>()
  const merged: string[] = []

  for (const section of [...defaultSections, ...normalizedSaved]) {
    if (seen.has(section)) continue
    seen.add(section)
    merged.push(section)
  }

  return merged
}

function normalizeGlImpactColumns(
  input: unknown,
  fallback: CustomerRefundDetailCustomizationConfig['glImpactColumns'],
): CustomerRefundDetailCustomizationConfig['glImpactColumns'] {
  const overrides =
    input && typeof input === 'object'
      ? (input as Partial<
          Record<
            TransactionGlImpactColumnKey,
            Partial<CustomerRefundDetailCustomizationConfig['glImpactColumns'][TransactionGlImpactColumnKey]>
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
  ) as CustomerRefundDetailCustomizationConfig['glImpactColumns']
}

export async function loadCustomerRefundDetailCustomization(): Promise<CustomerRefundDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const defaults = cloneDefaults()
    const parsed = JSON.parse(raw) as Partial<CustomerRefundDetailCustomizationConfig>
    return {
      ...defaults,
      ...parsed,
      sections: mergeSections(parsed.sections, defaults.sections),
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
        CUSTOMER_REFUND_REFERENCE_SOURCES,
      ),
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

export async function saveCustomerRefundDetailCustomization(
  nextConfig: CustomerRefundDetailCustomizationConfig,
): Promise<CustomerRefundDetailCustomizationConfig> {
  const defaults = cloneDefaults()
  const normalized = {
    ...defaults,
    ...nextConfig,
    sections: mergeSections(nextConfig.sections, defaults.sections),
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
      CUSTOMER_REFUND_REFERENCE_SOURCES,
    ),
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
