import { promises as fs } from 'fs'
import path from 'path'
import {
  defaultPurchaseRequisitionDetailCustomization,
  PURCHASE_REQUISITION_DETAIL_FIELDS,
  type PurchaseRequisitionDetailCustomizationConfig,
} from '@/lib/purchase-requisitions-detail-customization'

const STORE_PATH = path.join(process.cwd(), 'config', 'purchase-requisitions-detail-customization.json')

function cloneDefaults(): PurchaseRequisitionDetailCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultPurchaseRequisitionDetailCustomization())) as PurchaseRequisitionDetailCustomizationConfig
}

function mergeWithDefaults(overrides: Partial<PurchaseRequisitionDetailCustomizationConfig>): PurchaseRequisitionDetailCustomizationConfig {
  const merged = cloneDefaults()
  if (!overrides || typeof overrides !== 'object') return merged

  if (typeof overrides.formColumns === 'number' && Number.isFinite(overrides.formColumns)) {
    merged.formColumns = Math.min(4, Math.max(1, Math.trunc(overrides.formColumns)))
  }

  if (Array.isArray(overrides.sections)) {
    const sections = overrides.sections.map((section) => String(section ?? '').trim()).filter(Boolean)
    if (sections.length > 0) merged.sections = Array.from(new Set(sections))
  }

  if (overrides.sectionRows && typeof overrides.sectionRows === 'object') {
    for (const section of merged.sections) {
      const nextValue = overrides.sectionRows[section]
      if (typeof nextValue === 'number' && Number.isFinite(nextValue)) {
        merged.sectionRows[section] = Math.min(12, Math.max(1, Math.trunc(nextValue)))
      }
    }
  }

  if (overrides.fields && typeof overrides.fields === 'object') {
    for (const field of PURCHASE_REQUISITION_DETAIL_FIELDS) {
      const nextField = overrides.fields[field.id]
      if (!nextField || typeof nextField !== 'object') continue
      merged.fields[field.id] = {
        visible: nextField.visible === undefined ? merged.fields[field.id].visible : nextField.visible === true,
        section: String(nextField.section ?? merged.fields[field.id].section).trim() || merged.fields[field.id].section,
        order: typeof nextField.order === 'number' && Number.isFinite(nextField.order) ? nextField.order : merged.fields[field.id].order,
        column: typeof nextField.column === 'number' && Number.isFinite(nextField.column)
          ? Math.min(merged.formColumns, Math.max(1, Math.trunc(nextField.column)))
          : merged.fields[field.id].column,
      }
    }
  }

  const fieldSections = Array.from(new Set(Object.values(merged.fields).map((field) => field.section)))
  merged.sections = Array.from(new Set([...merged.sections, ...fieldSections]))
  for (const section of merged.sections) {
    if (typeof merged.sectionRows[section] !== 'number' || !Number.isFinite(merged.sectionRows[section])) {
      merged.sectionRows[section] = 3
    }
  }

  return merged
}

export async function loadPurchaseRequisitionDetailCustomization(): Promise<PurchaseRequisitionDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<PurchaseRequisitionDetailCustomizationConfig>
    return mergeWithDefaults(parsed)
  } catch {
    return cloneDefaults()
  }
}

export async function savePurchaseRequisitionDetailCustomization(nextConfig: PurchaseRequisitionDetailCustomizationConfig): Promise<PurchaseRequisitionDetailCustomizationConfig> {
  const merged = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}
