export type ListOptionsConfig = {
  customer: {
    industry: string[]
  }
  item: {
    type: string[]
  }
  lead: {
    source: string[]
    rating: string[]
  }
  opportunity: {
    stage: string[]
  }
}

export type ListPageKey = keyof ListOptionsConfig

export const LIST_PAGE_LABELS: Record<ListPageKey, string> = {
  customer: 'Customer',
  item: 'Item',
  lead: 'Lead',
  opportunity: 'Opportunity',
}

export const LIST_LABELS: { [P in ListPageKey]: Record<keyof ListOptionsConfig[P] & string, string> } = {
  customer: {
    industry: 'Industry',
  },
  item: {
    type: 'Type',
  },
  lead: {
    source: 'Source',
    rating: 'Rating',
  },
  opportunity: {
    stage: 'Stage',
  },
}

export const LIST_OPTIONS_DEFAULTS: ListOptionsConfig = {
  customer: {
    industry: ['Technology', 'Manufacturing', 'Healthcare', 'Financial Services', 'Retail'],
  },
  item: {
    type: ['service', 'product', 'expense'],
  },
  lead: {
    source: ['Website', 'Referral', 'Trade Show', 'Inbound Demo', 'Webinar'],
    rating: ['hot', 'warm', 'cold'],
  },
  opportunity: {
    stage: ['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost'],
  },
}

export function cloneListDefaults(): ListOptionsConfig {
  return JSON.parse(JSON.stringify(LIST_OPTIONS_DEFAULTS)) as ListOptionsConfig
}

export function getDefaultListValues<P extends ListPageKey>(page: P, list: keyof ListOptionsConfig[P] & string): string[] {
  return [...LIST_OPTIONS_DEFAULTS[page][list]]
}

export function sanitizeListValues(values: unknown, fallback: string[]): string[] {
  if (!Array.isArray(values)) return [...fallback]

  const normalized = values
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0)

  const deduped: string[] = []
  for (const value of normalized) {
    if (!deduped.includes(value)) deduped.push(value)
  }

  return deduped.length > 0 ? deduped : [...fallback]
}

export function mergeListConfig(overrides: unknown): ListOptionsConfig {
  const merged = cloneListDefaults()
  if (!overrides || typeof overrides !== 'object') return merged

  const root = overrides as Record<string, unknown>
  const pageKeys = Object.keys(merged) as ListPageKey[]

  for (const page of pageKeys) {
    const pageInput = root[page]
    if (!pageInput || typeof pageInput !== 'object') continue

    const listInput = pageInput as Record<string, unknown>
    const listKeys = Object.keys(merged[page]) as Array<keyof ListOptionsConfig[typeof page] & string>

    for (const list of listKeys) {
      if (Object.prototype.hasOwnProperty.call(listInput, list)) {
        merged[page][list] = sanitizeListValues(listInput[list], LIST_OPTIONS_DEFAULTS[page][list])
      }
    }
  }

  return merged
}
