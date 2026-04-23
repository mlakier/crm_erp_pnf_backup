import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity, logFieldChangeActivities } from '@/lib/activity'
import { generateNextLocationId } from '@/lib/location-number'

function toOptionalString(value: unknown) {
  return String(value ?? '').trim() || null
}

function toBoolean(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return String(value).trim().toLowerCase() === 'true'
}

export async function GET() {
  const data = await prisma.location.findMany({
    include: { parentLocation: true, subsidiary: true, _count: { select: { childLocations: true, employees: true, items: true } } },
    orderBy: { locationId: 'asc' },
  })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const requestedLocationId = String(body?.locationId ?? '').trim().toUpperCase()
    const locationId = requestedLocationId || await generateNextLocationId()
    const code = String(body?.code ?? '').trim().toUpperCase()
    const name = String(body?.name ?? '').trim()
    const address = toOptionalString(body?.address)
    const subsidiaryId = toOptionalString(body?.subsidiaryId)
    const parentLocationId = toOptionalString(body?.parentLocationId)
    const locationType = toOptionalString(body?.locationType)
    const makeInventoryAvailable = toBoolean(body?.makeInventoryAvailable, true)
    const inactive = toBoolean(body?.inactive)

    if (!locationId || !code || !name) {
      return NextResponse.json({ error: 'Location Id, code, and name are required.' }, { status: 400 })
    }

    const created = await prisma.location.create({
      data: {
        locationId,
        code,
        name,
        address,
        subsidiaryId,
        parentLocationId,
        locationType,
        makeInventoryAvailable,
        inactive,
      },
    })
    await logActivity({
      entityType: 'location',
      entityId: created.id,
      action: 'create',
      summary: `Created location ${created.locationId} ${created.name}`,
    })

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to create location.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await request.json()
    const locationId = body?.locationId !== undefined ? String(body.locationId).trim().toUpperCase() : undefined
    const code = body?.code !== undefined ? String(body.code).trim().toUpperCase() : undefined
    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const address = body?.address !== undefined ? toOptionalString(body.address) : undefined
    const subsidiaryId = body?.subsidiaryId !== undefined ? toOptionalString(body.subsidiaryId) : undefined
    const parentLocationId = body?.parentLocationId !== undefined ? toOptionalString(body.parentLocationId) : undefined
    const locationType = body?.locationType !== undefined ? toOptionalString(body.locationType) : undefined
    const makeInventoryAvailable = body?.makeInventoryAvailable !== undefined ? toBoolean(body.makeInventoryAvailable, true) : undefined
    const inactive = body?.inactive !== undefined ? toBoolean(body.inactive) : undefined

    if (parentLocationId === id) {
      return NextResponse.json({ error: 'Parent Location cannot be the same location.' }, { status: 400 })
    }
    if (body?.locationId !== undefined && !locationId) {
      return NextResponse.json({ error: 'Location Id is required.' }, { status: 400 })
    }
    if (body?.code !== undefined && !code) {
      return NextResponse.json({ error: 'Code is required.' }, { status: 400 })
    }
    if (body?.name !== undefined && !name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    }

    const existing = await prisma.location.findUnique({ where: { id } })
    const updated = await prisma.location.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries({ locationId, code, name, address, subsidiaryId, parentLocationId, locationType, makeInventoryAvailable, inactive })
          .filter(([, value]) => value !== undefined)
      ),
    })
    if (existing) {
      const labels: Record<string, string> = {
        locationId: 'Location ID',
        code: 'Code',
        name: 'Name',
        address: 'Address',
        subsidiaryId: 'Subsidiary',
        parentLocationId: 'Parent Location',
        locationType: 'Location Type',
        makeInventoryAvailable: 'Make Inventory Available',
        inactive: 'Inactive',
      }
      const changes = Object.entries({ locationId, code, name, address, subsidiaryId, parentLocationId, locationType, makeInventoryAvailable, inactive })
        .filter(([, value]) => value !== undefined)
        .map(([fieldName, newValue]) => ({
          fieldName: labels[fieldName] ?? fieldName,
          oldValue: String(existing[fieldName as keyof typeof existing] ?? ''),
          newValue: String(newValue ?? ''),
        }))
        .filter((change) => change.oldValue !== change.newValue)
      await logFieldChangeActivities({
        entityType: 'location',
        entityId: updated.id,
        context: `${updated.locationId} ${updated.name}`,
        changes,
      })
    }

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unable to update location.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const existing = await prisma.location.findUnique({ where: { id }, select: { locationId: true, name: true } })
    await prisma.location.delete({ where: { id } })
    await logActivity({
      entityType: 'location',
      entityId: id,
      action: 'delete',
      summary: `Deleted location ${existing?.locationId ?? id} ${existing?.name ?? ''}`.trim(),
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to delete location.' }, { status: 500 })
  }
}
