import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateInvoiceReceiptNumber } from '@/lib/invoice-receipt-number'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const row = await prisma.cashReceipt.findUnique({ where: { id }, include: { invoice: { include: { customer: true } } } })
    return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const rows = await prisma.cashReceipt.findMany({ include: { invoice: { include: { customer: true } } }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { invoiceId, amount, date, method, reference } = body
  if (!invoiceId || !amount || !date || !method) return NextResponse.json({ error: 'invoiceId, amount, date, method required' }, { status: 400 })
  const number = await generateInvoiceReceiptNumber()
  const row = await prisma.cashReceipt.create({ data: { number, invoiceId, amount: parseFloat(amount), date: new Date(date), method, reference: reference || null } })
  return NextResponse.json(row, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const body = await req.json()
  if (body.amount) body.amount = parseFloat(body.amount)
  if (body.date) body.date = new Date(body.date)
  const row = await prisma.cashReceipt.update({ where: { id }, data: body })
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await prisma.cashReceipt.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
