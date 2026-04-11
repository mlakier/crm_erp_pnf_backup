import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const data = await prisma.item.findMany({
    include: { currency: true, entity: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = String(body?.name ?? '').trim()
    const itemNumber = String(body?.itemNumber ?? '').trim() || null
    const sku = String(body?.sku ?? '').trim() || null
    const itemType = String(body?.itemType ?? 'service').trim() || 'service'
    const uom = String(body?.uom ?? '').trim() || null
    const listPrice = Number(body?.listPrice ?? 0)
    const currencyId = String(body?.currencyId ?? '').trim() || null
    const entityId = String(body?.entityId ?? '').trim() || null

    if (!name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    }

    const created = await prisma.item.create({
      data: {
        name,
        itemNumber,
        sku,
        itemType,
        uom,
        listPrice: Number.isFinite(listPrice) ? listPrice : 0,
        currencyId,
        entityId,
        active: true,
      },
      include: { currency: true, entity: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to create item.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await request.json()
    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const itemNumber = body?.itemNumber !== undefined ? (String(body.itemNumber).trim() || null) : undefined
    const sku = body?.sku !== undefined ? (String(body.sku).trim() || null) : undefined
    const itemType = body?.itemType !== undefined ? String(body.itemType).trim() : undefined
    const uom = body?.uom !== undefined ? (String(body.uom).trim() || null) : undefined
    const listPrice = body?.listPrice !== undefined ? Number(body.listPrice) : undefined
    const description = body?.description !== undefined ? (String(body.description).trim() || null) : undefined
    const currencyId = body?.currencyId !== undefined ? (String(body.currencyId).trim() || null) : undefined
    const entityId = body?.entityId !== undefined ? (String(body.entityId).trim() || null) : undefined
    const active = body?.active !== undefined
      ? String(body.active).trim().toLowerCase() === 'true'
      : undefined
    const updated = await prisma.item.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries({ name, itemNumber, sku, itemType, uom, listPrice, description, currencyId, entityId, active }).filter(([, v]) => v !== undefined)
      ),
      include: { currency: true, entity: true },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unable to update item.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.item.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to delete item.' }, { status: 500 })
  }
}
