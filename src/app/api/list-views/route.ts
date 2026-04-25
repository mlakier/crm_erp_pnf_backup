import { getServerSession } from 'next-auth/next'
import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const next: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const id = entry.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next
}

function serializeList(value: string[]) {
  return JSON.stringify(value)
}

const SEEDED_ITEM_LIST_VIEWS = [
  {
    name: 'Rev Rec',
    tableId: 'items-list',
    columnIds: [
      'itemId',
      'name',
      'sku',
      'itemType',
      'revenueStream',
      'recognitionMethod',
      'recognitionTrigger',
      'defaultRevRecTemplateId',
      'defaultTermMonths',
      'createRevenueArrangementOn',
      'createForecastPlanOn',
      'createRevenuePlanOn',
      'allocationEligible',
      'performanceObligationType',
      'standaloneSellingPrice',
      'directRevenuePosting',
      'incomeAccountId',
      'deferredRevenueAccountId',
    ],
    columnOrder: [
      'sku',
      'itemType',
      'revenueStream',
      'recognitionMethod',
      'recognitionTrigger',
      'defaultRevRecTemplateId',
      'defaultTermMonths',
      'createRevenueArrangementOn',
      'createForecastPlanOn',
      'createRevenuePlanOn',
      'allocationEligible',
      'performanceObligationType',
      'standaloneSellingPrice',
      'billingType',
      'directRevenuePosting',
      'incomeAccountId',
      'deferredRevenueAccountId',
    ],
  },
]

function parseStoredList(value: string) {
  try {
    const parsed = JSON.parse(value)
    return parseStringList(parsed)
  } catch {
    return []
  }
}

async function getSessionUserId(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    const sessionUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    })
    if (sessionUser?.id) return sessionUser.id
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  })

  if (token?.sub) {
    const tokenUser = await prisma.user.findUnique({
      where: { id: token.sub },
      select: { id: true },
    })
    if (tokenUser?.id) return tokenUser.id
  }

  const email = typeof token?.email === 'string' ? token.email : null
  const user = email
    ? await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
    : null

  if (user?.id) return user.id

  const fallbackUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return fallbackUser?.id ?? null
}

function shapeView(view: {
  id: string
  tableId: string
  name: string
  columnIds: string
  columnOrder: string
  isDefault: boolean
  updatedAt: Date
}) {
  return {
    id: view.id,
    tableId: view.tableId,
    name: view.name,
    columnIds: parseStoredList(view.columnIds),
    columnOrder: parseStoredList(view.columnOrder),
    isDefault: view.isDefault,
    updatedAt: view.updatedAt.toISOString(),
  }
}

async function ensureSeededViews(userId: string, tableId: string) {
  const seededViews = SEEDED_ITEM_LIST_VIEWS.filter((view) => view.tableId === tableId)
  for (const view of seededViews) {
    await prisma.savedListView.upsert({
      where: {
        userId_tableId_name: { userId, tableId, name: view.name },
      },
      create: {
        userId,
        tableId,
        name: view.name,
        columnIds: serializeList(view.columnIds),
        columnOrder: serializeList(view.columnOrder),
        isDefault: false,
      },
      update: {
        columnIds: serializeList(view.columnIds),
        columnOrder: serializeList(view.columnOrder),
      },
    })
  }
}

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ views: [] })

  const tableId = request.nextUrl.searchParams.get('tableId')?.trim()
  if (!tableId) {
    return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
  }

  await ensureSeededViews(userId, tableId)

  const views = await prisma.savedListView.findMany({
    where: { userId, tableId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json({ views: views.map(shapeView) })
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const tableId = String(body?.tableId ?? '').trim()
    const name = String(body?.name ?? '').trim()
    const columnIds = parseStringList(body?.columnIds)
    const columnOrder = parseStringList(body?.columnOrder)
    const isDefault = body?.isDefault === true

    if (!tableId || !name) {
      return NextResponse.json({ error: 'tableId and name are required' }, { status: 400 })
    }

    const view = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.savedListView.updateMany({
          where: { userId, tableId, isDefault: true },
          data: { isDefault: false },
        })
      }

      return tx.savedListView.upsert({
        where: {
          userId_tableId_name: { userId, tableId, name },
        },
        create: {
          userId,
          tableId,
          name,
          columnIds: serializeList(columnIds),
          columnOrder: serializeList(columnOrder),
          isDefault,
        },
        update: {
          columnIds: serializeList(columnIds),
          columnOrder: serializeList(columnOrder),
          ...(isDefault ? { isDefault: true } : {}),
        },
      })
    })

    return NextResponse.json({ view: shapeView(view) })
  } catch (error) {
    console.error('Failed to save list view', error)
    return NextResponse.json({ error: 'Failed to save view' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const tableId = String(body?.tableId ?? '').trim()
  const id = String(body?.id ?? '').trim()
  if (!tableId) {
    return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.savedListView.updateMany({
      where: { userId, tableId, isDefault: true },
      data: { isDefault: false },
    })

    if (id) {
      await tx.savedListView.updateMany({
        where: { id, userId, tableId },
        data: { isDefault: true },
      })
    }
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()
  const id = String(body?.id ?? '').trim()
  const tableId = String(body?.tableId ?? '').trim()
  if (!id || !tableId) {
    return NextResponse.json({ error: 'id and tableId are required' }, { status: 400 })
  }

  await prisma.savedListView.deleteMany({
    where: { id, userId, tableId },
  })

  return NextResponse.json({ ok: true })
}
