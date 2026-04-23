import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const roleId = req.nextUrl.searchParams.get('roleId')
  if (roleId) {
    const permissions = await prisma.permission.findMany({ where: { roleId } })
    return NextResponse.json(permissions)
  }
  const permissions = await prisma.permission.findMany({ include: { role: true } })
  return NextResponse.json(permissions)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { roleId, permissions } = body as {
    roleId: string
    permissions: { page: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; blockedStates?: string }[]
  }
  if (!roleId || !Array.isArray(permissions)) return NextResponse.json({ error: 'roleId and permissions[] required' }, { status: 400 })

  const results = await Promise.all(
    permissions.map((p) =>
      prisma.permission.upsert({
        where: { roleId_page: { roleId, page: p.page } },
        update: { canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete, blockedStates: p.blockedStates ?? null },
        create: { roleId, page: p.page, canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete, blockedStates: p.blockedStates ?? null },
      })
    )
  )
  return NextResponse.json(results)
}
