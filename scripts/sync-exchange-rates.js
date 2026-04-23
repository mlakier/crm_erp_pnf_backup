require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const FRANKFURTER_API_URL = 'https://api.frankfurter.dev/v2/rates'
const FRANKFURTER_PROVIDER = 'ECB'
const INTEGRATION_KEY = 'frankfurter-exchange-rates'
const RATE_TYPE = 'spot'

async function logSync(status, message) {
  try {
    await prisma.integrationLog.create({
      data: {
        integration: INTEGRATION_KEY,
        action: 'sync-latest',
        status,
        message,
      },
    })
  } catch {
    // Do not block on log writes.
  }
}

async function getBaseAndQuoteCurrencies() {
  const activeCurrencies = await prisma.currency.findMany({
    where: { active: true },
    orderBy: [{ isBase: 'desc' }, { currencyId: 'asc' }],
  })

  if (activeCurrencies.length < 2) {
    throw new Error('At least two active currencies are required before syncing exchange rates.')
  }

  const baseCurrency =
    activeCurrencies.find((currency) => currency.isBase)
    || activeCurrencies.find((currency) => currency.currencyId === 'USD')
    || activeCurrencies[0]

  const quoteCurrencies = activeCurrencies.filter((currency) => currency.id !== baseCurrency.id)

  if (quoteCurrencies.length === 0) {
    throw new Error('No quote currencies available for exchange rate sync.')
  }

  return { baseCurrency, quoteCurrencies }
}

function normalizeFrankfurterResponse(payload) {
  if (Array.isArray(payload)) {
    return payload
      .map((row) => ({
        date: String(row?.date ?? ''),
        base: String(row?.base ?? ''),
        quote: String(row?.quote ?? ''),
        rate: Number(row?.rate ?? 0),
      }))
      .filter((row) => row.date && row.base && row.quote && Number.isFinite(row.rate) && row.rate > 0)
  }

  if (payload && typeof payload === 'object') {
    const date = String(payload.date ?? '')
    const base = String(payload.base ?? '')
    const rates = payload.rates ?? {}

    return Object.entries(rates)
      .map(([quote, rate]) => ({
        date,
        base,
        quote,
        rate: Number(rate),
      }))
      .filter((row) => row.date && row.base && row.quote && Number.isFinite(row.rate) && row.rate > 0)
  }

  return []
}

async function main() {
  const { baseCurrency, quoteCurrencies } = await getBaseAndQuoteCurrencies()
  const url = new URL(FRANKFURTER_API_URL)
  url.searchParams.set('base', baseCurrency.currencyId)
  url.searchParams.set('quotes', quoteCurrencies.map((currency) => currency.currencyId).join(','))
  url.searchParams.set('providers', FRANKFURTER_PROVIDER)

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Frankfurter sync failed with status ${response.status}.`)
  }

  const payload = await response.json()
  const normalized = normalizeFrankfurterResponse(payload)

  if (normalized.length === 0) {
    throw new Error('Frankfurter returned no usable exchange rates for the configured currencies.')
  }

  const effectiveDateText = normalized[0].date
  const effectiveDate = new Date(`${effectiveDateText}T00:00:00.000Z`)
  const quotesByCode = new Map(quoteCurrencies.map((currency) => [currency.currencyId.toUpperCase(), currency]))

  const existing = await prisma.exchangeRate.findMany({
    where: {
      baseCurrencyId: baseCurrency.id,
      effectiveDate,
      rateType: RATE_TYPE,
      quoteCurrencyId: { in: quoteCurrencies.map((currency) => currency.id) },
    },
    select: { quoteCurrencyId: true },
  })

  const existingQuoteIds = new Set(existing.map((row) => row.quoteCurrencyId))
  let created = 0
  let updated = 0

  for (const row of normalized) {
    const quoteCurrency = quotesByCode.get(row.quote.toUpperCase())
    if (!quoteCurrency || quoteCurrency.id === baseCurrency.id) continue

    const alreadyExists = existingQuoteIds.has(quoteCurrency.id)

    await prisma.exchangeRate.upsert({
      where: {
        baseCurrencyId_quoteCurrencyId_effectiveDate_rateType: {
          baseCurrencyId: baseCurrency.id,
          quoteCurrencyId: quoteCurrency.id,
          effectiveDate,
          rateType: RATE_TYPE,
        },
      },
      update: {
        rate: row.rate,
        source: `Frankfurter (${FRANKFURTER_PROVIDER})`,
        notes: `Synced from Frankfurter provider=${FRANKFURTER_PROVIDER}`,
        active: true,
      },
      create: {
        baseCurrencyId: baseCurrency.id,
        quoteCurrencyId: quoteCurrency.id,
        effectiveDate,
        rate: row.rate,
        rateType: RATE_TYPE,
        source: `Frankfurter (${FRANKFURTER_PROVIDER})`,
        notes: `Synced from Frankfurter provider=${FRANKFURTER_PROVIDER}`,
        active: true,
      },
    })

    if (alreadyExists) updated += 1
    else created += 1
  }

  const message = `Synced ${created + updated} exchange rates for ${baseCurrency.currencyId} on ${effectiveDateText} via Frankfurter (${FRANKFURTER_PROVIDER}). Created: ${created}, Updated: ${updated}.`
  await logSync('success', message)
  console.log(message)
}

main()
  .catch(async (error) => {
    const message = error instanceof Error
      ? error.cause instanceof Error && error.cause.message
        ? `${error.message}: ${error.cause.message}`
        : error.message
      : 'Exchange rate sync failed.'
    await logSync('error', message)
    console.error(message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
