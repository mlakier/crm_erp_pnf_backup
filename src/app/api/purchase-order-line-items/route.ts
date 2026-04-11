import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { syncPurchaseOrderTotal } from '@/lib/purchase-order-total'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { purchaseOrderId, description, quantity, unitPrice, userId } = body

    if (!purchaseOrderId || !description || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsedQuantity = Number.parseInt(String(quantity), 10)
    const parsedUnitPrice = Number.parseFloat(String(unitPrice))

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 })
    }

    if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
      return NextResponse.json({ error: 'Unit price must be zero or greater' }, { status: 400 })
    }

    const lineItem = await prisma.purchaseOrderLineItem.create({
      data: {
        purchaseOrderId,
        description,
        quantity: parsedQuantity,
        unitPrice: parsedUnitPrice,
        lineTotal: parsedQuantity * parsedUnitPrice,
      },
    })

    const purchaseOrder = await syncPurchaseOrderTotal(purchaseOrderId)

    await logActivity({
      entityType: 'purchase-order',
      entityId: purchaseOrderId,
      action: 'update',
      summary: `Added line item to purchase order ${purchaseOrder.number}`,
      userId,
    })

    return NextResponse.json(lineItem, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create line item' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing line item id' }, { status: 400 })
    }

    const existing = await prisma.purchaseOrderLineItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    await prisma.purchaseOrderLineItem.delete({ where: { id } })
    const purchaseOrder = await syncPurchaseOrderTotal(existing.purchaseOrderId)

    await logActivity({
      entityType: 'purchase-order',
      entityId: existing.purchaseOrderId,
      action: 'update',
      summary: `Removed line item from purchase order ${purchaseOrder.number}`,
      userId: purchaseOrder.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete line item' }, { status: 500 })
  }
}