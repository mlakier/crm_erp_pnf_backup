import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadListValues } from '@/lib/load-list-values'
import { logActivity, logFieldChangeActivities } from '@/lib/activity'

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value === 'true'
  return fallback
}

function normalizeDate(value: unknown) {
  const text = String(value ?? '').trim()
  return text ? new Date(text) : null
}

function normalizeText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

async function loadAccountingPeriodStatusValues() {
  const values = await loadListValues('ACCOUNTING-PERIOD-STATUS')
  return values.map((value) => value.toLowerCase())
}

function normalizeStatus(value: unknown, allowedStatuses: string[], fallback: string) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return fallback
  return allowedStatuses.includes(normalized) ? normalized : fallback
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const row = await prisma.accountingPeriod.findUnique({
      where: { id },
      include: { subsidiary: true, _count: { select: { journalEntries: true } } },
    })
    return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const rows = await prisma.accountingPeriod.findMany({
    include: { subsidiary: true, _count: { select: { journalEntries: true } } },
    orderBy: [{ startDate: 'desc' }, { name: 'asc' }],
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const statusValues = await loadAccountingPeriodStatusValues()
  const startDate = normalizeDate(body.startDate)
  const endDate = normalizeDate(body.endDate)
  if (!body.name || !startDate || !endDate) {
    return NextResponse.json({ error: 'Name, start date, and end date are required' }, { status: 400 })
  }

  const closed = normalizeBoolean(body.closed)
  const row = await prisma.accountingPeriod.create({
    data: {
      name: String(body.name).trim(),
      startDate,
      endDate,
      subsidiaryId: normalizeText(body.subsidiaryId),
      status: normalizeStatus(body.status, statusValues, 'open'),
      closed,
      arLocked: normalizeBoolean(body.arLocked),
      apLocked: normalizeBoolean(body.apLocked),
      inventoryLocked: normalizeBoolean(body.inventoryLocked),
      closedAt: closed ? new Date() : null,
    },
    include: { subsidiary: true, _count: { select: { journalEntries: true } } },
  })
  await logActivity({
    entityType: 'accounting-period',
    entityId: row.id,
    action: 'create',
    summary: `Created accounting period ${row.name}`,
  })
  return NextResponse.json(row, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json()
  const existing = await prisma.accountingPeriod.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const statusValues = await loadAccountingPeriodStatusValues()
  const normalizedStatus =
    body.status !== undefined
      ? normalizeStatus(body.status, statusValues, existing.status)
      : existing.status
  const normalizedName = body.name !== undefined ? String(body.name).trim() : existing.name
  const normalizedStartDate = body.startDate !== undefined ? normalizeDate(body.startDate) ?? existing.startDate : existing.startDate
  const normalizedEndDate = body.endDate !== undefined ? normalizeDate(body.endDate) ?? existing.endDate : existing.endDate
  const normalizedSubsidiaryId = body.subsidiaryId !== undefined ? normalizeText(body.subsidiaryId) : existing.subsidiaryId

  const closed = body.closed !== undefined ? normalizeBoolean(body.closed, existing.closed) : existing.closed
  const row = await prisma.accountingPeriod.update({
    where: { id },
    data: {
      name: normalizedName,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      subsidiaryId: normalizedSubsidiaryId,
      status: normalizedStatus,
      closed,
      arLocked: body.arLocked !== undefined ? normalizeBoolean(body.arLocked, existing.arLocked) : existing.arLocked,
      apLocked: body.apLocked !== undefined ? normalizeBoolean(body.apLocked, existing.apLocked) : existing.apLocked,
      inventoryLocked:
        body.inventoryLocked !== undefined
          ? normalizeBoolean(body.inventoryLocked, existing.inventoryLocked)
          : existing.inventoryLocked,
      closedAt: closed ? existing.closedAt ?? new Date() : null,
    },
    include: { subsidiary: true, _count: { select: { journalEntries: true } } },
  })
  await logActivity({
    entityType: 'accounting-period',
    entityId: row.id,
    action: 'update',
    summary: `Updated accounting period ${row.name}`,
  })
  await logFieldChangeActivities({
    entityType: 'accounting-period',
    entityId: row.id,
    context: 'Accounting Period',
    changes: [
      existing.name !== normalizedName ? { fieldName: 'Name', oldValue: existing.name, newValue: normalizedName } : null,
      existing.startDate.getTime() !== normalizedStartDate.getTime() ? { fieldName: 'Start Date', oldValue: existing.startDate.toISOString().slice(0, 10), newValue: normalizedStartDate.toISOString().slice(0, 10) } : null,
      existing.endDate.getTime() !== normalizedEndDate.getTime() ? { fieldName: 'End Date', oldValue: existing.endDate.toISOString().slice(0, 10), newValue: normalizedEndDate.toISOString().slice(0, 10) } : null,
      (existing.subsidiaryId ?? '') !== (normalizedSubsidiaryId ?? '') ? { fieldName: 'Subsidiary', oldValue: existing.subsidiaryId ?? '-', newValue: normalizedSubsidiaryId ?? '-' } : null,
      existing.status !== normalizedStatus ? { fieldName: 'Status', oldValue: existing.status, newValue: normalizedStatus } : null,
      existing.closed !== closed ? { fieldName: 'Closed', oldValue: existing.closed ? 'Yes' : 'No', newValue: closed ? 'Yes' : 'No' } : null,
      existing.arLocked !== row.arLocked ? { fieldName: 'AR Locked', oldValue: existing.arLocked ? 'Yes' : 'No', newValue: row.arLocked ? 'Yes' : 'No' } : null,
      existing.apLocked !== row.apLocked ? { fieldName: 'AP Locked', oldValue: existing.apLocked ? 'Yes' : 'No', newValue: row.apLocked ? 'Yes' : 'No' } : null,
      existing.inventoryLocked !== row.inventoryLocked ? { fieldName: 'Inventory Locked', oldValue: existing.inventoryLocked ? 'Yes' : 'No', newValue: row.inventoryLocked ? 'Yes' : 'No' } : null,
    ].filter((change): change is { fieldName: string; oldValue: string; newValue: string } => Boolean(change)),
  })
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await prisma.accountingPeriod.findUnique({
    where: { id },
    include: { _count: { select: { journalEntries: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing._count.journalEntries > 0) {
    return NextResponse.json({ error: 'Cannot delete an accounting period with journal entries' }, { status: 400 })
  }

  await prisma.accountingPeriod.delete({ where: { id } })
  await logActivity({
    entityType: 'accounting-period',
    entityId: id,
    action: 'delete',
    summary: `Deleted accounting period ${existing.name}`,
  })
  return NextResponse.json({ ok: true })
}
