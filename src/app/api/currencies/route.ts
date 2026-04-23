import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateNextCurrencyId } from '@/lib/currency-number'

export async function GET() {
  const data = await prisma.currency.findMany({ orderBy: { code: 'asc' } })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const requestedCurrencyId = String(body?.currencyId ?? '').trim().toUpperCase()
    const code = String(body?.code ?? '').trim().toUpperCase()
    const name = String(body?.name ?? '').trim()
    const symbol = String(body?.symbol ?? '').trim()
    const decimals = body?.decimals !== undefined ? Number(body.decimals) : 2
    const isBase = String(body?.isBase ?? 'false').trim().toLowerCase() === 'true'
    const inactive = String(body?.inactive ?? 'false').trim().toLowerCase() === 'true'

    if (!code || !name || !symbol) {
      return NextResponse.json({ error: 'Currency ID, code, name, and symbol are required.' }, { status: 400 })
    }
    const currencyId = requestedCurrencyId || await generateNextCurrencyId()

    const created = await prisma.currency.create({
      data: {
        currencyId,
        code,
        name,
        symbol,
        decimals: Number.isFinite(decimals) ? decimals : 2,
        isBase,
        active: !inactive,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to create currency.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await request.json()
    const currencyId = body?.currencyId !== undefined ? String(body.currencyId).trim().toUpperCase() : undefined
    const code = body?.code !== undefined ? String(body.code).trim().toUpperCase() : undefined
    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const symbol = body?.symbol !== undefined ? String(body.symbol).trim() : undefined
    const decimals = body?.decimals !== undefined ? Number(body.decimals) : undefined
    const isBase = body?.isBase !== undefined
      ? String(body.isBase).trim().toLowerCase() === 'true'
      : undefined
    const inactive = body?.inactive !== undefined
      ? String(body.inactive).trim().toLowerCase() === 'true'
      : undefined
    const active = inactive !== undefined
      ? !inactive
      : body?.active !== undefined
        ? String(body.active).trim().toLowerCase() === 'true'
        : undefined
    if (body?.symbol !== undefined && !symbol) {
      return NextResponse.json({ error: 'Symbol is required.' }, { status: 400 })
    }
    if (body?.code !== undefined && !code) {
      return NextResponse.json({ error: 'Code is required.' }, { status: 400 })
    }
    const updated = await prisma.currency.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries({ currencyId, code, name, symbol, decimals, isBase, active }).filter(([, v]) => v !== undefined)
      ),
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unable to update currency.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.currency.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to delete currency.' }, { status: 500 })
  }
}
