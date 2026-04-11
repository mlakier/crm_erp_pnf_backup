import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const data = await prisma.currency.findMany({ orderBy: { code: 'asc' } })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const code = String(body?.code ?? '').trim().toUpperCase()
    const name = String(body?.name ?? '').trim()
    const symbol = String(body?.symbol ?? '').trim() || null

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required.' }, { status: 400 })
    }

    const created = await prisma.currency.create({
      data: {
        code,
        name,
        symbol,
        decimals: 2,
        active: true,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to create currency.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await request.json()
    const code = body?.code !== undefined ? String(body.code).trim().toUpperCase() : undefined
    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const symbol = body?.symbol !== undefined ? (String(body.symbol).trim() || null) : undefined
    const decimals = body?.decimals !== undefined ? Number(body.decimals) : undefined
    const isBase = body?.isBase !== undefined
      ? String(body.isBase).trim().toLowerCase() === 'true'
      : undefined
    const active = body?.active !== undefined
      ? String(body.active).trim().toLowerCase() === 'true'
      : undefined
    const updated = await prisma.currency.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries({ code, name, symbol, decimals, isBase, active }).filter(([, v]) => v !== undefined)
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
