import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateBillPaymentNumber } from '@/lib/bill-payment-number'
import { logActivity } from '@/lib/activity'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const row = await prisma.billPayment.findUnique({ where: { id }, include: { bill: { include: { vendor: true } } } })
    return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const rows = await prisma.billPayment.findMany({ include: { bill: { include: { vendor: true } } }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const number = await generateBillPaymentNumber()
  if (body.amount) body.amount = parseFloat(body.amount)
  if (body.date) body.date = new Date(body.date)
  const row = await prisma.billPayment.create({ data: { number, ...body } })
  await logActivity({
    entityType: 'bill-payment',
    entityId: row.id,
    action: 'create',
    summary: `Created bill payment ${row.number}`,
  })
  return NextResponse.json(row, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const body = await req.json()
  if (body.amount) body.amount = parseFloat(body.amount)
  if (body.date) body.date = new Date(body.date)
  const row = await prisma.billPayment.update({ where: { id }, data: body })
  await logActivity({
    entityType: 'bill-payment',
    entityId: row.id,
    action: 'update',
    summary: `Updated bill payment ${row.number}`,
  })
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const existing = await prisma.billPayment.findUnique({
      where: { id },
      select: { id: true, number: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bill payment not found' }, { status: 404 })
    }

    const row = await prisma.billPayment.delete({ where: { id } })
    await logActivity({
      entityType: 'bill-payment',
      entityId: row.id,
      action: 'delete',
      summary: `Deleted bill payment ${row.number}`,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: 'Transaction has the following child records:\n\nUnable to delete because dependent records exist.' },
      { status: 409 },
    )
  }
}
