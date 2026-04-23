import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateNextDepartmentId } from '@/lib/department-id'

function normalizeString(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value == null) return fallback
  const normalized = String(value).trim().toLowerCase()
  return normalized === 'true' || normalized === 'yes' || normalized === '1'
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return []
}

export async function GET() {
  const data = await prisma.department.findMany({
    include: {
      departmentSubsidiaries: {
        include: { subsidiary: true },
        orderBy: { subsidiary: { subsidiaryId: 'asc' } },
      },
      manager: true,
      approver: true,
    },
    orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const departmentId = String(body?.departmentId ?? '').trim().toUpperCase() || await generateNextDepartmentId()
    const departmentNumber = normalizeString(body?.departmentNumber)
    const name = String(body?.name ?? '').trim()
    const description = normalizeString(body?.description)
    const division = normalizeString(body?.division)
    const subsidiaryIds = normalizeStringArray(body?.subsidiaryIds)
    const includeChildren = normalizeBoolean(body?.includeChildren, false)
    const planningCategory = normalizeString(body?.planningCategory)
    const managerEmployeeId = normalizeString(body?.managerEmployeeId)
    const approverEmployeeId = normalizeString(body?.approverEmployeeId)
    const inactive = normalizeBoolean(body?.inactive, false)

    if (!departmentId || !name) {
      return NextResponse.json({ error: 'Department Id and name are required.' }, { status: 400 })
    }

    const created = await prisma.department.create({
      data: {
        departmentId,
        departmentNumber,
        name,
        description,
        division,
        includeChildren,
        planningCategory,
        managerEmployeeId,
        approverEmployeeId,
        active: !inactive,
        ...(subsidiaryIds.length > 0
          ? {
              departmentSubsidiaries: {
                create: subsidiaryIds.map((subsidiaryId) => ({ subsidiaryId })),
              },
            }
          : {}),
      },
      include: {
        departmentSubsidiaries: { include: { subsidiary: true } },
        manager: true,
        approver: true,
      },
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

    const departmentId = body?.departmentId !== undefined ? String(body.departmentId).trim().toUpperCase() : undefined
    const departmentNumber = body?.departmentNumber !== undefined ? normalizeString(body.departmentNumber) : undefined
    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const description = body?.description !== undefined ? normalizeString(body.description) : undefined
    const division = body?.division !== undefined ? normalizeString(body.division) : undefined
    const subsidiaryIds = body?.subsidiaryIds !== undefined ? normalizeStringArray(body.subsidiaryIds) : undefined
    const includeChildren = body?.includeChildren !== undefined ? normalizeBoolean(body.includeChildren) : undefined
    const planningCategory = body?.planningCategory !== undefined ? normalizeString(body.planningCategory) : undefined
    const managerEmployeeId = body?.managerEmployeeId !== undefined ? normalizeString(body.managerEmployeeId) : undefined
    const approverEmployeeId = body?.approverEmployeeId !== undefined ? normalizeString(body.approverEmployeeId) : undefined
    const inactive = body?.inactive !== undefined ? normalizeBoolean(body.inactive) : undefined
    const active = inactive !== undefined ? !inactive : body?.active !== undefined ? normalizeBoolean(body.active) : undefined

    const updated = await prisma.department.update({
      where: { id },
      data: {
        ...Object.fromEntries(
          Object.entries({
            departmentId,
            departmentNumber,
            name,
            description,
            division,
            includeChildren,
            planningCategory,
            managerEmployeeId,
            approverEmployeeId,
            active,
          }).filter(([, value]) => value !== undefined),
        ),
        ...(subsidiaryIds !== undefined
          ? {
              departmentSubsidiaries: {
                deleteMany: {},
                create: subsidiaryIds.map((subsidiaryId) => ({ subsidiaryId })),
              },
            }
          : {}),
      },
      include: {
        departmentSubsidiaries: { include: { subsidiary: true } },
        manager: true,
        approver: true,
      },
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
