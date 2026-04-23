import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createFieldChangeSummary, logActivity } from '@/lib/activity'
import { generateNextSalesOrderNumber } from '@/lib/sales-order-number'

export async function GET() {
  try {
    const salesOrders = await prisma.salesOrder.findMany({
      include: {
        customer: true,
        quote: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(salesOrders)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch sales orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { quoteId } = body

    if (!quoteId) {
      return NextResponse.json({ error: 'Missing quote id' }, { status: 400 })
    }

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: true,
        salesOrder: true,
        lineItems: true,
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.salesOrder) {
      return NextResponse.json({ error: 'Sales order already exists for this quote', salesOrderId: quote.salesOrder.id }, { status: 409 })
    }

    const number = await generateNextSalesOrderNumber()

    const salesOrder = await prisma.salesOrder.create({
      data: {
        number,
        status: 'draft',
        total: quote.total,
        customerId: quote.customerId,
        userId: quote.userId,
        quoteId: quote.id,
        subsidiaryId: quote.subsidiaryId,
        currencyId: quote.currencyId,
        lineItems: quote.lineItems.length
          ? {
              create: quote.lineItems.map((line) => ({
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lineTotal: line.lineTotal,
                notes: line.notes,
                itemId: line.itemId,
              })),
            }
          : undefined,
      },
    })

    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'accepted' },
    })

    await logActivity({
      entityType: 'sales-order',
      entityId: salesOrder.id,
      action: 'create',
      summary: `Created sales order ${salesOrder.number} from quote ${quote.number}`,
      userId: quote.userId,
    })

    await logActivity({
      entityType: 'quote',
      entityId: quote.id,
      action: 'update',
      summary: `Accepted quote ${quote.number} and created sales order ${salesOrder.number}`,
      userId: quote.userId,
    })

    return NextResponse.json(salesOrder, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create sales order' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing sales order id' }, { status: 400 })
    }

    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'Missing sales order status' }, { status: 400 })
    }

    const existingSalesOrder = await prisma.salesOrder.findUnique({
      where: { id },
      select: { id: true, number: true, status: true, userId: true },
    })

    if (!existingSalesOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    const salesOrder = await prisma.salesOrder.update({
      where: { id },
      data: { status },
    })

    await logActivity({
      entityType: 'sales-order',
      entityId: salesOrder.id,
      action: 'update',
      summary:
        existingSalesOrder.status !== salesOrder.status
          ? createFieldChangeSummary({
              context: 'UI',
              fieldName: 'Status',
              oldValue: existingSalesOrder.status ?? '',
              newValue: salesOrder.status ?? '',
            })
          : `Updated sales order ${salesOrder.number} to status ${salesOrder.status}`,
      userId: salesOrder.userId,
    })

    return NextResponse.json(salesOrder)
  } catch {
    return NextResponse.json({ error: 'Failed to update sales order' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing sales order id' }, { status: 400 })
    }

    const existing = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        userId: true,
        invoices: { select: { number: true }, orderBy: { createdAt: 'asc' } },
        fulfillments: { select: { number: true }, orderBy: { createdAt: 'asc' } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    const childRecords = [
      ...existing.invoices.map((invoice) => `Invoice ${invoice.number}`),
      ...existing.fulfillments.map((fulfillment) => `Fulfillment ${fulfillment.number}`),
    ]

    if (childRecords.length) {
      return NextResponse.json(
        { error: `Transaction has the following child records:\n\n${childRecords.join('\n')}` },
        { status: 409 },
      )
    }

    await prisma.$transaction([
      prisma.salesOrderLineItem.deleteMany({ where: { salesOrderId: id } }),
      prisma.salesOrder.delete({ where: { id } }),
    ])

    await logActivity({
      entityType: 'sales-order',
      entityId: id,
      action: 'delete',
      summary: `Deleted sales order ${existing.number}`,
      userId: existing.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete sales order' }, { status: 500 })
  }
}
