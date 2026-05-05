export const CANONICAL_EXCHANGE_RATE_TYPES = [
  { value: 'spot', label: 'Spot' },
  { value: 'average', label: 'Average' },
  { value: 'closing', label: 'Closing' },
  { value: 'historical', label: 'Historical' },
] as const

export type CanonicalExchangeRateType = (typeof CANONICAL_EXCHANGE_RATE_TYPES)[number]['value']

const LABEL_BY_VALUE = new Map<string, string>(
  CANONICAL_EXCHANGE_RATE_TYPES.map((option) => [option.value, option.label]),
)

export function normalizeExchangeRateType(value: unknown): CanonicalExchangeRateType {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'spot' || normalized === 'average' || normalized === 'closing' || normalized === 'historical') {
    return normalized
  }

  return 'spot'
}

export function isCanonicalExchangeRateType(value: unknown): value is CanonicalExchangeRateType {
  const normalized = String(value ?? '').trim().toLowerCase()
  return LABEL_BY_VALUE.has(normalized)
}

export function getExchangeRateTypeLabel(value: unknown) {
  const normalized = normalizeExchangeRateType(value)
  return LABEL_BY_VALUE.get(normalized) ?? 'Spot'
}
