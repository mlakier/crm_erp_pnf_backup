import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity, logCommunicationActivity, logFieldChangeActivities } from '@/lib/activity'
import { generateNextInvoiceNumber } from '@/lib/invoice-number'
import { calcLineTotal, sumMoney } from '@/lib/money'
import { toNumericValue } from '@/lib/format'

export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        customer: true,
        salesOrder: true,
        cashReceipts: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invoices)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('action') === 'send-email') {
      const {
        invoiceId,
        userId,
        to,
        from,
        subject,
        preview,
        attachPdf,
      } = (await request.json()) as {
        invoiceId?: string
        userId?: string | null
        to?: string
        from?: string
        subject?: string
        preview?: string
        attachPdf?: boolean
      }

      if (!invoiceId || !to?.trim() || !subject?.trim()) {
        return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true },
      })

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }

      await logCommunicationActivity({
        entityType: 'invoice',
        entityId: invoiceId,
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

    const body = await request.json()
    const duplicateFrom =
      typeof body.duplicateFrom === 'string' && body.duplicateFrom.trim() ? body.duplicateFrom.trim() : null
    const salesOrderId = typeof body.salesOrderId === 'string' && body.salesOrderId.trim() ? body.salesOrderId.trim() : null
    const customerId = typeof body.customerId === 'string' && body.customerId.trim() ? body.customerId.trim() : null
    const subsidiaryId = typeof body.subsidiaryId === 'string' && body.subsidiaryId.trim() ? body.subsidiaryId.trim() : null
    const currencyId = typeof body.currencyId === 'string' && body.currencyId.trim() ? body.currencyId.trim() : null
    const status =
      typeof body.status === 'string' && body.status.trim()
        ? body.status.trim()
        : 'draft'
    const providedDueDate =
      typeof body.dueDate === 'string' && body.dueDate.trim() ? new Date(body.dueDate) : null
    const paidDate =
      typeof body.paidDate === 'string' && body.paidDate.trim() ? new Date(body.paidDate) : null
    const number = await generateNextInvoiceNumber()

    if (duplicateFrom) {
      const sourceInvoice = await prisma.invoice.findUnique({
        where: { id: duplicateFrom },
        include: {
          lineItems: true,
        },
      })

      if (!sourceInvoice) {
        return NextResponse.json({ error: 'Source invoice not found' }, { status: 404 })
      }

      const normalizedLineItems = sourceInvoice.lineItems.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: toNumericValue(line.unitPrice),
        lineTotal: calcLineTotal(line.quantity, line.unitPrice),
        notes: line.notes,
        itemId: line.itemId,
        departmentId: line.departmentId,
        locationId: line.locationId,
        projectId: line.projectId,
        serviceStartDate: line.serviceStartDate,
        serviceEndDate: line.serviceEndDate,
        revRecTemplateId: line.revRecTemplateId,
        performanceObligationCode: line.performanceObligationCode,
        standaloneSellingPrice: line.standaloneSellingPrice,
        allocatedAmount: line.allocatedAmount,
      }))
      const total = normalizedLineItems.length
        ? sumMoney(normalizedLineItems.map((line) => line.lineTotal))
        : toNumericValue(sourceInvoice.total)

      const invoice = await prisma.invoice.create({
        data: {
          number,
          status: 'draft',
          total,
          dueDate: providedDueDate ?? sourceInvoice.dueDate,
          paidDate: null,
          customerId: sourceInvoice.customerId,
          salesOrderId: sourceInvoice.salesOrderId,
          userId: sourceInvoice.userId,
          subsidiaryId: subsidiaryId ?? sourceInvoice.subsidiaryId,
          currencyId: currencyId ?? sourceInvoice.currencyId,
          lineItems: normalizedLineItems.length
            ? {
                create: normalizedLineItems,
              }
            : undefined,
        },
      })

      await logActivity({
        entityType: 'invoice',
        entityId: invoice.id,
        action: 'create',
        summary: `Duplicated invoice ${sourceInvoice.number} into ${invoice.number}`,
        userId: invoice.userId,
      })

      return NextResponse.json(invoice, { status: 201 })
    }

    if (!salesOrderId && !customerId) {
      return NextResponse.json({ error: 'Customer is required when no sales order is selected' }, { status: 400 })
    }

    if (!salesOrderId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId! },
        select: {
          id: true,
          customerId: true,
          name: true,
          userId: true,
          subsidiaryId: true,
          currencyId: true,
        },
      })

      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }

      const invoice = await prisma.invoice.create({
        data: {
          number,
          status,
          total: 0,
          dueDate: providedDueDate,
          paidDate,
          customerId: customer.id,
          userId: customer.userId,
          subsidiaryId: subsidiaryId ?? customer.subsidiaryId,
          currencyId: currencyId ?? customer.currencyId,
        },
      })

      await logActivity({
        entityType: 'invoice',
        entityId: invoice.id,
        action: 'create',
        summary: `Created invoice ${invoice.number} for customer ${customer.customerId ?? customer.name}`,
        userId: customer.userId,
      })

      return NextResponse.json(invoice, { status: 201 })
    }

    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        customer: true,
        invoices: true,
        lineItems: true,
      },
    })

    if (!salesOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    if (salesOrder.invoices.length > 0) {
      return NextResponse.json({ error: 'Invoice already exists for this sales order', invoiceId: salesOrder.invoices[0].id }, { status: 409 })
    }
    const defaultDueDate = new Date()
    defaultDueDate.setDate(defaultDueDate.getDate() + 30)
    const normalizedLineItems = salesOrder.lineItems.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: toNumericValue(line.unitPrice),
      lineTotal: calcLineTotal(line.quantity, line.unitPrice),
      notes: line.notes,
      itemId: line.itemId,
    }))
    const total = normalizedLineItems.length
      ? sumMoney(normalizedLineItems.map((line) => line.lineTotal))
      : toNumericValue(salesOrder.total)

    const invoice = await prisma.invoice.create({
        data: {
          number,
        status,
        total,
        dueDate: providedDueDate ?? defaultDueDate,
        paidDate,
        customerId: salesOrder.customerId,
        salesOrderId: salesOrder.id,
        userId: salesOrder.userId,
        subsidiaryId: subsidiaryId ?? salesOrder.subsidiaryId,
        currencyId: currencyId ?? salesOrder.currencyId,
        lineItems: normalizedLineItems.length
          ? {
              create: normalizedLineItems,
            }
          : undefined,
      },
    })

    await logActivity({
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'create',
      summary: `Created invoice ${invoice.number} from sales order ${salesOrder.number}`,
      userId: salesOrder.userId,
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 })
    }

    const body = await request.json()
    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: {
        user: { select: { userId: true } },
        subsidiary: { select: { subsidiaryId: true, name: true } },
        currency: { select: { currencyId: true, code: true, name: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const nextStatus = typeof body.status === 'string' ? body.status : existing.status
    const nextNumber = typeof body.number === 'string' && body.number.trim() ? body.number.trim() : existing.number
    const nextSubsidiaryId =
      body.subsidiaryId === '' ? null : typeof body.subsidiaryId === 'string' ? body.subsidiaryId : existing.subsidiaryId
    const nextCurrencyId =
      body.currencyId === '' ? null : typeof body.currencyId === 'string' ? body.currencyId : existing.currencyId
    const nextDueDate =
      body.dueDate === ''
        ? null
        : typeof body.dueDate === 'string'
          ? new Date(body.dueDate)
          : existing.dueDate
    const nextPaidDate =
      body.paidDate === ''
        ? null
        : typeof body.paidDate === 'string'
          ? new Date(body.paidDate)
          : nextStatus === 'paid'
            ? existing.paidDate ?? new Date()
            : null

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        number: nextNumber,
        status: nextStatus,
        subsidiaryId: nextSubsidiaryId,
        currencyId: nextCurrencyId,
        dueDate: nextDueDate,
        paidDate: nextStatus === 'paid' ? nextPaidDate ?? new Date() : nextPaidDate,
      },
      include: {
        user: { select: { userId: true } },
        subsidiary: { select: { subsidiaryId: true, name: true } },
        currency: { select: { currencyId: true, code: true, name: true } },
      },
    })

    const changes = [
      existing.number !== invoice.number
        ? { fieldName: 'Invoice #', oldValue: existing.number, newValue: invoice.number }
        : null,
      existing.status !== invoice.status
        ? { fieldName: 'Status', oldValue: existing.status ?? '-', newValue: invoice.status ?? '-' }
        : null,
      existing.subsidiaryId !== invoice.subsidiaryId
        ? {
            fieldName: 'Subsidiary',
            oldValue: existing.subsidiary ? `${existing.subsidiary.subsidiaryId} - ${existing.subsidiary.name}` : '-',
            newValue: invoice.subsidiary ? `${invoice.subsidiary.subsidiaryId} - ${invoice.subsidiary.name}` : '-',
          }
        : null,
      existing.currencyId !== invoice.currencyId
        ? {
            fieldName: 'Currency',
            oldValue: existing.currency ? `${existing.currency.code ?? existing.currency.currencyId} - ${existing.currency.name}` : '-',
            newValue: invoice.currency ? `${invoice.currency.code ?? invoice.currency.currencyId} - ${invoice.currency.name}` : '-',
          }
        : null,
      String(existing.dueDate ?? '') !== String(invoice.dueDate ?? '')
        ? {
            fieldName: 'Due Date',
            oldValue: existing.dueDate ? existing.dueDate.toISOString() : '-',
            newValue: invoice.dueDate ? invoice.dueDate.toISOString() : '-',
          }
        : null,
      String(existing.paidDate ?? '') !== String(invoice.paidDate ?? '')
        ? {
            fieldName: 'Paid Date',
            oldValue: existing.paidDate ? existing.paidDate.toISOString() : '-',
            newValue: invoice.paidDate ? invoice.paidDate.toISOString() : '-',
          }
        : null,
    ].filter((change): change is { fieldName: string; oldValue: string; newValue: string } => Boolean(change))

    await logActivity({
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'update',
      summary: `Updated invoice ${invoice.number} to status ${invoice.status}`,
      userId: existing.userId,
    })

    await logFieldChangeActivities({
      entityType: 'invoice',
      entityId: invoice.id,
      userId: existing.userId,
      context: 'Header',
      changes,
    })

    return NextResponse.json(invoice)
  } catch {
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 })
    }

    const existing = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        userId: true,
        salesOrder: { select: { userId: true } },
        cashReceipts: { select: { number: true, id: true }, orderBy: { createdAt: 'asc' } },
        creditMemos: { select: { number: true }, orderBy: { createdAt: 'asc' } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const childRecords = [
      ...existing.cashReceipts.map((receipt) => `Invoice Receipt ${receipt.number ?? receipt.id}`),
      ...existing.creditMemos.map((creditMemo) => `Credit Memo ${creditMemo.number}`),
    ]

    if (childRecords.length) {
      return NextResponse.json(
        { error: `Transaction has the following child records:\n\n${childRecords.join('\n')}` },
        { status: 409 },
      )
    }

    await prisma.$transaction([
      prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } }),
      prisma.invoice.delete({ where: { id } }),
    ])

    await logActivity({
      entityType: 'invoice',
      entityId: id,
      action: 'delete',
      summary: `Deleted invoice ${existing.number}`,
      userId: existing.userId ?? existing.salesOrder?.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
