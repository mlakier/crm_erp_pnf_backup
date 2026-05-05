import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { syncBillTotal } from '@/lib/bill-total'
import { calcLineTotal, parseMoneyValue, parseQuantity } from '@/lib/money'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { billId, itemId, lineType, expenseAccountId, description, quantity, unitPrice, userId, notes } = body

    if (!billId || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsedQuantity = parseQuantity(quantity)
    const parsedUnitPrice = parseMoneyValue(unitPrice, Number.NaN)

    if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
      return NextResponse.json({ error: 'Unit price must be zero or greater' }, { status: 400 })
    }

    const normalizedLineType = lineType === 'expense' ? 'expense' : 'item'
    if (normalizedLineType === 'expense' && !String(expenseAccountId ?? '').trim()) {
      return NextResponse.json({ error: 'Expense account is required for expense lines' }, { status: 400 })
    }

    const lineItem = await prisma.billLineItem.create({
      data: {
        billId,
        lineType: normalizedLineType,
        itemId: normalizedLineType === 'expense' ? null : itemId || null,
        expenseAccountId: normalizedLineType === 'expense' ? String(expenseAccountId).trim() : null,
        description,
        quantity: parsedQuantity,
        unitPrice: parsedUnitPrice,
        lineTotal: calcLineTotal(parsedQuantity, parsedUnitPrice),
        notes: notes || null,
      },
    })

    const bill = await syncBillTotal(billId)

    await logActivity({
      entityType: 'bill',
      entityId: billId,
      action: 'update',
      summary: `Added line item to bill ${bill.number}`,
      userId: userId ?? bill.userId,
    })

    return NextResponse.json(lineItem, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create line item' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing line item id' }, { status: 400 })

    const body = await request.json()
    const { itemId, lineType, expenseAccountId, description, quantity, unitPrice, userId, notes } = body

    const existing = await prisma.billLineItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    const parsedQuantity = parseQuantity(quantity)
    const parsedUnitPrice = parseMoneyValue(unitPrice, Number.NaN)

    if (!description || !String(description).trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
      return NextResponse.json({ error: 'Unit price must be zero or greater' }, { status: 400 })
    }

    const normalizedLineType = lineType === 'expense' ? 'expense' : 'item'
    if (normalizedLineType === 'expense' && !String(expenseAccountId ?? '').trim()) {
      return NextResponse.json({ error: 'Expense account is required for expense lines' }, { status: 400 })
    }

    const updated = await prisma.billLineItem.update({
      where: { id },
      data: {
        lineType: normalizedLineType,
        itemId: normalizedLineType === 'expense' ? null : itemId || null,
        expenseAccountId: normalizedLineType === 'expense' ? String(expenseAccountId).trim() : null,
        description: String(description).trim(),
        quantity: parsedQuantity,
        unitPrice: parsedUnitPrice,
        lineTotal: calcLineTotal(parsedQuantity, parsedUnitPrice),
        notes: notes || null,
      },
    })

    const bill = await syncBillTotal(existing.billId)

    await logActivity({
      entityType: 'bill',
      entityId: existing.billId,
      action: 'update',
      summary: `Updated line item on bill ${bill.number}`,
      userId: userId ?? bill.userId,
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update line item' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing line item id' }, { status: 400 })

    const existing = await prisma.billLineItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    await prisma.billLineItem.delete({ where: { id } })
    const bill = await syncBillTotal(existing.billId)

    await logActivity({
      entityType: 'bill',
      entityId: existing.billId,
      action: 'update',
      summary: `Removed line item from bill ${bill.number}`,
      userId: bill.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete line item' }, { status: 500 })
  }
}
