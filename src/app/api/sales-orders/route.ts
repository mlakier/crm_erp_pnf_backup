import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createFieldChangeSummary, logActivity } from '@/lib/activity'
import { generateNextSalesOrderNumber } from '@/lib/sales-order-number'
import { calcLineTotal, sumMoney } from '@/lib/money'
import { toNumericValue } from '@/lib/format'

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
    const { quoteId, duplicateFrom, number, customerId, userId, subsidiaryId, currencyId, status, lineItems } = body

    if (duplicateFrom) {
      const sourceSalesOrder = await prisma.salesOrder.findUnique({
        where: { id: duplicateFrom },
        include: {
          lineItems: true,
        },
      })

      if (!sourceSalesOrder) {
        return NextResponse.json({ error: 'Source sales order not found' }, { status: 404 })
      }

      const generatedNumber = await generateNextSalesOrderNumber()
      const normalizedLineItems = sourceSalesOrder.lineItems.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: toNumericValue(line.unitPrice),
        lineTotal: calcLineTotal(line.quantity, line.unitPrice),
        notes: line.notes,
        itemId: line.itemId,
      }))

      const duplicatedSalesOrder = await prisma.salesOrder.create({
        data: {
          number: generatedNumber,
          status: 'draft',
          total: toNumericValue(sourceSalesOrder.total),
          customerId: sourceSalesOrder.customerId,
          userId: sourceSalesOrder.userId,
          quoteId: null,
          subsidiaryId: sourceSalesOrder.subsidiaryId,
          currencyId: sourceSalesOrder.currencyId,
          lineItems: normalizedLineItems.length
            ? {
                create: normalizedLineItems,
              }
            : undefined,
        },
      })

      await logActivity({
        entityType: 'sales-order',
        entityId: duplicatedSalesOrder.id,
        action: 'create',
        summary: `Duplicated sales order ${sourceSalesOrder.number} into ${duplicatedSalesOrder.number}`,
        userId: duplicatedSalesOrder.userId,
      })

      return NextResponse.json(duplicatedSalesOrder, { status: 201 })
    }

    if (!quoteId) {
      if (!number || !customerId || !userId) {
        return NextResponse.json({ error: 'Missing required sales order fields' }, { status: 400 })
      }

      const normalizedLineItems = Array.isArray(lineItems)
        ? lineItems
            .map((line) => {
              const quantity = Number(line?.quantity ?? 0)
              const unitPrice = Number(line?.unitPrice ?? 0)
              const description = String(line?.description ?? '').trim()
              if (!description) return null
              return {
                description,
                quantity,
                unitPrice,
                lineTotal: calcLineTotal(quantity, unitPrice),
                itemId: line?.itemId || null,
              }
            })
            .filter((line): line is { description: string; quantity: number; unitPrice: number; lineTotal: number; itemId: string | null } => Boolean(line))
        : []

      const createdSalesOrder = await prisma.salesOrder.create({
        data: {
          number: String(number).trim(),
          status: typeof status === 'string' && status.trim() ? status.trim() : 'draft',
          total: normalizedLineItems.length ? sumMoney(normalizedLineItems.map((line) => line.lineTotal)) : 0,
          customerId: String(customerId),
          userId: String(userId),
          quoteId: quoteId || null,
          subsidiaryId: subsidiaryId || null,
          currencyId: currencyId || null,
          lineItems: normalizedLineItems.length
            ? {
                create: normalizedLineItems,
              }
            : undefined,
        },
      })

      await logActivity({
        entityType: 'sales-order',
        entityId: createdSalesOrder.id,
        action: 'create',
        summary: `Created sales order ${createdSalesOrder.number}`,
        userId: createdSalesOrder.userId,
      })

      return NextResponse.json(createdSalesOrder, { status: 201 })
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

    const generatedNumber = await generateNextSalesOrderNumber()
    const normalizedLineItems = quote.lineItems.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: toNumericValue(line.unitPrice),
      lineTotal: calcLineTotal(line.quantity, line.unitPrice),
      notes: line.notes,
      itemId: line.itemId,
    }))
    const total = normalizedLineItems.length
      ? sumMoney(normalizedLineItems.map((line) => line.lineTotal))
      : toNumericValue(quote.total)

    const salesOrder = await prisma.salesOrder.create({
      data: {
        number: generatedNumber,
        status: 'draft',
        total,
        customerId: quote.customerId,
        userId: quote.userId,
        quoteId: quote.id,
        subsidiaryId: quote.subsidiaryId,
        currencyId: quote.currencyId,
        lineItems: normalizedLineItems.length
          ? {
              create: normalizedLineItems,
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
    const { number, status, subsidiaryId, currencyId } = body

    const existingSalesOrder = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        status: true,
        subsidiaryId: true,
        currencyId: true,
        userId: true,
      },
    })

    if (!existingSalesOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    const nextNumber = typeof number === 'string' ? number.trim() : existingSalesOrder.number
    const nextStatus = typeof status === 'string' ? status.trim() : existingSalesOrder.status
    const nextSubsidiaryId =
      subsidiaryId === undefined ? existingSalesOrder.subsidiaryId : subsidiaryId || null
    const nextCurrencyId =
      currencyId === undefined ? existingSalesOrder.currencyId : currencyId || null

    if (!nextNumber) {
      return NextResponse.json({ error: 'Missing sales order number' }, { status: 400 })
    }
    if (!nextStatus) {
      return NextResponse.json({ error: 'Missing sales order status' }, { status: 400 })
    }

    const salesOrder = await prisma.salesOrder.update({
      where: { id },
      data: {
        number: nextNumber,
        status: nextStatus,
        subsidiaryId: nextSubsidiaryId,
        currencyId: nextCurrencyId,
      },
    })

    const changeSummaries = [
      existingSalesOrder.number !== salesOrder.number
        ? createFieldChangeSummary({
            context: 'UI',
            fieldName: 'Sales Order Id',
            oldValue: existingSalesOrder.number ?? '',
            newValue: salesOrder.number ?? '',
          })
        : null,
      existingSalesOrder.status !== salesOrder.status
        ? createFieldChangeSummary({
            context: 'UI',
            fieldName: 'Status',
            oldValue: existingSalesOrder.status ?? '',
            newValue: salesOrder.status ?? '',
          })
        : null,
      existingSalesOrder.subsidiaryId !== salesOrder.subsidiaryId
        ? createFieldChangeSummary({
            context: 'UI',
            fieldName: 'Subsidiary',
            oldValue: existingSalesOrder.subsidiaryId ?? '',
            newValue: salesOrder.subsidiaryId ?? '',
          })
        : null,
      existingSalesOrder.currencyId !== salesOrder.currencyId
        ? createFieldChangeSummary({
            context: 'UI',
            fieldName: 'Currency',
            oldValue: existingSalesOrder.currencyId ?? '',
            newValue: salesOrder.currencyId ?? '',
          })
        : null,
    ].filter((summary): summary is string => Boolean(summary))

    if (changeSummaries.length === 0) {
      await logActivity({
        entityType: 'sales-order',
        entityId: salesOrder.id,
        action: 'update',
        summary: `Updated sales order ${salesOrder.number}`,
        userId: salesOrder.userId,
      })
    } else {
      for (const summary of changeSummaries) {
        await logActivity({
          entityType: 'sales-order',
          entityId: salesOrder.id,
          action: 'update',
          summary,
          userId: salesOrder.userId,
        })
      }
    }

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
