import { parseMoneyInput, roundMoney, toNumericValue } from '@/lib/format'

export type MoneyInput = Parameters<typeof toNumericValue>[0]

export function parseMoneyValue(value: unknown, fallback = 0): number {
  const parsed = parseMoneyInput(value)
  return parsed == null ? fallback : parsed
}

export function parseOptionalMoneyValue(value: unknown): number | null {
  if (value === '' || value == null) return null
  return parseMoneyInput(value)
}

export function parseQuantity(value: unknown, fallback = 1, minimum = 1): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(minimum, parsed)
}

export function calcLineTotal(quantity: unknown, unitPrice: MoneyInput): number {
  return roundMoney(parseQuantity(quantity) * toNumericValue(unitPrice, 0))
}

export function sumMoney(values: MoneyInput[]): number {
  return roundMoney(values.reduce<number>((sum, value) => sum + toNumericValue(value, 0), 0))
}

export function moneyEquals(left: MoneyInput, right: MoneyInput): boolean {
  return roundMoney(left) === roundMoney(right)
}
