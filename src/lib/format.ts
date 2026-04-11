/**
 * Format a number as currency with ISO code prefix.
 * Positive: USD 10,000.00
 * Negative: (USD 10,000.00)
 */
export function fmtCurrency(value: number | null | undefined, currency = 'USD'): string {
  const n = value ?? 0
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${currency} ${formatted})` : `${currency} ${formatted}`
}

/**
 * Normalize US phone numbers to +1 (###) ###-#### when possible.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null

  const digits = raw.replace(/\D/g, '')

  let tenDigits: string | null = null
  if (digits.length === 7) {
    // Backfill legacy local numbers by assuming the default app area code.
    tenDigits = `818${digits}`
  } else if (digits.length === 10) {
    tenDigits = digits
  } else if (digits.length === 11 && digits.startsWith('1')) {
    tenDigits = digits.slice(1)
  } else if (digits.length > 10) {
    // Keep deterministic behavior for noisy inputs by taking the first 10 digits.
    tenDigits = digits.slice(0, 10)
  }

  if (!tenDigits) return raw

  const area = tenDigits.slice(0, 3)
  const prefix = tenDigits.slice(3, 6)
  const line = tenDigits.slice(6, 10)
  return `+1 (${area}) ${prefix}-${line}`
}

export function fmtPhone(value: string | null | undefined): string {
  return normalizePhone(value) ?? '—'
}
