import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity, logCommunicationActivity, logFieldChangeActivities, logRecordSnapshotActivities } from '@/lib/activity'
import { canReceivePurchaseOrderLine } from '@/lib/item-business-rules'
import { syncReceiptQuantity } from '@/lib/receipt-quantity'
import { generateNextJournalNumber } from '@/lib/journal-number'

type ReceiptLineInput = {
  purchaseOrderLineItemId: string
  quantity: number
  notes: string | null
}

async function findReceiptPostingAccounts() {
  const receiptOffsetAccount =
    await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Liability',
        OR: [
          { name: { contains: 'Received Not Billed', mode: 'insensitive' } },
          { name: { contains: 'Accrued Purchases', mode: 'insensitive' } },
          { name: { contains: 'Accrued Expenses', mode: 'insensitive' } },
          { accountId: '2100' },
        ],
      },
      select: { id: true },
    })
    ?? await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Liability',
      },
      select: { id: true },
    })

  const fallbackInventoryAccount =
    await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Asset',
        OR: [
          { inventory: true },
          { name: { contains: 'Inventory', mode: 'insensitive' } },
          { accountId: { in: ['1200', '1210'] } },
        ],
      },
      select: { id: true },
    })

  return {
    receiptOffsetAccountId: receiptOffsetAccount?.id ?? null,
    fallbackInventoryAccountId: fallbackInventoryAccount?.id ?? null,
  }
}

