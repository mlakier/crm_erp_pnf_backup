import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { purchaseOrderId, quantity, date, notes, userId } = body

    if (!purchaseOrderId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsedQuantity = Number.parseInt(String(quantity), 10)
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 })
    }

    const receipt = await prisma.receipt.create({
      data: {
        purchaseOrderId,
        quantity: parsedQuantity,
        date: date ? new Date(date) : new Date(),
        notes: notes || null,
      },
    })

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: { number: true },
    })

    await logActivity({
      entityType: 'purchase-order',
      entityId: purchaseOrderId,
      action: 'update',
      summary: `Recorded receipt for purchase order ${purchaseOrder?.number ?? purchaseOrderId}`,
      userId,
    })

    return NextResponse.json(receipt, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create receipt' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing receipt id' }, { status: 400 })
    }

    const existing = await prisma.receipt.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    await prisma.receipt.delete({ where: { id } })

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: existing.purchaseOrderId },
      select: { number: true, userId: true },
    })

    await logActivity({
      entityType: 'purchase-order',
      entityId: existing.purchaseOrderId,
      action: 'update',
      summary: `Deleted receipt from purchase order ${purchaseOrder?.number ?? existing.purchaseOrderId}`,
      userId: purchaseOrder?.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete receipt' }, { status: 500 })
  }
}