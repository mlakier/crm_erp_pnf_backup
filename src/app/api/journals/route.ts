import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const row = await prisma.journalEntry.findUnique({ where: { id }, include: { subsidiary: true, currency: true, user: true, accountingPeriod: true, postedByEmployee: true, approvedByEmployee: true, lineItems: true } })
    return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const rows = await prisma.journalEntry.findMany({ include: { subsidiary: true, currency: true, user: true, accountingPeriod: true, postedByEmployee: true, approvedByEmployee: true, lineItems: true }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (body.entityId !== undefined && body.subsidiaryId === undefined) body.subsidiaryId = body.entityId
  delete body.entityId
  if (body.total) body.total = parseFloat(body.total)
  if (body.date) body.date = new Date(body.date)
  if (body.subsidiaryId === '') body.subsidiaryId = null
  if (body.currencyId === '') body.currencyId = null
  if (body.accountingPeriodId === '') body.accountingPeriodId = null
  if (body.postedByEmployeeId === '') body.postedByEmployeeId = null
  if (body.approvedByEmployeeId === '') body.approvedByEmployeeId = null
  const row = await prisma.journalEntry.create({ data: body })
  await logActivity({ action: 'Created Journal Entry', target: row.number })
  return NextResponse.json(row, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const body = await req.json()
  if (body.entityId !== undefined && body.subsidiaryId === undefined) body.subsidiaryId = body.entityId
  delete body.entityId
  if (body.total) body.total = parseFloat(body.total)
  if (body.date) body.date = new Date(body.date)
  if (body.subsidiaryId === '') body.subsidiaryId = null
  if (body.currencyId === '') body.currencyId = null
  if (body.accountingPeriodId === '') body.accountingPeriodId = null
  if (body.postedByEmployeeId === '') body.postedByEmployeeId = null
  if (body.approvedByEmployeeId === '') body.approvedByEmployeeId = null
  const row = await prisma.journalEntry.update({ where: { id }, data: body })
  await logActivity({ action: 'Updated Journal Entry', target: row.number })
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const row = await prisma.journalEntry.delete({ where: { id } })
  await logActivity({ action: 'Deleted Journal Entry', target: row.number })
  return NextResponse.json({ ok: true })
}
