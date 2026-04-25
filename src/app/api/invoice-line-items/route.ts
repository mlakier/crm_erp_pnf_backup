import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { syncInvoiceTotal } from '@/lib/invoice-total'
import { calcLineTotal, parseMoneyValue, parseQuantity } from '@/lib/money'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invoiceId, itemId, description, quantity, unitPrice, displayOrder, userId } = body

    if (!invoiceId || !description || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parsedQuantity = parseQuantity(quantity)
    const parsedUnitPrice = parseMoneyValue(unitPrice, Number.NaN)
    const parsedDisplayOrder = Number.parseInt(String(displayOrder ?? 0), 10)

    if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
      return NextResponse.json({ error: 'Unit price must be zero or greater' }, { status: 400 })
    }

    if (!Number.isFinite(parsedDisplayOrder) || parsedDisplayOrder < 0) {
      return NextResponse.json({ error: 'Display order must be zero or greater' }, { status: 400 })
    }

    const lineItem = await prisma.invoiceLineItem.create({
      data: {
        invoiceId,
        itemId: itemId || null,
        description: String(description).trim(),
        quantity: parsedQuantity,
        unitPrice: parsedUnitPrice,
        lineTotal: calcLineTotal(parsedQuantity, parsedUnitPrice),
      },
    })

    const invoice = await syncInvoiceTotal(invoiceId)

    await logActivity({
      entityType: 'invoice',
      entityId: invoiceId,
      action: 'update',
      summary: `Added line item to invoice ${invoice.number}`,
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

    const existing = await prisma.invoiceLineItem.findUnique({ where: { id } })
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

    const updated = await prisma.invoiceLineItem.update({
      where: { id },
      data: {
        itemId: itemId || null,
        description: String(description).trim(),
        quantity: parsedQuantity,
        unitPrice: parsedUnitPrice,
        lineTotal: calcLineTotal(parsedQuantity, parsedUnitPrice),
      },
    })

    const invoice = await syncInvoiceTotal(existing.invoiceId)

    await logActivity({
      entityType: 'invoice',
      entityId: existing.invoiceId,
      action: 'update',
      summary: `Updated line item on invoice ${invoice.number}`,
      userId: userId ?? invoice.userId,
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

    const existing = await prisma.invoiceLineItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    await prisma.invoiceLineItem.delete({ where: { id } })
    const invoice = await syncInvoiceTotal(existing.invoiceId)

    await logActivity({
      entityType: 'invoice',
      entityId: existing.invoiceId,
      action: 'update',
      summary: `Removed line item from invoice ${invoice.number}`,
      userId: invoice.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete line item' }, { status: 500 })
  }
}
