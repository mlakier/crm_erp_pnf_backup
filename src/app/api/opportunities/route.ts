import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { generateNextOpportunityNumber } from '@/lib/opportunity-number'
import { isFieldRequiredServer } from '@/lib/form-requirements-store'
import { calcLineTotal, parseMoneyValue, parseOptionalMoneyValue, parseQuantity, sumMoney } from '@/lib/money'
import { resolveCustomerTransactionSnapshot } from '@/lib/transaction-snapshot-defaults'

export async function GET() {
  try {
    const opportunities = await prisma.opportunity.findMany({ include: { customer: true } })
    return NextResponse.json(opportunities)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, amount, stage, closeDate, customerId, userId, lineItems } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const missing: string[] = []
    if ((await isFieldRequiredServer('opportunityCreate', 'name')) && !name) missing.push('name')
    if ((await isFieldRequiredServer('opportunityCreate', 'amount')) && (amount === '' || amount == null)) missing.push('amount')
    if ((await isFieldRequiredServer('opportunityCreate', 'customerId')) && !customerId) missing.push('customerId')
    if ((await isFieldRequiredServer('opportunityCreate', 'closeDate')) && !closeDate) missing.push('closeDate')

    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    const opportunityNumber = await generateNextOpportunityNumber()
    const snapshot = await resolveCustomerTransactionSnapshot(customerId, {})

    // Build line item create data
    const lineItemRows = Array.isArray(lineItems)
      ? lineItems.map((li: { itemId?: string | null; description: string; quantity: number; unitPrice: number; notes?: string | null }) => {
          const qty = parseQuantity(li.quantity)
          const price = parseMoneyValue(li.unitPrice)
          return {
            description: String(li.description || ''),
            quantity: qty,
            unitPrice: price,
            lineTotal: calcLineTotal(qty, price),
            notes: li.notes || null,
            itemId: li.itemId || null,
          }
        })
      : []

    // If line items provided, compute amount from them; otherwise use submitted amount
    const computedAmount = lineItemRows.length > 0
      ? sumMoney(lineItemRows.map((li: { lineTotal: number }) => li.lineTotal))
      : parseMoneyValue(amount)

    const opportunity = await prisma.opportunity.create({
      data: {
        opportunityNumber,
        name,
        amount: computedAmount,
        stage,
        closeDate: closeDate ? new Date(closeDate) : null,
        customerId,
        userId,
        subsidiaryId: snapshot.subsidiaryId,
        currencyId: snapshot.currencyId,
        ...(lineItemRows.length > 0 ? { lineItems: { create: lineItemRows } } : {}),
      },
      include: { lineItems: true },
    })

    await logActivity({
      entityType: 'opportunity',
      entityId: opportunity.id,
      action: 'create',
      summary: `Created opportunity ${opportunity.opportunityNumber ?? opportunity.name} ${opportunity.name}`,
      userId,
    })

    return NextResponse.json(opportunity, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create opportunity' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing opportunity id' }, { status: 400 })

    const body = await request.json()
    const { name, amount, stage, closeDate } = body
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const opportunity = await prisma.opportunity.update({
      where: { id },
      data: {
        name,
        stage: stage || null,
        amount: parseOptionalMoneyValue(amount),
        closeDate: closeDate ? new Date(closeDate) : null,
      },
    })

    await logActivity({
      entityType: 'opportunity',
      entityId: opportunity.id,
      action: 'update',
      summary: `Updated opportunity ${opportunity.opportunityNumber ?? opportunity.name} ${opportunity.name} to stage ${opportunity.stage}`,
      userId: opportunity.userId,
    })

    return NextResponse.json(opportunity)
  } catch {
    return NextResponse.json({ error: 'Failed to update opportunity' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing opportunity id' }, { status: 400 })
    }

    const existing = await prisma.opportunity.findUnique({ where: { id } })
    await prisma.opportunity.delete({ where: { id } })

    await logActivity({
      entityType: 'opportunity',
      entityId: id,
      action: 'delete',
      summary: `Deleted opportunity ${existing ? `${existing.opportunityNumber ?? existing.name} ${existing.name}` : id}`,
      userId: existing?.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete opportunity' }, { status: 500 })
  }
}
