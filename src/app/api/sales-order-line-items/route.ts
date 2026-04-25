import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { syncSalesOrderTotal } from '@/lib/sales-order-total'
import { calcLineTotal, parseMoneyValue, parseQuantity } from '@/lib/money'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { salesOrderId, itemId, description, quantity, unitPrice, userId } = body

    if (!salesOrderId || !description || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsedQuantity = parseQuantity(quantity)
    const parsedUnitPrice = parseMoneyValue(unitPrice, Number.NaN)

    if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
      return NextResponse.json({ error: 'Unit price must be zero or greater' }, { status: 400 })
    }

    const lineItem = await prisma.salesOrderLineItem.create({
      data: {
        salesOrderId,
        itemId: itemId || null,
        description: String(description).trim(),
        quantity: parsedQuantity,
        unitPrice: parsedUnitPrice,
        lineTotal: calcLineTotal(parsedQuantity, parsedUnitPrice),
      },
    })

    const salesOrder = await syncSalesOrderTotal(salesOrderId)

    await logActivity({
      entityType: 'sales-order',
      entityId: salesOrderId,
      action: 'update',
      summary: `Added line item to sales order ${salesOrder.number}`,
      userId,
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

    if (!id) {
      return NextResponse.json({ error: 'Missing line item id' }, { status: 400 })
    }

    const body = await request.json()
    const { itemId, description, quantity, unitPrice, userId } = body

    const existing = await prisma.salesOrderLineItem.findUnique({ where: { id } })
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

    const updated = await prisma.salesOrderLineItem.update({
      where: { id },
      data: {
        itemId: itemId || null,
        description: String(description).trim(),
        quantity: parsedQuantity,
        unitPrice: parsedUnitPrice,
        lineTotal: calcLineTotal(parsedQuantity, parsedUnitPrice),
      },
    })

    const salesOrder = await syncSalesOrderTotal(existing.salesOrderId)

    await logActivity({
      entityType: 'sales-order',
      entityId: existing.salesOrderId,
      action: 'update',
      summary: `Updated line item on sales order ${salesOrder.number}`,
      userId: userId ?? salesOrder.userId,
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

    if (!id) {
      return NextResponse.json({ error: 'Missing line item id' }, { status: 400 })
    }

    const existing = await prisma.salesOrderLineItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    await prisma.salesOrderLineItem.delete({ where: { id } })
    const salesOrder = await syncSalesOrderTotal(existing.salesOrderId)

    await logActivity({
      entityType: 'sales-order',
      entityId: existing.salesOrderId,
      action: 'update',
      summary: `Removed line item from sales order ${salesOrder.number}`,
      userId: salesOrder.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete line item' }, { status: 500 })
  }
}
