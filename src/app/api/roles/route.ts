import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const data = await prisma.role.findMany({ orderBy: { roleId: 'asc' } })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = String(body?.name ?? '').trim()
    const description = body?.description !== undefined ? String(body.description).trim() || null : null
    const inactive = String(body?.inactive ?? 'false').trim().toLowerCase() === 'true'

    if (!name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    }

    // Auto-generate roleId
    const last = await prisma.role.findFirst({ orderBy: { roleId: 'desc' } })
    const nextNum = last?.roleId ? parseInt(last.roleId.replace(/\D/g, ''), 10) + 1 : 1
    const roleId = `ROLE-${String(nextNum).padStart(4, '0')}`

    const created = await prisma.role.create({
      data: { roleId, name, description, active: !inactive },
    })

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to create role.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await request.json()
    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const description = body?.description !== undefined ? (String(body.description).trim() || null) : undefined
    const inactive = body?.inactive !== undefined
      ? String(body.inactive).trim().toLowerCase() === 'true'
      : undefined
    const active = inactive !== undefined ? !inactive : undefined

    const updated = await prisma.role.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries({ name, description, active }).filter(([, v]) => v !== undefined)
      ),
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unable to update role.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.role.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to delete role.' }, { status: 500 })
  }
}
