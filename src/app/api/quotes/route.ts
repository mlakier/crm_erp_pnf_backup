import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createFieldChangeSummary, logActivity } from '@/lib/activity'
import { generateNextQuoteNumber } from '@/lib/quote-number'
import { calcLineTotal, sumMoney } from '@/lib/money'
import { toNumericValue } from '@/lib/format'

export async function GET() {
  try {
    const quotes = await prisma.quote.findMany({
      include: {
        customer: true,
        opportunity: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(quotes)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { opportunityId, number: requestedNumber, status, validUntil: requestedValidUntil, notes, subsidiaryId, currencyId } = body

    if (!opportunityId) {
      return NextResponse.json({ error: 'Missing opportunity id' }, { status: 400 })
    }

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        customer: true,
        quote: true,
        lineItems: true,
      },
    })

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    if (opportunity.quote) {
      return NextResponse.json({ error: 'Quote already exists for this opportunity', quoteId: opportunity.quote.id }, { status: 409 })
    }

    const number = requestedNumber?.trim() || (await generateNextQuoteNumber())
    const validUntil = requestedValidUntil
      ? new Date(requestedValidUntil)
      : opportunity.closeDate
      ? new Date(opportunity.closeDate)
      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    const normalizedLineItems = opportunity.lineItems.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: toNumericValue(line.unitPrice),
      lineTotal: calcLineTotal(line.quantity, line.unitPrice),
      notes: line.notes,
      itemId: line.itemId,
    }))
    const total = normalizedLineItems.length
      ? sumMoney(normalizedLineItems.map((line) => line.lineTotal))
      : toNumericValue(opportunity.amount)

    const quote = await prisma.quote.create({
      data: {
        number,
        status: status || 'draft',
        total,
        validUntil,
        notes: notes ?? `Generated from opportunity ${opportunity.opportunityNumber ?? opportunity.name}`,
        customerId: opportunity.customerId,
        userId: opportunity.userId,
        opportunityId: opportunity.id,
        subsidiaryId: subsidiaryId ?? opportunity.subsidiaryId,
        currencyId: currencyId ?? opportunity.currencyId,
        lineItems: normalizedLineItems.length
          ? {
              create: normalizedLineItems,
            }
          : undefined,
      },
    })

    await logActivity({
      entityType: 'quote',
      entityId: quote.id,
      action: 'create',
      summary: `Created quote ${quote.number} from opportunity ${opportunity.opportunityNumber ?? opportunity.name}`,
      userId: opportunity.userId,
    })

    return NextResponse.json(quote, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing quote id' }, { status: 400 })
    }

    const body = await request.json()
    const { number, status, validUntil, notes, subsidiaryId, currencyId, customerId } = body
    const before = await prisma.quote.findUnique({ where: { id } })

    if (!before) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: {
        ...(number !== undefined ? { number: String(number || '').trim() || undefined } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(validUntil !== undefined ? { validUntil: validUntil ? new Date(validUntil) : null } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(subsidiaryId !== undefined ? { subsidiaryId: subsidiaryId || null } : {}),
        ...(currencyId !== undefined ? { currencyId: currencyId || null } : {}),
        ...(customerId !== undefined ? { customerId: customerId || null } : {}),
      },
    })

    await logActivity({
      entityType: 'quote',
      entityId: quote.id,
      action: 'update',
      summary: `Updated quote ${quote.number}`,
      userId: quote.userId,
    })

    const changes = [
      ['Quote Id', before.number, quote.number],
      ['Status', before.status ?? '', quote.status ?? ''],
      ['Valid Until', before.validUntil ? before.validUntil.toISOString().slice(0, 10) : '', quote.validUntil ? quote.validUntil.toISOString().slice(0, 10) : ''],
      ['Notes', before.notes ?? '', quote.notes ?? ''],
      ['Subsidiary', before.subsidiaryId ?? '', quote.subsidiaryId ?? ''],
      ['Currency', before.currencyId ?? '', quote.currencyId ?? ''],
      ['Customer', before.customerId ?? '', quote.customerId ?? ''],
    ]
      .filter(([, oldValue, newValue]) => oldValue !== newValue)
      .map(([fieldName, oldValue, newValue]) => ({
        entityType: 'quote',
        entityId: quote.id,
        action: 'update',
        summary: createFieldChangeSummary({
          context: 'Header',
          fieldName,
          oldValue,
          newValue,
        }),
        userId: quote.userId,
      }))

    if (changes.length) {
      await prisma.activity.createMany({ data: changes })
    }

    return NextResponse.json(quote)
  } catch {
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing quote id' }, { status: 400 })
    }

    const existing = await prisma.quote.findUnique({
      where: { id },
      select: { id: true, number: true, userId: true, salesOrder: { select: { number: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (existing.salesOrder) {
      return NextResponse.json(
        { error: `Transaction has the following child records:\n\nSales Order ${existing.salesOrder.number}` },
        { status: 409 },
      )
    }

    await prisma.$transaction([
      prisma.quoteLineItem.deleteMany({ where: { quoteId: id } }),
      prisma.quote.delete({ where: { id } }),
    ])

    await logActivity({
      entityType: 'quote',
      entityId: id,
      action: 'delete',
      summary: `Deleted quote ${existing.number}`,
      userId: existing.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 })
  }
}
