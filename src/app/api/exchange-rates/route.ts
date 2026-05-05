import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getExchangeRateTypeLabel,
  isCanonicalExchangeRateType,
  normalizeExchangeRateType,
} from '@/lib/exchange-rate-types'

type ExchangeRatePayload = {
  baseCurrencyId?: unknown
  quoteCurrencyId?: unknown
  effectiveDate?: unknown
  rateType?: unknown
  source?: unknown
  notes?: unknown
  rate?: unknown
  active?: unknown
}

function parseBoolean(value: unknown) {
  return String(value ?? 'false').trim().toLowerCase() === 'true'
}

function normalizePayload(body: ExchangeRatePayload) {
  const baseCurrencyId = String(body?.baseCurrencyId ?? '').trim()
  const quoteCurrencyId = String(body?.quoteCurrencyId ?? '').trim()
  const effectiveDateRaw = String(body?.effectiveDate ?? '').trim()
  const rawRateType = String(body?.rateType ?? 'spot').trim()
  const rateType = normalizeExchangeRateType(rawRateType)
  const source = String(body?.source ?? '').trim() || null
  const notes = String(body?.notes ?? '').trim() || null
  const rate = Number(body?.rate)
  const active = body?.active !== undefined ? parseBoolean(body.active) : true

  return {
    baseCurrencyId,
    quoteCurrencyId,
    effectiveDateRaw,
    rawRateType,
    rateType,
    source,
    notes,
    rate,
    active,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const row = await prisma.exchangeRate.findUnique({
      where: { id },
      include: { baseCurrency: true, quoteCurrency: true },
    })

    return row
      ? NextResponse.json(row)
      : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const rows = await prisma.exchangeRate.findMany({
    include: { baseCurrency: true, quoteCurrency: true },
    orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(rows)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = normalizePayload(body)

    if (!payload.baseCurrencyId || !payload.quoteCurrencyId || !payload.effectiveDateRaw) {
      return NextResponse.json({ error: 'Base currency, quote currency, and effective date are required.' }, { status: 400 })
    }

    if (payload.baseCurrencyId === payload.quoteCurrencyId) {
      return NextResponse.json({ error: 'Base currency and quote currency must be different.' }, { status: 400 })
    }

    if (!Number.isFinite(payload.rate) || payload.rate <= 0) {
      return NextResponse.json({ error: 'Rate must be greater than 0.' }, { status: 400 })
    }

    if (!isCanonicalExchangeRateType(payload.rawRateType)) {
      return NextResponse.json({
        error: 'Rate type must be one of Spot, Average, Closing, or Historical.',
      }, { status: 400 })
    }

    const created = await prisma.exchangeRate.create({
      data: {
        baseCurrencyId: payload.baseCurrencyId,
        quoteCurrencyId: payload.quoteCurrencyId,
        effectiveDate: new Date(payload.effectiveDateRaw),
        rate: payload.rate,
        rateType: getExchangeRateTypeLabel(payload.rateType),
        source: payload.source,
        notes: payload.notes,
        active: payload.active,
      },
      include: { baseCurrency: true, quoteCurrency: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to create exchange rate.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const body = await request.json()
    const payload = normalizePayload(body)

    if (payload.baseCurrencyId && payload.quoteCurrencyId && payload.baseCurrencyId === payload.quoteCurrencyId) {
      return NextResponse.json({ error: 'Base currency and quote currency must be different.' }, { status: 400 })
    }

    if (body?.rate !== undefined && (!Number.isFinite(payload.rate) || payload.rate <= 0)) {
      return NextResponse.json({ error: 'Rate must be greater than 0.' }, { status: 400 })
    }

    if (body?.rateType !== undefined && !isCanonicalExchangeRateType(payload.rawRateType)) {
      return NextResponse.json({
        error: 'Rate type must be one of Spot, Average, Closing, or Historical.',
      }, { status: 400 })
    }

    const updated = await prisma.exchangeRate.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries({
          baseCurrencyId: body?.baseCurrencyId !== undefined ? payload.baseCurrencyId : undefined,
          quoteCurrencyId: body?.quoteCurrencyId !== undefined ? payload.quoteCurrencyId : undefined,
          effectiveDate: body?.effectiveDate !== undefined ? new Date(payload.effectiveDateRaw) : undefined,
          rate: body?.rate !== undefined ? payload.rate : undefined,
          rateType: body?.rateType !== undefined ? getExchangeRateTypeLabel(payload.rateType) : undefined,
          source: body?.source !== undefined ? payload.source : undefined,
          notes: body?.notes !== undefined ? payload.notes : undefined,
          active: body?.active !== undefined ? payload.active : undefined,
        }).filter(([, value]) => value !== undefined)
      ),
      include: { baseCurrency: true, quoteCurrency: true },
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unable to update exchange rate.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    await prisma.exchangeRate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to delete exchange rate.' }, { status: 500 })
  }
}
