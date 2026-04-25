import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateFulfillmentNumber } from '@/lib/fulfillment-number'
import { logActivity, logCommunicationActivity, logFieldChangeActivities } from '@/lib/activity'

function toOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseDate(value: unknown, fallback?: Date | null) {
  if (typeof value !== 'string' || !value.trim()) return fallback ?? null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback ?? null : parsed
}

function parseQuantity(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, parsed)
}

function formatStatus(value: string | null) {
  if (!value) return 'Unknown'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

type FulfillmentLineInput = {
  salesOrderLineItemId: string | null
  quantity: number
  notes: string | null
}

async function buildSalesOrderLineAvailability(salesOrderId: string) {
  const salesOrder = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    include: {
      customer: true,
      quote: {
        include: {
          opportunity: true,
        },
      },
      user: { select: { id: true, userId: true, email: true } },
      subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
      currency: { select: { id: true, currencyId: true, code: true, name: true } },
      lineItems: {
        orderBy: { createdAt: 'asc' },
        include: {
          item: { select: { id: true, itemId: true, name: true } },
          fulfillmentLines: { select: { id: true, quantity: true } },
        },
      },
    },
  })

  if (!salesOrder) return null

  const lineAvailability = new Map(
    salesOrder.lineItems.map((line) => {
      const fulfilled = line.fulfillmentLines.reduce((sum, fulfillmentLine) => sum + fulfillmentLine.quantity, 0)
      return [
        line.id,
        {
          line,
          openQuantity: Math.max(0, line.quantity - fulfilled),
        },
      ]
    }),
  )

  return { salesOrder, lineAvailability }
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (id) {
      const row = await prisma.fulfillment.findUnique({
        where: { id },
        include: {
          salesOrder: {
            include: {
              customer: true,
              quote: { include: { opportunity: true } },
              user: { select: { id: true, userId: true, email: true } },
              subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
              currency: { select: { id: true, currencyId: true, code: true, name: true } },
              fulfillments: {
                orderBy: { createdAt: 'desc' },
                select: { id: true, number: true, status: true, date: true, notes: true },
              },
              invoices: {
                orderBy: { createdAt: 'desc' },
                include: {
                  cashReceipts: {
                    orderBy: { date: 'desc' },
                    select: { id: true, amount: true, date: true, method: true, reference: true },
                  },
                },
              },
              lineItems: {
                orderBy: { createdAt: 'asc' },
                include: {
                  item: { select: { id: true, itemId: true, name: true } },
                  fulfillmentLines: { select: { id: true, quantity: true } },
                },
              },
            },
          },
          subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        currency: { select: { id: true, currencyId: true, code: true, name: true } },
        lines: {
          orderBy: { id: 'asc' },
          include: {
            salesOrderLineItem: {
              include: {
                  item: { select: { id: true, itemId: true, name: true } },
                  fulfillmentLines: { select: { id: true, quantity: true } },
                },
              },
            },
          },
        },
      })
      return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const rows = await prisma.fulfillment.findMany({
      include: {
        salesOrder: { include: { customer: true } },
        subsidiary: true,
        currency: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch fulfillments' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.get('action') === 'send-email') {
      const { fulfillmentId, userId, to, from, subject, preview, attachPdf } = (await req.json()) as {
        fulfillmentId?: string
        userId?: string | null
        to?: string
        from?: string
        subject?: string
        preview?: string
        attachPdf?: boolean
      }

      if (!fulfillmentId || !to?.trim() || !subject?.trim()) {
        return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
      }

      const fulfillment = await prisma.fulfillment.findUnique({
        where: { id: fulfillmentId },
        select: { id: true },
      })
      if (!fulfillment) {
        return NextResponse.json({ error: 'Fulfillment not found' }, { status: 404 })
      }

      await logCommunicationActivity({
        entityType: 'fulfillment',
        entityId: fulfillmentId,
        userId: userId ?? null,
        context: 'UI',
        channel: 'Email',
        direction: 'Outbound',
        subject: subject.trim(),
        from: from?.trim() || '-',
        to: to.trim(),
        status: attachPdf ? 'Prepared (PDF)' : 'Prepared',
        preview: preview?.trim() || '',
      })

      return NextResponse.json({ success: true })
    }

    const body = await req.json()
    const salesOrderId = toOptionalString(body.salesOrderId)
    const status = toOptionalString(body.status) ?? 'pending'
    const notes = toOptionalString(body.notes)
    const subsidiaryId = toOptionalString(body.subsidiaryId)
    const currencyId = toOptionalString(body.currencyId)
    const date = parseDate(body.date, new Date()) ?? new Date()
    const linesInput = Array.isArray(body.lines) ? body.lines : []

    if (!salesOrderId) {
      return NextResponse.json({ error: 'Sales order is required' }, { status: 400 })
    }

    const availability = await buildSalesOrderLineAvailability(salesOrderId)
    if (!availability) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    const normalizedLines: FulfillmentLineInput[] = linesInput
      .map((line: { salesOrderLineItemId?: unknown; quantity?: unknown; notes?: unknown }) => ({
        salesOrderLineItemId: toOptionalString(line.salesOrderLineItemId),
        quantity: parseQuantity(line.quantity),
        notes: toOptionalString(line.notes),
      }))
    const typedLines = normalizedLines.filter(
      (line): line is FulfillmentLineInput & { salesOrderLineItemId: string } =>
        Boolean(line.salesOrderLineItemId) && line.quantity > 0,
    )

    if (typedLines.length === 0) {
      return NextResponse.json({ error: 'At least one fulfillment line with quantity is required' }, { status: 400 })
    }

    for (const line of typedLines) {
      const availableLine = availability.lineAvailability.get(line.salesOrderLineItemId)
      if (!availableLine) {
        return NextResponse.json({ error: 'One or more sales order lines are invalid' }, { status: 400 })
      }
      if (line.quantity > availableLine.openQuantity) {
        return NextResponse.json({ error: 'A fulfillment quantity exceeds the remaining open quantity' }, { status: 400 })
      }
    }

    const number = await generateFulfillmentNumber()
    const row = await prisma.fulfillment.create({
      data: {
        number,
        status,
        date,
        notes,
        salesOrderId,
        subsidiaryId: subsidiaryId ?? availability.salesOrder.subsidiaryId,
        currencyId: currencyId ?? availability.salesOrder.currencyId,
        lines: {
          create: typedLines.map((line) => ({
            salesOrderLineItemId: line.salesOrderLineItemId,
            quantity: line.quantity,
            notes: line.notes,
          })),
        },
      },
    })

    await logActivity({
      entityType: 'fulfillment',
      entityId: row.id,
      action: 'create',
      summary: `Created fulfillment ${row.number} from sales order ${availability.salesOrder.number}`,
      userId: availability.salesOrder.userId,
    })

    return NextResponse.json(row, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create fulfillment' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json()
    const existing = await prisma.fulfillment.findUnique({
      where: { id },
      include: {
        salesOrder: {
          include: {
            user: { select: { id: true, userId: true, email: true } },
            lineItems: {
              include: {
                fulfillmentLines: { select: { id: true, quantity: true } },
              },
            },
          },
        },
        subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        currency: { select: { id: true, currencyId: true, code: true, name: true } },
        lines: true,
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Fulfillment not found' }, { status: 404 })
    }

    const nextStatus = toOptionalString(body.status) ?? existing.status
    const nextNotes = body.notes === '' ? null : toOptionalString(body.notes) ?? existing.notes
    const nextDate = parseDate(body.date, existing.date) ?? existing.date
    const nextSubsidiaryId =
      body.subsidiaryId === '' ? null : toOptionalString(body.subsidiaryId) ?? existing.subsidiaryId
    const nextCurrencyId =
      body.currencyId === '' ? null : toOptionalString(body.currencyId) ?? existing.currencyId

    const updated = await prisma.fulfillment.update({
      where: { id },
      data: {
        status: nextStatus,
        notes: nextNotes,
        date: nextDate,
        subsidiaryId: nextSubsidiaryId,
        currencyId: nextCurrencyId,
      },
      include: {
        subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        currency: { select: { id: true, currencyId: true, code: true, name: true } },
      },
    })

    const changes = [
      existing.status !== updated.status
        ? { fieldName: 'Status', oldValue: formatStatus(existing.status), newValue: formatStatus(updated.status) }
        : null,
      String(existing.notes ?? '') !== String(updated.notes ?? '')
        ? { fieldName: 'Notes', oldValue: existing.notes ?? '-', newValue: updated.notes ?? '-' }
        : null,
      String(existing.date) !== String(updated.date)
        ? { fieldName: 'Fulfillment Date', oldValue: existing.date.toISOString(), newValue: updated.date.toISOString() }
        : null,
      existing.subsidiaryId !== updated.subsidiaryId
        ? {
            fieldName: 'Subsidiary',
            oldValue: existing.subsidiary ? `${existing.subsidiary.subsidiaryId} - ${existing.subsidiary.name}` : '-',
            newValue: updated.subsidiary ? `${updated.subsidiary.subsidiaryId} - ${updated.subsidiary.name}` : '-',
          }
        : null,
      existing.currencyId !== updated.currencyId
        ? {
            fieldName: 'Currency',
            oldValue: existing.currency ? `${existing.currency.code ?? existing.currency.currencyId} - ${existing.currency.name}` : '-',
            newValue: updated.currency ? `${updated.currency.code ?? updated.currency.currencyId} - ${updated.currency.name}` : '-',
          }
        : null,
    ].filter((change): change is { fieldName: string; oldValue: string; newValue: string } => Boolean(change))

    await logActivity({
      entityType: 'fulfillment',
      entityId: id,
      action: 'update',
      summary: `Updated fulfillment ${updated.number}`,
      userId: existing.salesOrder?.userId ?? existing.salesOrder?.user?.id ?? null,
    })

    await logFieldChangeActivities({
      entityType: 'fulfillment',
      entityId: id,
      userId: existing.salesOrder?.userId ?? existing.salesOrder?.user?.id ?? null,
      context: 'Header',
      changes,
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update fulfillment' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const existing = await prisma.fulfillment.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        salesOrder: { select: { userId: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Fulfillment not found' }, { status: 404 })
    }

    await prisma.fulfillment.delete({ where: { id } })

    await logActivity({
      entityType: 'fulfillment',
      entityId: id,
      action: 'delete',
      summary: `Deleted fulfillment ${existing.number}`,
      userId: existing.salesOrder?.userId,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete fulfillment' }, { status: 500 })
  }
}
