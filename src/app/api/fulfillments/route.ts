import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateFulfillmentNumber } from '@/lib/fulfillment-number'
import { logActivity } from '@/lib/activity'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const row = await prisma.fulfillment.findUnique({ where: { id }, include: { salesOrder: { include: { customer: true } }, subsidiary: true, currency: true, lines: true } })
    return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const rows = await prisma.fulfillment.findMany({ include: { salesOrder: { include: { customer: true } }, subsidiary: true, currency: true }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (body.entityId !== undefined && body.subsidiaryId === undefined) body.subsidiaryId = body.entityId
  delete body.entityId
  const number = await generateFulfillmentNumber()
  const row = await prisma.fulfillment.create({ data: { number, ...body } })
  await logActivity({ action: 'Created Fulfillment', target: number })
  return NextResponse.json(row, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const body = await req.json()
  if (body.entityId !== undefined && body.subsidiaryId === undefined) body.subsidiaryId = body.entityId
  delete body.entityId
  const row = await prisma.fulfillment.update({ where: { id }, data: body })
  await logActivity({ action: 'Updated Fulfillment', target: row.number })
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const row = await prisma.fulfillment.delete({ where: { id } })
  await logActivity({ action: 'Deleted Fulfillment', target: row.number })
  return NextResponse.json({ ok: true })
}
