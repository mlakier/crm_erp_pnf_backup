import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const FRANKFURTER_API_URL = 'https://api.frankfurter.dev/v2/rates'
const FRANKFURTER_PROVIDER = 'ECB'
const INTEGRATION_KEY = 'frankfurter-exchange-rates'
const RATE_TYPE = 'spot'

type FrankfurterArrayRow = {
  date?: string
  base?: string
  quote?: string
  rate?: number
}

type FrankfurterObjectResponse = {
  date?: string
  base?: string
  rates?: Record<string, number>
}

function getSyncToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }

  return request.headers.get('x-sync-token')?.trim() ?? ''
}

function ensureSchedulerAuthorized(request: NextRequest) {
  const expected = process.env.EXCHANGE_RATE_SYNC_TOKEN?.trim()
  if (!expected) return true
  return getSyncToken(request) === expected
}

async function getBaseAndQuoteCurrencies() {
  const activeCurrencies = await prisma.currency.findMany({
    where: { active: true },
    orderBy: [{ isBase: 'desc' }, { code: 'asc' }],
  })

  if (activeCurrencies.length < 2) {
    throw new Error('At least two active currencies are required before syncing exchange rates.')
  }

  const baseCurrency =
    activeCurrencies.find((currency) => currency.isBase)
    ?? activeCurrencies.find((currency) => currency.code === 'USD')
    ?? activeCurrencies[0]

  const quoteCurrencies = activeCurrencies.filter((currency) => currency.id !== baseCurrency.id)

  if (quoteCurrencies.length === 0) {
    throw new Error('No quote currencies available for exchange rate sync.')
  }

  return { baseCurrency, quoteCurrencies }
}

function normalizeFrankfurterResponse(payload: unknown): Array<{ date: string; base: string; quote: string; rate: number }> {
  if (Array.isArray(payload)) {
    return payload
      .filter((row): row is FrankfurterArrayRow => Boolean(row && typeof row === 'object'))
      .map((row) => ({
        date: String(row.date ?? ''),
        base: String(row.base ?? ''),
        quote: String(row.quote ?? ''),
        rate: Number(row.rate ?? 0),
      }))
      .filter((row) => row.date && row.base && row.quote && Number.isFinite(row.rate) && row.rate > 0)
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as FrankfurterObjectResponse
    const date = String(objectPayload.date ?? '')
    const base = String(objectPayload.base ?? '')
    const rates = objectPayload.rates ?? {}

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

async function logSync(status: string, message: string) {
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
    // Logging should not block sync completion.
  }
}

async function syncLatestExchangeRates() {
  const { baseCurrency, quoteCurrencies } = await getBaseAndQuoteCurrencies()
  const url = new URL(FRANKFURTER_API_URL)
  url.searchParams.set('base', baseCurrency.code)
  url.searchParams.set('quotes', quoteCurrencies.map((currency) => currency.code).join(','))
  url.searchParams.set('providers', FRANKFURTER_PROVIDER)

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Frankfurter sync failed with status ${response.status}.`)
  }

  const payload = await response.json()
  const normalized = normalizeFrankfurterResponse(payload)

  if (normalized.length === 0) {
    throw new Error('Frankfurter returned no usable exchange rates for the configured currencies.')
  }

  const effectiveDateText = normalized[0]?.date
  if (!effectiveDateText) {
    throw new Error('Frankfurter response did not include an effective date.')
  }

  const effectiveDate = new Date(`${effectiveDateText}T00:00:00.000Z`)
  const quotesByCode = new Map(quoteCurrencies.map((currency) => [currency.code.toUpperCase(), currency]))
  const existing = await prisma.exchangeRate.findMany({
    where: {
      baseCurrencyId: baseCurrency.id,
      effectiveDate,
      rateType: RATE_TYPE,
      quoteCurrencyId: { in: quoteCurrencies.map((currency) => currency.id) },
    },
    select: { id: true, quoteCurrencyId: true },
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

  const result = {
    provider: FRANKFURTER_PROVIDER,
    baseCurrency: baseCurrency.code,
    effectiveDate: effectiveDateText,
    created,
    updated,
    total: created + updated,
  }

  await logSync(
    'success',
    `Synced ${result.total} exchange rates for ${result.baseCurrency} on ${result.effectiveDate} via Frankfurter (${FRANKFURTER_PROVIDER}). Created: ${created}, Updated: ${updated}.`
  )

  return result
}

export async function GET(request: NextRequest) {
  if (!ensureSchedulerAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncLatestExchangeRates()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Exchange rate sync failed.'
    await logSync('error', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const result = await syncLatestExchangeRates()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Exchange rate sync failed.'
    await logSync('error', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