async function postReceiptJournal(receiptId: string) {
  const existingJournal = await prisma.journalEntry.findFirst({
    where: { sourceType: 'receipt', sourceId: receiptId },
    select: { id: true },
  })
  if (existingJournal) return

  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      purchaseOrder: {
        select: {
          id: true,
          number: true,
          vendorId: true,
          userId: true,
          subsidiaryId: true,
          currencyId: true,
        },
      },
      lines: {
        include: {
          purchaseOrderLineItem: {
            select: {
              id: true,
              description: true,
              unitPrice: true,
              itemId: true,
              item: {
                select: {
                  id: true,
                  name: true,
                  inventoryAccountId: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!receipt || receipt.status.toLowerCase() !== 'received' || receipt.lines.length === 0) return

  const { receiptOffsetAccountId, fallbackInventoryAccountId } = await findReceiptPostingAccounts()
  if (!receiptOffsetAccountId) return

  const debitLines = receipt.lines
    .map((line, index) => {
      const unitPrice = Number(line.purchaseOrderLineItem?.unitPrice ?? 0)
      const quantity = Number(line.quantity ?? 0)
      const amount = unitPrice * quantity
      if (!Number.isFinite(amount) || amount <= 0) return null

      const inventoryAccountId =
        line.purchaseOrderLineItem?.item?.inventoryAccountId ?? fallbackInventoryAccountId
      if (!inventoryAccountId) return null

      return {
        displayOrder: index,
        description:
          line.purchaseOrderLineItem?.description
          || line.purchaseOrderLineItem?.item?.name
          || `Inventory receipt ${receipt.purchaseOrder.number}`,
        memo: line.notes ?? null,
        debit: amount,
        credit: 0,
        accountId: inventoryAccountId,
        subsidiaryId: receipt.purchaseOrder.subsidiaryId,
        vendorId: receipt.purchaseOrder.vendorId,
        itemId: line.purchaseOrderLineItem?.itemId ?? null,
      }
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))

  const totalDebit = debitLines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0)
  if (!debitLines.length || totalDebit <= 0) return

  const journalNumber = await generateNextJournalNumber()

  await prisma.journalEntry.create({
    data: {
      number: journalNumber,
      date: receipt.date,
      description: `Receipt ${receipt.id} inventory posting`,
      journalType: 'standard',
      status: 'approved',
      total: totalDebit,
      sourceType: 'receipt',
      sourceId: receipt.id,
      subsidiaryId: receipt.purchaseOrder.subsidiaryId,
      currencyId: receipt.purchaseOrder.currencyId,
      userId: receipt.purchaseOrder.userId,
      lineItems: {
        create: [
          ...debitLines,
          {
            displayOrder: debitLines.length,
            description: `${receipt.purchaseOrder.number} receipt offset`,
            memo: receipt.notes ?? null,
            debit: 0,
            credit: totalDebit,
            accountId: receiptOffsetAccountId,
            subsidiaryId: receipt.purchaseOrder.subsidiaryId,
            vendorId: receipt.purchaseOrder.vendorId,
          },
        ],
      },
    },
  })

  await logActivity({
    entityType: 'receipt',
    entityId: receipt.id,
    action: 'post',
    summary: `Posted receipt ${receipt.id} to GL`,
    userId: receipt.purchaseOrder.userId,
  })
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const body = await request.json()
    if (searchParams.get('action') === 'send-email') {
      const {
        receiptId,
        userId,
        to,
        from,
        subject,
        preview,
        attachPdf,
      } = body as {
        receiptId?: string
        userId?: string | null
        to?: string
        from?: string
        subject?: string
        preview?: string
        attachPdf?: boolean
      }

      if (!receiptId || !to?.trim() || !subject?.trim()) {
        return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
      }

      const receipt = await prisma.receipt.findUnique({
        where: { id: receiptId },
        select: { id: true },
      })

      if (!receipt) {
        return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
      }

      await logCommunicationActivity({
        entityType: 'receipt',
        entityId: receiptId,
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

    const { purchaseOrderId, quantity, date, status, notes, userId, lineItems, subsidiaryId, currencyId } = body

    if (!purchaseOrderId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const normalizedLines: ReceiptLineInput[] = Array.isArray(lineItems)
      ? lineItems
          .map((line) => {
            const purchaseOrderLineItemId =
              typeof line?.purchaseOrderLineItemId === 'string' ? line.purchaseOrderLineItemId.trim() : ''
            const parsedLineQuantity = Number.parseInt(String(line?.receiptQuantity ?? line?.quantity ?? ''), 10)
            const lineNotes = typeof line?.notes === 'string' && line.notes.trim() ? line.notes.trim() : null
            if (!purchaseOrderLineItemId || !Number.isFinite(parsedLineQuantity) || parsedLineQuantity <= 0) {
              return null
            }
            return {
              purchaseOrderLineItemId,
              quantity: parsedLineQuantity,
              notes: lineNotes,
            }
          })
          .filter((line): line is ReceiptLineInput => Boolean(line))
      : []

    const parsedQuantity = Number.parseInt(String(quantity), 10)
    const hasHeaderQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0
    if (!hasHeaderQuantity && normalizedLines.length === 0) {
      return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 })
    }

    const purchaseOrderForReceipt = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        number: true,
        subsidiaryId: true,
        currencyId: true,
        lineItems: {
          select: {
            id: true,
            quantity: true,
            item: { select: { dropShipItem: true, specialOrderItem: true } },
            receiptLines: { select: { id: true, quantity: true } },
          },
        },
      },
    })

    if (!purchaseOrderForReceipt) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (
      subsidiaryId
      && purchaseOrderForReceipt.subsidiaryId
      && subsidiaryId !== purchaseOrderForReceipt.subsidiaryId
    ) {
      return NextResponse.json({ error: 'Receipt subsidiary must match the linked purchase order subsidiary' }, { status: 400 })
    }

    if (
      currencyId
      && purchaseOrderForReceipt.currencyId
      && currencyId !== purchaseOrderForReceipt.currencyId
    ) {
      return NextResponse.json({ error: 'Receipt currency must match the linked purchase order currency' }, { status: 400 })
    }

    const receivableLines = purchaseOrderForReceipt.lineItems.filter((line) => canReceivePurchaseOrderLine(line.item))
    const hasReceivableLine = receivableLines.length > 0
    if (!hasReceivableLine) {
      return NextResponse.json({ error: 'This purchase order has no receivable lines. Drop ship items cannot be received.' }, { status: 400 })
    }

    if (normalizedLines.length > 0) {
      for (const line of normalizedLines) {
        const purchaseOrderLine = purchaseOrderForReceipt.lineItems.find((candidate) => candidate.id === line.purchaseOrderLineItemId)
        if (!purchaseOrderLine) {
          return NextResponse.json({ error: 'Receipt line references an invalid purchase order line' }, { status: 400 })
        }
        if (!canReceivePurchaseOrderLine(purchaseOrderLine.item)) {
          return NextResponse.json({ error: 'This purchase order line cannot be received' }, { status: 400 })
        }
        const alreadyReceived = purchaseOrderLine.receiptLines.reduce((sum, receiptLine) => sum + receiptLine.quantity, 0)
        const openQuantity = Math.max(0, purchaseOrderLine.quantity - alreadyReceived)
        if (line.quantity > openQuantity) {
          return NextResponse.json({ error: 'Receipt quantity exceeds the remaining open quantity' }, { status: 400 })
        }
      }
    }

    const initialQuantity =
      normalizedLines.length > 0
        ? normalizedLines.reduce((sum, line) => sum + line.quantity, 0)
        : parsedQuantity

    const receipt = await prisma.receipt.create({
      data: {
        purchaseOrderId,
        subsidiaryId: purchaseOrderForReceipt.subsidiaryId ?? null,
        currencyId: purchaseOrderForReceipt.currencyId ?? null,
        quantity: initialQuantity,
        date: date ? new Date(date) : new Date(),
        status: status || 'pending',
        notes: notes || null,
        lines:
          normalizedLines.length > 0
            ? {
                create: normalizedLines.map((line) => ({
                  purchaseOrderLineItemId: line.purchaseOrderLineItemId,
                  quantity: line.quantity,
                  notes: line.notes,
                })),
              }
            : undefined,
      },
    })

    if (normalizedLines.length > 0) {
      await syncReceiptQuantity(receipt.id)
    }
    if ((receipt.status ?? '').toLowerCase() === 'received') {
      await postReceiptJournal(receipt.id)
    }

    await logActivity({
      entityType: 'receipt',
      entityId: receipt.id,
      action: 'create',
      summary: `Created receipt ${receipt.id}`,
      userId,
    })
    await logRecordSnapshotActivities({
      entityType: 'receipt',
      entityId: receipt.id,
      userId,
      action: 'create',
      context: 'Receipt Details',
      fields: [
        { fieldName: 'Purchase Order', value: receipt.purchaseOrderId },
        { fieldName: 'Subsidiary', value: receipt.subsidiaryId ?? '-' },
        { fieldName: 'Currency', value: receipt.currencyId ?? '-' },
        { fieldName: 'Quantity', value: receipt.quantity },
        { fieldName: 'Date', value: receipt.date },
        { fieldName: 'Status', value: receipt.status },
        { fieldName: 'Notes', value: receipt.notes },
      ],
    })

    await logActivity({
      entityType: 'purchase-order',
      entityId: purchaseOrderId,
      action: 'update',
      summary: `Recorded receipt for purchase order ${purchaseOrderForReceipt.number ?? purchaseOrderId}`,
      userId,
    })

    return NextResponse.json(receipt, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create receipt' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing receipt id' }, { status: 400 })
    }

    const existing = await prisma.receipt.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    await prisma.receipt.delete({ where: { id } })

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: existing.purchaseOrderId },
      select: { number: true, userId: true },
    })

    await logActivity({
      entityType: 'receipt',
      entityId: existing.id,
      action: 'delete',
      summary: `Deleted receipt ${existing.id}`,
      userId: purchaseOrder?.userId,
    })
    await logRecordSnapshotActivities({
      entityType: 'receipt',
      entityId: existing.id,
      userId: purchaseOrder?.userId ?? null,
      action: 'delete',
      context: 'Receipt Details',
      fields: [
        { fieldName: 'Purchase Order', value: existing.purchaseOrderId },
        { fieldName: 'Quantity', value: existing.quantity },
        { fieldName: 'Date', value: existing.date },
        { fieldName: 'Status', value: existing.status },
        { fieldName: 'Notes', value: existing.notes },
      ],
    })

    await logActivity({
      entityType: 'purchase-order',
      entityId: existing.purchaseOrderId,
      action: 'update',
      summary: `Deleted receipt from purchase order ${purchaseOrder?.number ?? existing.purchaseOrderId}`,
      userId: purchaseOrder?.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete receipt' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing receipt id' }, { status: 400 })

    const body = await request.json()
    const before = await prisma.receipt.findUnique({ where: { id } })
    if (!before) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.status !== undefined) data.status = body.status
    const hasExistingLines = await prisma.receiptLine.count({ where: { receiptId: id } })
    if (body.quantity !== undefined && hasExistingLines === 0) data.quantity = Number(body.quantity)
    if (body.notes !== undefined) data.notes = body.notes || null
    if (body.date !== undefined) data.date = new Date(body.date)

    const receipt = await prisma.receipt.update({ where: { id }, data })

    const changes = [
      body.status !== undefined && before.status !== receipt.status
        ? { fieldName: 'Status', oldValue: before.status, newValue: receipt.status }
        : null,
      body.quantity !== undefined && before.quantity !== receipt.quantity
        ? { fieldName: 'Quantity', oldValue: String(before.quantity), newValue: String(receipt.quantity) }
        : null,
      before.subsidiaryId !== receipt.subsidiaryId
        ? { fieldName: 'Subsidiary', oldValue: before.subsidiaryId ?? '-', newValue: receipt.subsidiaryId ?? '-' }
        : null,
      before.currencyId !== receipt.currencyId
        ? { fieldName: 'Currency', oldValue: before.currencyId ?? '-', newValue: receipt.currencyId ?? '-' }
        : null,
      body.notes !== undefined && (before.notes ?? '') !== (receipt.notes ?? '')
        ? { fieldName: 'Notes', oldValue: before.notes ?? '-', newValue: receipt.notes ?? '-' }
        : null,
      body.date !== undefined && before.date.toISOString() !== receipt.date.toISOString()
        ? { fieldName: 'Date', oldValue: before.date.toISOString().slice(0, 10), newValue: receipt.date.toISOString().slice(0, 10) }
        : null,
    ].filter((change): change is { fieldName: string; oldValue: string; newValue: string } => Boolean(change))

    await logFieldChangeActivities({
      entityType: 'receipt',
      entityId: receipt.id,
      context: 'Receipt Details',
      changes,
    })

    await logActivity({
      entityType: 'receipt',
      entityId: receipt.id,
      action: 'update',
      summary: `Updated receipt ${id}`,
    })

    if ((receipt.status ?? '').toLowerCase() === 'received') {
      await postReceiptJournal(receipt.id)
    }

    return NextResponse.json(receipt)
  } catch {
    return NextResponse.json({ error: 'Failed to update receipt' }, { status: 500 })
  }
}
