import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const FRANKFURTER_API_URL = 'https://api.frankfurter.dev/v2/rates'
const FRANKFURTER_PROVIDER = 'ECB'
const INTEGRATION_KEY = 'frankfurter-exchange-rates'
const RATE_TYPE = 'spot'
const MAX_BACKFILL_DAYS = 366

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

type ExchangeRateSyncOptions = {
  startDate?: string | null
  endDate?: string | null
  triggerType: 'manual' | 'scheduled' | 'api'
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

function parseDateInput(value: string | null | undefined) {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`Invalid date "${text}". Use YYYY-MM-DD.`)
  }

  const date = new Date(`${text}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date "${text}".`)
  }

  return { text, date }
}

function formatDateUtc(date: Date) {
  return date.toISOString().slice(0, 10)
}

function enumerateDateRange(start: Date, end: Date) {
  if (start.getTime() > end.getTime()) {
    throw new Error('Start date cannot be after end date.')
  }

  const dates: string[] = []
  const cursor = new Date(start.getTime())

  while (cursor.getTime() <= end.getTime()) {
    dates.push(formatDateUtc(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    if (dates.length > MAX_BACKFILL_DAYS) {
      throw new Error(`Historical FX backfill is limited to ${MAX_BACKFILL_DAYS} days per run.`)
    }
  }

  return dates
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

async function logSync(status: string, action: string, message: string) {
  try {
    await prisma.integrationLog.create({
      data: {
        integration: INTEGRATION_KEY,
        action,
        status,
        message,
      },
    })
  } catch {
    // Logging should not block sync completion.
  }
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

function generateRunNumber() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `FX-${stamp}-${suffix}`
}

async function fetchRatesForDate(baseCode: string, quoteCodes: string[], requestedDate: string | null) {
  const url = new URL(FRANKFURTER_API_URL)
  url.searchParams.set('base', baseCode)
  url.searchParams.set('quotes', quoteCodes.join(','))
  url.searchParams.set('providers', FRANKFURTER_PROVIDER)
  if (requestedDate) {
    url.searchParams.set('date', requestedDate)
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Frankfurter sync failed with status ${response.status}${requestedDate ? ` for ${requestedDate}` : ''}.`)
  }

  const payload = await response.json()
  const normalized = normalizeFrankfurterResponse(payload)

  if (normalized.length === 0) {
    throw new Error(`Frankfurter returned no usable exchange rates${requestedDate ? ` for ${requestedDate}` : ''}.`)
  }

  return normalized
}

async function upsertRatesForRows(baseCurrencyId: string, quoteCurrencyIdsByCode: Map<string, string>, rows: Array<{ date: string; base: string; quote: string; rate: number }>) {
  const effectiveDateText = rows[0]?.date
  if (!effectiveDateText) {
    throw new Error('Exchange rate response did not include an effective date.')
  }

  const effectiveDate = new Date(`${effectiveDateText}T00:00:00.000Z`)
  const quoteCurrencyIds = Array.from(new Set(rows.map((row) => quoteCurrencyIdsByCode.get(row.quote.toUpperCase())).filter((value): value is string => Boolean(value))))
  const existing = await prisma.exchangeRate.findMany({
    where: {
      baseCurrencyId,
      effectiveDate,
      rateType: RATE_TYPE,
      quoteCurrencyId: { in: quoteCurrencyIds },
    },
    select: { quoteCurrencyId: true },
  })

  const existingQuoteIds = new Set(existing.map((row) => row.quoteCurrencyId))
  let created = 0
  let updated = 0

  for (const row of rows) {
    const quoteCurrencyId = quoteCurrencyIdsByCode.get(row.quote.toUpperCase())
    if (!quoteCurrencyId || quoteCurrencyId === baseCurrencyId) continue

    const alreadyExists = existingQuoteIds.has(quoteCurrencyId)

    await prisma.exchangeRate.upsert({
      where: {
        baseCurrencyId_quoteCurrencyId_effectiveDate_rateType: {
          baseCurrencyId,
          quoteCurrencyId,
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
        baseCurrencyId,
        quoteCurrencyId,
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

  return {
    effectiveDate: effectiveDateText,
    created,
    updated,
    total: created + updated,
  }
}

async function syncExchangeRates(options: ExchangeRateSyncOptions) {
  const { baseCurrency, quoteCurrencies } = await getBaseAndQuoteCurrencies()
  const start = parseDateInput(options.startDate)
  const end = parseDateInput(options.endDate)

  if ((start && !end) || (!start && end)) {
    throw new Error('Provide both start date and end date for historical FX backfill.')
  }

  const requestedDates = start && end ? enumerateDateRange(start.date, end.date) : [null]
  const mode = start && end ? 'historical' : 'latest'
  const action = mode === 'historical' ? 'sync-history' : 'sync-latest'
  const quoteCodes = quoteCurrencies.map((currency) => currency.code)
  const quoteCurrencyIdsByCode = new Map(quoteCurrencies.map((currency) => [currency.code.toUpperCase(), currency.id]))

  const runHeader = await prisma.runHeader.create({
    data: {
      runNumber: generateRunNumber(),
      runType: 'fx_ingestion',
      triggerType: options.triggerType,
      scopeType: mode === 'historical' ? 'date_range' : 'latest',
      scopeJson: JSON.stringify({
        provider: 'frankfurter',
        providerSource: FRANKFURTER_PROVIDER,
        baseCurrency: baseCurrency.code,
        quoteCurrencies: quoteCodes,
        startDate: start?.text ?? null,
        endDate: end?.text ?? null,
      }),
      status: 'running',
      requestedAt: new Date(),
      startedAt: new Date(),
      asOfDate: end?.date ?? undefined,
      message: mode === 'historical'
        ? `Historical FX backfill requested for ${start?.text} through ${end?.text}.`
        : 'Latest FX sync requested.',
    },
  })

  let created = 0
  let updated = 0
  let processedDates = 0
  let failedDates = 0
  let lastEffectiveDate: string | null = null

  for (const [index, requestedDate] of requestedDates.entries()) {
    const runItem = await prisma.runItem.create({
      data: {
        runHeaderId: runHeader.id,
        itemNumber: index + 1,
        itemType: 'exchange_rate_date',
        status: 'running',
        requestPayloadJson: JSON.stringify({
          requestedDate,
          baseCurrency: baseCurrency.code,
          quoteCurrencies: quoteCodes,
        }),
        startedAt: new Date(),
      },
    })

    try {
      const rates = await fetchRatesForDate(baseCurrency.code, quoteCodes, requestedDate)
      const result = await upsertRatesForRows(baseCurrency.id, quoteCurrencyIdsByCode, rates)
      created += result.created
      updated += result.updated
      processedDates += 1
      lastEffectiveDate = result.effectiveDate

      await prisma.runItem.update({
        where: { id: runItem.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          resultPayloadJson: JSON.stringify(result),
          message: `Synced ${result.total} rates for ${result.effectiveDate}.`,
        },
      })
    } catch (error) {
      failedDates += 1
      const message = error instanceof Error ? error.message : 'FX date sync failed.'

      await prisma.runItem.update({
        where: { id: runItem.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          message,
        },
      })

      await prisma.runException.create({
        data: {
          runHeaderId: runHeader.id,
          runItemId: runItem.id,
          severity: 'error',
          exceptionType: 'fx_provider_error',
          status: 'open',
          sourceRecordType: 'exchange_rate_date',
          sourceRecordId: requestedDate ?? 'latest',
          message,
          detailsJson: JSON.stringify({
            requestedDate,
            provider: 'frankfurter',
            baseCurrency: baseCurrency.code,
          }),
        },
      })
    }
  }

  const status =
    failedDates === 0
      ? 'completed'
      : processedDates > 0
      ? 'completed_with_exceptions'
      : 'failed'

  const total = created + updated
  const message =
    mode === 'historical'
      ? `Backfilled ${processedDates} FX date${processedDates === 1 ? '' : 's'} for ${baseCurrency.code}. Created: ${created}, Updated: ${updated}, Failed dates: ${failedDates}.`
      : `Synced ${total} exchange rates for ${baseCurrency.code}${lastEffectiveDate ? ` on ${lastEffectiveDate}` : ''}. Created: ${created}, Updated: ${updated}.`

  await prisma.runHeader.update({
    where: { id: runHeader.id },
    data: {
      status,
      completedAt: new Date(),
      message,
      summaryJson: JSON.stringify({
        provider: FRANKFURTER_PROVIDER,
        mode,
        baseCurrency: baseCurrency.code,
        quoteCurrencyCount: quoteCodes.length,
        startDate: start?.text ?? null,
        endDate: end?.text ?? null,
        processedDates,
        failedDates,
        created,
        updated,
        total,
        lastEffectiveDate,
      }),
      asOfDate: lastEffectiveDate ? new Date(`${lastEffectiveDate}T00:00:00.000Z`) : end?.date ?? undefined,
    },
  })

  await logSync(status === 'failed' ? 'error' : 'success', action, message)

  return {
    runNumber: runHeader.runNumber,
    provider: FRANKFURTER_PROVIDER,
    mode,
    status,
    baseCurrency: baseCurrency.code,
    startDate: start?.text ?? null,
    endDate: end?.text ?? null,
    effectiveDate: lastEffectiveDate,
    processedDates,
    failedDates,
    created,
    updated,
    total,
  }
}

function parseRequestOptions(request: NextRequest, body?: Record<string, unknown>) {
  const { searchParams } = new URL(request.url)
  const startDate = String(body?.startDate ?? searchParams.get('startDate') ?? '').trim() || null
  const endDate = String(body?.endDate ?? searchParams.get('endDate') ?? '').trim() || null
  const triggerType = (String(body?.triggerType ?? searchParams.get('triggerType') ?? '').trim().toLowerCase() === 'scheduled'
    ? 'scheduled'
    : 'manual') as 'manual' | 'scheduled'

  return { startDate, endDate, triggerType: request.method === 'GET' ? 'scheduled' : triggerType }
}

export async function GET(request: NextRequest) {
  if (!ensureSchedulerAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const options = parseRequestOptions(request)
  try {
    const result = await syncExchangeRates(options)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Exchange rate sync failed.'
    await logSync('error', options.startDate && options.endDate ? 'sync-history' : 'sync-latest', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const options = parseRequestOptions(request, body)
  try {
    const result = await syncExchangeRates(options)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Exchange rate sync failed.'
    await logSync('error', options.startDate && options.endDate ? 'sync-history' : 'sync-latest', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
