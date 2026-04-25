import { promises as fs } from 'fs'
import path from 'path'
import {
  defaultQuoteDetailCustomization,
  QUOTE_DETAIL_FIELDS,
  QUOTE_STAT_CARDS,
  type QuoteDetailCustomizationConfig,
  type QuoteStatCardSlot,
} from '@/lib/quotes-detail-customization'

const STORE_PATH = path.join(process.cwd(), 'config', 'quotes-detail-customization.json')

function cloneDefaults(): QuoteDetailCustomizationConfig {
  return JSON.parse(JSON.stringify(defaultQuoteDetailCustomization())) as QuoteDetailCustomizationConfig
}

function mergeWithDefaults(overrides: Partial<QuoteDetailCustomizationConfig>): QuoteDetailCustomizationConfig {
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
    for (const field of QUOTE_DETAIL_FIELDS) {
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

  if (overrides.lineColumns && typeof overrides.lineColumns === 'object') {
    for (const columnId of Object.keys(merged.lineColumns)) {
      const nextColumn = overrides.lineColumns[columnId as keyof typeof overrides.lineColumns]
      if (!nextColumn || typeof nextColumn !== 'object') continue
      merged.lineColumns[columnId as keyof typeof merged.lineColumns] = {
        visible:
          nextColumn.visible === undefined
            ? merged.lineColumns[columnId as keyof typeof merged.lineColumns].visible
            : nextColumn.visible === true,
        order:
          typeof nextColumn.order === 'number' && Number.isFinite(nextColumn.order)
            ? nextColumn.order
            : merged.lineColumns[columnId as keyof typeof merged.lineColumns].order,
      }
    }
  }

  const validStatIds = new Set(QUOTE_STAT_CARDS.map((card) => card.id))
  const normalizedStatCards = (Array.isArray(overrides.statCards) ? overrides.statCards : [])
    .filter((card): card is QuoteStatCardSlot => Boolean(card) && typeof card === 'object')
    .filter((card) => validStatIds.has(card.metric))
    .map((card, index) => ({
      id: String(card.id ?? '').trim() || `slot-${index + 1}`,
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

  const fieldSections = Array.from(new Set(Object.values(merged.fields).map((field) => field.section)))
  merged.sections = Array.from(new Set([...merged.sections, ...fieldSections]))
  for (const section of merged.sections) {
    if (typeof merged.sectionRows[section] !== 'number' || !Number.isFinite(merged.sectionRows[section])) {
      merged.sectionRows[section] = 3
    }
  }

  return merged
}

export async function loadQuoteDetailCustomization(): Promise<QuoteDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<QuoteDetailCustomizationConfig>
    return mergeWithDefaults(parsed)
  } catch {
    return cloneDefaults()
  }
}

export async function saveQuoteDetailCustomization(nextConfig: QuoteDetailCustomizationConfig): Promise<QuoteDetailCustomizationConfig> {
  const merged = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  return merged
}
