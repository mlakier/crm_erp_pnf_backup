import { loadCompanyPreferencesSettings } from '@/lib/company-preferences-store'
import { prisma } from '@/lib/prisma'

type SnapshotSeed = {
  subsidiaryId?: string | null
  currencyId?: string | null
}

function normalizeOptionalId(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function resolveFallbackCurrencyId() {
  const settings = await loadCompanyPreferencesSettings()
  const fallbackCurrencyCode = settings.moneySettings.fallbackCurrencyCode?.trim().toUpperCase()
  if (!fallbackCurrencyCode) return null

  const currency = await prisma.currency.findFirst({
    where: {
      OR: [{ code: fallbackCurrencyCode }, { currencyId: fallbackCurrencyCode }],
    },
    select: { id: true },
  })

  return currency?.id ?? null
}

export async function resolveCustomerTransactionSnapshot(
  customerId: string | null | undefined,
  seed: SnapshotSeed = {},
) {
  const inputSubsidiaryId = normalizeOptionalId(seed.subsidiaryId)
  const inputCurrencyId = normalizeOptionalId(seed.currencyId)
  if (!customerId) {
    return {
      subsidiaryId: inputSubsidiaryId,
      currencyId: inputCurrencyId ?? (await resolveFallbackCurrencyId()),
    }
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { subsidiaryId: true, currencyId: true },
  })

  return {
    subsidiaryId: inputSubsidiaryId ?? customer?.subsidiaryId ?? null,
    currencyId: inputCurrencyId ?? customer?.currencyId ?? (await resolveFallbackCurrencyId()),
  }
}

export async function resolveVendorTransactionSnapshot(
  vendorId: string | null | undefined,
  seed: SnapshotSeed = {},
) {
  const inputSubsidiaryId = normalizeOptionalId(seed.subsidiaryId)
  const inputCurrencyId = normalizeOptionalId(seed.currencyId)
  if (!vendorId) {
    return {
      subsidiaryId: inputSubsidiaryId,
      currencyId: inputCurrencyId ?? (await resolveFallbackCurrencyId()),
    }
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { subsidiaryId: true, currencyId: true },
  })

  return {
    subsidiaryId: inputSubsidiaryId ?? vendor?.subsidiaryId ?? null,
    currencyId: inputCurrencyId ?? vendor?.currencyId ?? (await resolveFallbackCurrencyId()),
  }
}

export async function resolveDefaultCurrencySnapshot(currencyId: string | null | undefined) {
  return normalizeOptionalId(currencyId) ?? (await resolveFallbackCurrencyId())
}
