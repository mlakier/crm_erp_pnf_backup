require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const FRANKFURTER_API_URL = 'https://api.frankfurter.dev/v2/rates'
const FRANKFURTER_PROVIDER = 'ECB'
const INTEGRATION_KEY = 'frankfurter-exchange-rates'
const RATE_TYPE = 'spot'
const MAX_BACKFILL_DAYS = 366

function parseCliArgs(argv) {
  const options = {
    startDate: null,
    endDate: null,
    triggerType: 'manual',
  }

  for (const arg of argv) {
    if (arg.startsWith('--start=')) {
      options.startDate = arg.slice('--start='.length).trim() || null
    } else if (arg.startsWith('--end=')) {
      options.endDate = arg.slice('--end='.length).trim() || null
    } else if (arg === '--scheduled') {
      options.triggerType = 'scheduled'
    } else if (arg.startsWith('--trigger=')) {
      const value = arg.slice('--trigger='.length).trim().toLowerCase()
      if (value === 'scheduled') options.triggerType = 'scheduled'
      else if (value === 'api') options.triggerType = 'api'
      else options.triggerType = 'manual'
    }
  }

  return options
}

function parseDateInput(value) {
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

function formatDateUtc(date) {
  return date.toISOString().slice(0, 10)
}

function enumerateDateRange(start, end) {
  if (start.getTime() > end.getTime()) {
    throw new Error('Start date cannot be after end date.')
  }

  const dates = []
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

async function logSync(status, action, message) {
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
    // Do not block on log writes.
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
    || activeCurrencies.find((currency) => currency.code === 'USD')
    || activeCurrencies[0]

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

async function fetchRatesForDate(baseCode, quoteCodes, requestedDate) {
  const url = new URL(FRANKFURTER_API_URL)
  url.searchParams.set('base', baseCode)
  url.searchParams.set('quotes', quoteCodes.join(','))
  url.searchParams.set('providers', FRANKFURTER_PROVIDER)
  if (requestedDate) {
    url.searchParams.set('date', requestedDate)
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
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

async function upsertRatesForRows(baseCurrencyId, quoteCurrencyIdsByCode, rows) {
  const effectiveDateText = rows[0]?.date
  if (!effectiveDateText) {
    throw new Error('Exchange rate response did not include an effective date.')
  }

  const effectiveDate = new Date(`${effectiveDateText}T00:00:00.000Z`)
  const quoteCurrencyIds = Array.from(new Set(rows
    .map((row) => quoteCurrencyIdsByCode.get(row.quote.toUpperCase()))
    .filter(Boolean)))

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

async function syncExchangeRates(options) {
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
      asOfDate: end?.date ?? null,
      message: mode === 'historical'
        ? `Historical FX backfill requested for ${start?.text} through ${end?.text}.`
        : 'Latest FX sync requested.',
    },
  })

  let created = 0
  let updated = 0
  let processedDates = 0
  let failedDates = 0
  let lastEffectiveDate = null

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
      asOfDate: lastEffectiveDate ? new Date(`${lastEffectiveDate}T00:00:00.000Z`) : (end?.date ?? null),
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

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  const result = await syncExchangeRates(options)
  console.log(
    result.mode === 'historical'
      ? `Backfill run ${result.runNumber}: ${result.processedDates} dates processed, ${result.failedDates} failed, ${result.total} rates upserted.`
      : `Latest run ${result.runNumber}: ${result.total} rates upserted for ${result.baseCurrency}${result.effectiveDate ? ` on ${result.effectiveDate}` : ''}.`,
  )
}

const cliOptions = parseCliArgs(process.argv.slice(2))

main()
  .catch(async (error) => {
    const message = error instanceof Error
      ? error.cause instanceof Error && error.cause.message
        ? `${error.message}: ${error.cause.message}`
        : error.message
      : 'Exchange rate sync failed.'
    await logSync('error', cliOptions.startDate && cliOptions.endDate ? 'sync-history' : 'sync-latest', message)
    console.error(message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
