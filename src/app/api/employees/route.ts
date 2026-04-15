import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const data = await prisma.employee.findMany({
    include: { entity: true, departmentRef: true, manager: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const firstName = String(body?.firstName ?? '').trim()
    const lastName = String(body?.lastName ?? '').trim()
    const email = String(body?.email ?? '').trim() || null
    const title = String(body?.title ?? '').trim() || null
    const departmentId = String(body?.departmentId ?? '').trim() || null
    const entityId = String(body?.entityId ?? '').trim() || null
    const inactive = String(body?.inactive ?? 'false').trim().toLowerCase() === 'true'

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 })
    }

    const departmentRef = departmentId
      ? await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } })
      : null

    const created = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        email,
        title,
        departmentId,
        entityId,
        active: !inactive,
      },
      include: { entity: true, departmentRef: true, manager: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to create employee.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await request.json()
    const firstName = body?.firstName !== undefined ? String(body.firstName).trim() : undefined
    const lastName = body?.lastName !== undefined ? String(body.lastName).trim() : undefined
    const email = body?.email !== undefined ? (String(body.email).trim() || null) : undefined
    const title = body?.title !== undefined ? (String(body.title).trim() || null) : undefined
    const phone = body?.phone !== undefined ? (String(body.phone).trim() || null) : undefined
    const department = body?.department !== undefined ? (String(body.department).trim() || null) : undefined
    const departmentId = body?.departmentId !== undefined ? (String(body.departmentId).trim() || null) : undefined
    const entityId = body?.entityId !== undefined ? (String(body.entityId).trim() || null) : undefined
    const managerId = body?.managerId !== undefined ? (String(body.managerId).trim() || null) : undefined
    const hireDate = body?.hireDate !== undefined ? (body.hireDate ? new Date(body.hireDate) : null) : undefined
    const terminationDate = body?.terminationDate !== undefined ? (body.terminationDate ? new Date(body.terminationDate) : null) : undefined
    const inactive = body?.inactive !== undefined
      ? String(body.inactive).trim().toLowerCase() === 'true'
      : undefined
    const active = inactive !== undefined
      ? !inactive
      : body?.active !== undefined
        ? String(body.active).trim().toLowerCase() === 'true'
        : undefined
    const nextDepartment = departmentId !== undefined
      ? (departmentId
          ? await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } })
          : null)
      : undefined

    const updated = await prisma.employee.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries({
          firstName,
          lastName,
          email,
          title,
          phone,
          department: nextDepartment !== undefined ? nextDepartment?.name ?? null : department,
          departmentId,
          entityId,
          managerId,
          hireDate,
          terminationDate,
          active,
        }).filter(([, v]) => v !== undefined)
      ),
      include: { entity: true, departmentRef: true, manager: true },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unable to update employee.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.employee.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to delete employee.' }, { status: 500 })
  }
}
