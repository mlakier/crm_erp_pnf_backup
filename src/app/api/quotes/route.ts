import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { generateNextQuoteNumber } from '@/lib/quote-number'

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
    const { opportunityId } = body

    if (!opportunityId) {
      return NextResponse.json({ error: 'Missing opportunity id' }, { status: 400 })
    }

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        customer: true,
        quote: true,
      },
    })

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    if (opportunity.quote) {
      return NextResponse.json({ error: 'Quote already exists for this opportunity', quoteId: opportunity.quote.id }, { status: 409 })
    }

    const number = await generateNextQuoteNumber()
    const validUntil = opportunity.closeDate
      ? new Date(opportunity.closeDate)
      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)

    const quote = await prisma.quote.create({
      data: {
        number,
        status: 'draft',
        total: opportunity.amount ?? 0,
        validUntil,
        notes: `Generated from opportunity ${opportunity.opportunityNumber ?? opportunity.name}`,
        customerId: opportunity.customerId,
        userId: opportunity.userId,
        opportunityId: opportunity.id,
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
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'Missing quote status' }, { status: 400 })
    }

    const quote = await prisma.quote.update({
      where: { id },
      data: { status },
    })

    await logActivity({
      entityType: 'quote',
      entityId: quote.id,
      action: 'update',
      summary: `Updated quote ${quote.number} to status ${quote.status}`,
      userId: quote.userId,
    })

    return NextResponse.json(quote)
  } catch {
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
  }
}