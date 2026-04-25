import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcLineTotal, parseMoneyValue, parseQuantity, sumMoney } from '@/lib/money'

async function recalcOpportunityAmount(opportunityId: string) {
  const all = await prisma.opportunityLineItem.findMany({ where: { opportunityId } })
  const total = sumMoney(all.map((line) => line.lineTotal))
  await prisma.opportunity.update({ where: { id: opportunityId }, data: { amount: total } })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { opportunityId, description, quantity, unitPrice, notes, itemId } = body

    if (!opportunityId || !description) {
      return NextResponse.json({ error: 'opportunityId and description are required' }, { status: 400 })
    }

    const qty = parseQuantity(quantity)
    const price = parseMoneyValue(unitPrice)
    const lineTotal = calcLineTotal(qty, price)

    const lineItem = await prisma.opportunityLineItem.create({
      data: {
        opportunityId,
        description,
        quantity: qty,
        unitPrice: price,
        lineTotal,
        notes: notes || null,
        itemId: itemId || null,
      },
    })

    await recalcOpportunityAmount(opportunityId)

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

    const lineItem = await prisma.opportunityLineItem.findUnique({ where: { id } })
    if (!lineItem) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.opportunityLineItem.delete({ where: { id } })
    await recalcOpportunityAmount(lineItem.opportunityId)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete line item' }, { status: 500 })
  }
}
