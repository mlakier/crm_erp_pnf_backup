import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { generateNextInvoiceNumber } from '@/lib/invoice-number'

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
    const body = await request.json()
    const { salesOrderId } = body

    if (!salesOrderId) {
      return NextResponse.json({ error: 'Missing sales order id' }, { status: 400 })
    }

    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        customer: true,
        invoices: true,
      },
    })

    if (!salesOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    if (salesOrder.invoices.length > 0) {
      return NextResponse.json({ error: 'Invoice already exists for this sales order', invoiceId: salesOrder.invoices[0].id }, { status: 409 })
    }

    const number = await generateNextInvoiceNumber()
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    const invoice = await prisma.invoice.create({
      data: {
        number,
        status: 'draft',
        total: salesOrder.total,
        dueDate,
        customerId: salesOrder.customerId,
        salesOrderId: salesOrder.id,
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
    const { status, paidDate } = body

    if (!status) {
      return NextResponse.json({ error: 'Missing invoice status' }, { status: 400 })
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status,
        paidDate: status === 'paid' ? (paidDate ? new Date(paidDate) : new Date()) : null,
      },
    })

    const salesOrder = invoice.salesOrderId
      ? await prisma.salesOrder.findUnique({
          where: { id: invoice.salesOrderId },
          select: { userId: true },
        })
      : null

    await logActivity({
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'update',
      summary: `Updated invoice ${invoice.number} to status ${invoice.status}`,
      userId: salesOrder?.userId,
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
