import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { generateNextPurchaseOrderNumber } from '@/lib/purchase-order-number'

export async function GET() {
  try {
    const purchaseOrders = await prisma.purchaseOrder.findMany({ include: { vendor: true } })
    return NextResponse.json(purchaseOrders)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { status, total, vendorId, userId } = body

    if (!vendorId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const number = await generateNextPurchaseOrderNumber()

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        number,
        status,
        total,
        vendorId,
        userId,
      },
    })

    await logActivity({
      entityType: 'purchase-order',
      entityId: purchaseOrder.id,
      action: 'create',
      summary: `Created purchase order ${purchaseOrder.number}`,
      userId,
    })

    return NextResponse.json(purchaseOrder, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing purchase order id' }, { status: 400 })

    const body = await request.json()
    const { status, total } = body

    const po = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: status || null,
        total: total !== '' && total != null ? parseFloat(total) : 0,
      },
    })

    await logActivity({
      entityType: 'purchase-order',
      entityId: po.id,
      action: 'update',
      summary: `Updated purchase order ${po.number}`,
      userId: po.userId,
    })

    return NextResponse.json(po)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing purchase order id' }, { status: 400 })
    }

    const existing = await prisma.purchaseOrder.findUnique({ where: { id } })
    await prisma.purchaseOrder.delete({ where: { id } })

    await logActivity({
      entityType: 'purchase-order',
      entityId: id,
      action: 'delete',
      summary: `Deleted purchase order ${existing?.number ?? id}`,
      userId: existing?.userId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 })
  }
}