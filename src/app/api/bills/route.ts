import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { generateNextBillNumber } from '@/lib/bill-number'

const INCLUDE = {
  vendor: true,
} as const

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const bill = await prisma.bill.findUnique({
        where: { id },
        include: INCLUDE,
      })

      if (!bill) {
        return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
      }

      return NextResponse.json(bill)
    }

    const bills = await prisma.bill.findMany({
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(bills)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vendorId, total, date, dueDate, status, notes } = body

    if (!vendorId || total === undefined || !date) {
      return NextResponse.json({ error: 'vendorId, total, and bill date are required' }, { status: 400 })
    }

    const number = await generateNextBillNumber()
    const nextStatus = status || 'received'

    const bill = await prisma.bill.create({
      data: {
        number,
        vendorId,
        total: Number.parseFloat(String(total)) || 0,
        date: new Date(date),
        dueDate: dueDate ? new Date(dueDate) : null,
        status: nextStatus,
        notes: notes || null,
      },
      include: INCLUDE,
    })

    await logActivity({
      entityType: 'bill',
      entityId: bill.id,
      action: 'create',
      summary: `Created bill ${bill.number}`,
    })

    return NextResponse.json(bill, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing bill id' }, { status: 400 })
    }

    const body = await request.json()
    const { vendorId, total, date, dueDate, status, notes } = body

    if (vendorId !== undefined && !String(vendorId ?? '').trim()) {
      return NextResponse.json({ error: 'vendorId cannot be empty' }, { status: 400 })
    }

    if (date !== undefined && !String(date ?? '').trim()) {
      return NextResponse.json({ error: 'date cannot be empty' }, { status: 400 })
    }

    const bill = await prisma.bill.update({
      where: { id },
      data: {
        ...(vendorId !== undefined ? { vendorId: String(vendorId).trim() } : {}),
        ...(total !== undefined ? { total: Number.parseFloat(String(total)) || 0 } : {}),
        ...(date !== undefined ? { date: new Date(String(date)) } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(status !== undefined ? { status: status || 'received' } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
      },
      include: INCLUDE,
    })

    await logActivity({
      entityType: 'bill',
      entityId: bill.id,
      action: 'update',
      summary: `Updated bill ${bill.number}`,
    })

    return NextResponse.json(bill)
  } catch {
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing bill id' }, { status: 400 })
    }

    const existing = await prisma.bill.findUnique({ where: { id } })
    await prisma.bill.delete({ where: { id } })

    await logActivity({
      entityType: 'bill',
      entityId: id,
      action: 'delete',
      summary: `Deleted bill ${existing?.number ?? id}`,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 })
  }
}
