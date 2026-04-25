import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

function parseQuantity(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, parsed)
}

async function getOpenQuantityForSalesOrderLine(
  salesOrderLineItemId: string,
  currentFulfillmentLineId?: string,
) {
  const salesOrderLine = await prisma.salesOrderLineItem.findUnique({
    where: { id: salesOrderLineItemId },
    include: {
      fulfillmentLines: {
        select: { id: true, quantity: true },
      },
    },
  })

  if (!salesOrderLine) return null

  const alreadyFulfilled = salesOrderLine.fulfillmentLines.reduce(
    (sum, line) => sum + (line.id === currentFulfillmentLineId ? 0 : line.quantity),
    0,
  )

  return {
    salesOrderLine,
    openQuantity: Math.max(0, salesOrderLine.quantity - alreadyFulfilled),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const fulfillmentId = typeof body.fulfillmentId === 'string' ? body.fulfillmentId.trim() : ''
    const salesOrderLineItemId = typeof body.salesOrderLineItemId === 'string' ? body.salesOrderLineItemId.trim() : ''
    const quantity = parseQuantity(body.quantity)
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
    const userId = typeof body.userId === 'string' ? body.userId : null

    if (!fulfillmentId || !salesOrderLineItemId || quantity <= 0) {
      return NextResponse.json({ error: 'fulfillmentId, salesOrderLineItemId, and quantity are required' }, { status: 400 })
    }

    const fulfillment = await prisma.fulfillment.findUnique({
      where: { id: fulfillmentId },
      include: { salesOrder: { select: { userId: true, number: true } } },
    })
    if (!fulfillment) {
      return NextResponse.json({ error: 'Fulfillment not found' }, { status: 404 })
    }

    const availability = await getOpenQuantityForSalesOrderLine(salesOrderLineItemId)
    if (!availability) {
      return NextResponse.json({ error: 'Sales order line not found' }, { status: 404 })
    }
    if (quantity > availability.openQuantity) {
      return NextResponse.json({ error: 'Fulfillment quantity exceeds the remaining open quantity' }, { status: 400 })
    }

    const line = await prisma.fulfillmentLine.create({
      data: {
        fulfillmentId,
        salesOrderLineItemId,
        quantity,
        notes,
      },
    })

    await logActivity({
      entityType: 'fulfillment',
      entityId: fulfillmentId,
      action: 'update',
      summary: `Added fulfillment line to ${fulfillment.number}`,
      userId: userId ?? fulfillment.salesOrder?.userId,
    })

    return NextResponse.json(line, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create fulfillment line' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing fulfillment line id' }, { status: 400 })
    }

    const body = await request.json()
    const salesOrderLineItemId = typeof body.salesOrderLineItemId === 'string' ? body.salesOrderLineItemId.trim() : ''
    const quantity = parseQuantity(body.quantity)
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
    const userId = typeof body.userId === 'string' ? body.userId : null

    const existing = await prisma.fulfillmentLine.findUnique({
      where: { id },
      include: {
        fulfillment: {
          include: {
            salesOrder: { select: { userId: true, number: true } },
          },
        },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Fulfillment line not found' }, { status: 404 })
    }

    if (!salesOrderLineItemId || quantity <= 0) {
      return NextResponse.json({ error: 'salesOrderLineItemId and quantity are required' }, { status: 400 })
    }

    const availability = await getOpenQuantityForSalesOrderLine(salesOrderLineItemId, id)
    if (!availability) {
      return NextResponse.json({ error: 'Sales order line not found' }, { status: 404 })
    }
    if (quantity > availability.openQuantity) {
      return NextResponse.json({ error: 'Fulfillment quantity exceeds the remaining open quantity' }, { status: 400 })
    }

    const updated = await prisma.fulfillmentLine.update({
      where: { id },
      data: {
        salesOrderLineItemId,
        quantity,
        notes,
      },
    })

    await logActivity({
      entityType: 'fulfillment',
      entityId: existing.fulfillmentId,
      action: 'update',
      summary: `Updated fulfillment line on ${existing.fulfillment.number}`,
      userId: userId ?? existing.fulfillment.salesOrder?.userId,
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update fulfillment line' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing fulfillment line id' }, { status: 400 })
    }

    const existing = await prisma.fulfillmentLine.findUnique({
      where: { id },
      include: {
        fulfillment: {
          include: {
            salesOrder: { select: { userId: true, number: true } },
          },
        },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Fulfillment line not found' }, { status: 404 })
    }

    await prisma.fulfillmentLine.delete({ where: { id } })

    await logActivity({
      entityType: 'fulfillment',
      entityId: existing.fulfillmentId,
      action: 'update',
      summary: `Removed fulfillment line from ${existing.fulfillment.number}`,
      userId: existing.fulfillment.salesOrder?.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete fulfillment line' }, { status: 500 })
  }
}
