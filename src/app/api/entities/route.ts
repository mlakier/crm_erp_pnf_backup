import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateNextEntityCode } from '@/lib/entity-code'

export async function GET() {
  const data = await prisma.entity.findMany({ include: { defaultCurrency: true, parentEntity: true }, orderBy: { subsidiaryId: 'asc' } })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = String(body?.name ?? '').trim()
    const legalName = String(body?.legalName ?? '').trim() || null
    const entityType = String(body?.entityType ?? '').trim() || null
    const country = String(body?.country ?? '').trim() || null
    const address = String(body?.address ?? '').trim() || null
    const taxId = String(body?.taxId ?? '').trim() || null
    const defaultCurrencyId = String(body?.defaultCurrencyId ?? '').trim() || null
    const parentEntityId = String(body?.parentEntityId ?? '').trim() || null
    const inactive = String(body?.inactive ?? 'false').trim().toLowerCase() === 'true'
    const code = await generateNextEntityCode()

    if (!name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    }

    const created = await prisma.entity.create({
      data: {
        subsidiaryId: code,
        name,
        legalName,
        entityType,
        country,
        address,
        taxId,
        defaultCurrencyId,
        parentEntityId,
        active: !inactive,
      },
      include: { defaultCurrency: true, parentEntity: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: `Unable to create entity: ${message}` }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await request.json()
    const code = body?.code !== undefined ? String(body.code).trim().toUpperCase() : (body?.subsidiaryId !== undefined ? String(body.subsidiaryId).trim().toUpperCase() : undefined)
    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const legalName = body?.legalName !== undefined ? (String(body.legalName).trim() || null) : undefined
    const entityType = body?.entityType !== undefined ? (String(body.entityType).trim() || null) : undefined
    const country = body?.country !== undefined ? (String(body.country).trim() || null) : undefined
    const address = body?.address !== undefined ? (String(body.address).trim() || null) : undefined
    const defaultCurrencyId = body?.defaultCurrencyId !== undefined ? (String(body.defaultCurrencyId).trim() || null) : undefined
    const parentEntityId = body?.parentEntityId !== undefined ? (String(body.parentEntityId).trim() || null) : undefined
    const taxId = body?.taxId !== undefined ? (String(body.taxId).trim() || null) : undefined
    const registrationNumber = body?.registrationNumber !== undefined ? (String(body.registrationNumber).trim() || null) : undefined
    const inactive = body?.inactive !== undefined
      ? String(body.inactive).trim().toLowerCase() === 'true'
      : undefined
    const active = inactive !== undefined
      ? !inactive
      : body?.active !== undefined
        ? String(body.active).trim().toLowerCase() === 'true'
        : undefined

    if (parentEntityId !== undefined && parentEntityId === id) {
      return NextResponse.json({ error: 'A subsidiary cannot be its own parent.' }, { status: 400 })
    }

    const updated = await prisma.entity.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries({ subsidiaryId: code, name, legalName, entityType, country, address, defaultCurrencyId, parentEntityId, taxId, registrationNumber, active }).filter(([, v]) => v !== undefined)
      ),
      include: { defaultCurrency: true, parentEntity: true },
    })
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: `Unable to update entity: ${message}` }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.entity.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: `Unable to delete entity: ${message}` }, { status: 500 })
  }
}
