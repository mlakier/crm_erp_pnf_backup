import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { requisitionId, description, quantity, unitPrice, notes, itemId } = body

    if (!requisitionId || !description) {
      return NextResponse.json({ error: 'requisitionId and description are required' }, { status: 400 })
    }

    const qty = Math.max(1, parseInt(quantity) || 1)
    const price = parseFloat(unitPrice) || 0
    const lineTotal = qty * price

    const lineItem = await prisma.requisitionLineItem.create({
      data: {
        requisitionId,
        description,
        quantity: qty,
        unitPrice: price,
        lineTotal,
        notes: notes || null,
        itemId: itemId || null,
      },
    })

    // Recalculate total on the requisition
    const allItems = await prisma.requisitionLineItem.findMany({ where: { requisitionId } })
    const total = allItems.reduce((sum, item) => sum + item.lineTotal, 0)
    await prisma.requisition.update({ where: { id: requisitionId }, data: { total } })

    return NextResponse.json(lineItem, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create line item' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const lineItem = await prisma.requisitionLineItem.findUnique({ where: { id } })
    if (!lineItem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.requisitionLineItem.delete({ where: { id } })

    // Recalculate total
    const allItems = await prisma.requisitionLineItem.findMany({ where: { requisitionId: lineItem.requisitionId } })
    const total = allItems.reduce((sum, item) => sum + item.lineTotal, 0)
    await prisma.requisition.update({ where: { id: lineItem.requisitionId }, data: { total } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete line item' }, { status: 500 })
  }
}
