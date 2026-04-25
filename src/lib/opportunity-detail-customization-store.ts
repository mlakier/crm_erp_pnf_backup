import { promises as fs } from 'fs'
import path from 'path'
import {
  defaultOpportunityDetailCustomization,
  OPPORTUNITY_STAT_CARDS,
  type OpportunityDetailCustomizationConfig,
  type OpportunityStatCardSlot,
} from '@/lib/opportunity-detail-customization'

const STORE_PATH = path.join(process.cwd(), 'config', 'opportunity-detail-customization.json')

export async function loadOpportunityDetailCustomization(): Promise<OpportunityDetailCustomizationConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<OpportunityDetailCustomizationConfig>
    const defaults = defaultOpportunityDetailCustomization()
    const parsedStatCards = Array.isArray(parsed.statCards) ? parsed.statCards : []

    return {
      ...defaults,
      ...parsed,
      statCards:
        parsedStatCards.length > 0
          ? normalizeStatCards(parsedStatCards, defaults.statCards)
          : defaults.statCards,
    }
  } catch {
    return defaultOpportunityDetailCustomization()
  }
}

export async function saveOpportunityDetailCustomization(
  config: OpportunityDetailCustomizationConfig,
): Promise<OpportunityDetailCustomizationConfig> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return config
}

function normalizeStatCards(
  statCards: OpportunityStatCardSlot[],
  fallback: OpportunityStatCardSlot[],
): OpportunityStatCardSlot[] {
  const knownMetrics = new Set(OPPORTUNITY_STAT_CARDS.map((card) => card.id))
  const sanitized = statCards
    .filter((slot) => knownMetrics.has(slot.metric))
    .map((slot, index) => ({
      id: String(slot.id ?? '').trim() || `slot-${index + 1}`,
      metric: slot.metric,
      visible: slot.visible !== false,
      order: Number.isFinite(slot.order) ? slot.order : index,
    }))
    .sort((left, right) => left.order - right.order)
    .map((slot, index) => ({
      ...slot,
      order: index,
    }))

  return sanitized.length > 0 ? sanitized : fallback
}
