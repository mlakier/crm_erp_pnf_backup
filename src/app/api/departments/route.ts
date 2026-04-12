import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const data = await prisma.department.findMany({
    include: { entity: true },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const code = String(body?.code ?? '').trim().toUpperCase()
    const name = String(body?.name ?? '').trim()
    const description = String(body?.description ?? '').trim() || null
    const division = String(body?.division ?? '').trim() || null
    const entityId = String(body?.entityId ?? '').trim() || null
    const managerId = String(body?.managerId ?? '').trim() || null
    const inactive = String(body?.inactive ?? 'false').trim().toLowerCase() === 'true'

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required.' }, { status: 400 })
    }

    const created = await prisma.department.create({
      data: {
        code,
        name,
        description,
        division,
        entityId,
        managerId,
        active: !inactive,
      },
      include: { entity: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to create department.' }, { status: 500 })
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
    const description = body?.description !== undefined ? (String(body.description).trim() || null) : undefined
    const division = body?.division !== undefined ? (String(body.division).trim() || null) : undefined
    const entityId = body?.entityId !== undefined ? (String(body.entityId).trim() || null) : undefined
    const managerId = body?.managerId !== undefined ? (String(body.managerId).trim() || null) : undefined
    const inactive = body?.inactive !== undefined
      ? String(body.inactive).trim().toLowerCase() === 'true'
      : undefined
    const active = inactive !== undefined
      ? !inactive
      : body?.active !== undefined
        ? String(body.active).trim().toLowerCase() === 'true'
        : undefined

    const updated = await prisma.department.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries({ code, name, description, division, entityId, managerId, active }).filter(([, v]) => v !== undefined)
      ),
      include: { entity: true },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unable to update department.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.department.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to delete department.' }, { status: 500 })
  }
}
