import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logActivity, logCommunicationActivity, logFieldChangeActivities, logRecordSnapshotActivities } from '@/lib/activity'
import { normalizeCreditMemoApplications } from '@/lib/credit-memo-applications'
import { generateNextCreditMemoNumber } from '@/lib/credit-memo-number'
import { clearCreditDocumentPostingArtifacts, syncCreditMemoPosting } from '@/lib/credit-document-posting'
import { deleteDocumentRelationshipsForRecord } from '@/lib/document-relationships'
import { calcLineTotal, parseMoneyValue, sumMoney } from '@/lib/money'

const INCLUDE = {
  customer: true,
  invoice: {
    include: {
      customer: true,
      currency: true,
    },
  },
  user: true,
  subsidiary: true,
  currency: true,
  lineItems: {
    include: {
      item: true,
    },
    orderBy: [{ createdAt: 'asc' as const }],
  },
} satisfies Prisma.CreditMemoInclude

type CreditMemoLineInput = {
  itemId?: string | null
  description?: string | null
  quantity?: number
  unitPrice?: number
  notes?: string | null
}

function normalizeLineItems(lineItems: CreditMemoLineInput[]) {
  return lineItems
    .map((line) => {
      const quantity = Math.max(1, Number(line.quantity) || 1)
      const unitPrice = Math.max(0, Number(line.unitPrice) || 0)
      const description = line.description?.trim() || ''
      return {
        itemId: line.itemId || null,
        description,
        quantity,
        unitPrice,
        lineTotal: calcLineTotal(quantity, unitPrice),
        notes: line.notes?.trim() || null,
      }
    })
    .filter((line) => line.itemId || line.description)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const creditMemo = await prisma.creditMemo.findUnique({
        where: { id },
        include: INCLUDE,
      })
      if (!creditMemo) {
        return NextResponse.json({ error: 'Credit memo not found' }, { status: 404 })
      }
      return NextResponse.json(creditMemo)
    }

    const creditMemos = await prisma.creditMemo.findMany({
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(creditMemos)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch credit memos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const body = await request.json()
    if (searchParams.get('action') === 'send-email') {
      const {
        creditMemoId,
        userId,
        to,
        from,
        subject,
        preview,
        attachPdf,
      } = body as {
        creditMemoId?: string
        userId?: string | null
        to?: string
        from?: string
        subject?: string
        preview?: string
        attachPdf?: boolean
      }

      if (!creditMemoId || !to?.trim() || !subject?.trim()) {
        return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
      }

      const creditMemo = await prisma.creditMemo.findUnique({ where: { id: creditMemoId }, select: { id: true } })
      if (!creditMemo) {
        return NextResponse.json({ error: 'Credit memo not found' }, { status: 404 })
      }

      await logCommunicationActivity({
        entityType: 'credit-memo',
        entityId: creditMemoId,
        userId: userId ?? null,
        context: 'UI',
        channel: 'Email',
        direction: 'Outbound',
        subject: subject.trim(),
        from: from?.trim() || '-',
        to: to.trim(),
        status: attachPdf ? 'Prepared (PDF)' : 'Prepared',
        preview: (preview?.trim() || '-').slice(0, 500),
      })

      return NextResponse.json({ ok: true })
    }

    const {
      customerId,
      invoiceId,
      userId,
      subsidiaryId,
      currencyId,
      status,
      date,
      reason,
      notes,
      total,
      lineItems,
      applications,
    } = body

    if (!customerId || !date) {
      return NextResponse.json({ error: 'customerId and date are required' }, { status: 400 })
    }

    const number = await generateNextCreditMemoNumber()
    const normalizedLineItems = Array.isArray(lineItems) ? normalizeLineItems(lineItems) : []
    const normalizedApplications = normalizeCreditMemoApplications(applications)
    const computedTotal = normalizedLineItems.length
      ? sumMoney(normalizedLineItems.map((line) => line.lineTotal))
      : parseMoneyValue(total)

    const createdCreditMemo = await prisma.creditMemo.create({
      data: {
        number,
        customerId,
        invoiceId: invoiceId || null,
        userId: userId || null,
        subsidiaryId: subsidiaryId || null,
        currencyId: currencyId || null,
        status: status || 'draft',
        date: new Date(date),
        reason: reason?.trim() || null,
        notes: notes?.trim() || null,
        total: computedTotal,
        lineItems: normalizedLineItems.length
          ? {
              create: normalizedLineItems,
            }
          : undefined,
      },
      include: INCLUDE,
    })

    await logActivity({
      entityType: 'credit-memo',
      entityId: createdCreditMemo.id,
      action: 'create',
      summary: `Created credit memo ${createdCreditMemo.number}`,
      userId: createdCreditMemo.userId ?? null,
    })
    await logRecordSnapshotActivities({
      entityType: 'credit-memo',
      entityId: createdCreditMemo.id,
      userId: createdCreditMemo.userId ?? null,
      action: 'create',
      context: 'Header',
      fields: [
        { fieldName: 'Credit Memo Id', value: createdCreditMemo.number },
        { fieldName: 'Customer', value: createdCreditMemo.customerId },
        { fieldName: 'Invoice', value: createdCreditMemo.invoiceId },
        { fieldName: 'Subsidiary', value: createdCreditMemo.subsidiaryId },
        { fieldName: 'Currency', value: createdCreditMemo.currencyId },
        { fieldName: 'Status', value: createdCreditMemo.status },
        { fieldName: 'Date', value: createdCreditMemo.date },
        { fieldName: 'Reason', value: createdCreditMemo.reason },
        { fieldName: 'Notes', value: createdCreditMemo.notes },
        { fieldName: 'Total', value: createdCreditMemo.total },
      ],
    })

    const creditMemo = await syncCreditMemoPosting(createdCreditMemo.id, normalizedApplications)

    return NextResponse.json(creditMemo, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create credit memo' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing credit memo id' }, { status: 400 })
    }

    const body = await request.json()
    const {
      customerId,
      invoiceId,
      userId,
      subsidiaryId,
      currencyId,
      status,
      date,
      reason,
      notes,
      total,
      lineItems,
      applications,
    } = body

    const before = await prisma.creditMemo.findUnique({
      where: { id },
      include: { lineItems: true },
    })
    if (!before) {
      return NextResponse.json({ error: 'Credit memo not found' }, { status: 404 })
    }

    const normalizedLineItems = Array.isArray(lineItems) ? normalizeLineItems(lineItems) : []
    const normalizedApplications = normalizeCreditMemoApplications(applications)
    const computedTotal = normalizedLineItems.length
      ? sumMoney(normalizedLineItems.map((line) => line.lineTotal))
      : parseMoneyValue(total)

    const updatedCreditMemo = await prisma.creditMemo.update({
      where: { id },
      data: {
        customerId: customerId || before.customerId,
        invoiceId: invoiceId || null,
        userId: userId || before.userId,
        subsidiaryId: subsidiaryId || null,
        currencyId: currencyId || null,
        status: status || before.status,
        date: date ? new Date(date) : before.date,
        reason: reason?.trim() || null,
        notes: notes?.trim() || null,
        total: computedTotal,
        lineItems: {
          deleteMany: {},
          ...(normalizedLineItems.length ? { create: normalizedLineItems } : {}),
        },
      },
      include: INCLUDE,
    })

    await logActivity({
      entityType: 'credit-memo',
      entityId: updatedCreditMemo.id,
      action: 'update',
      summary: `Updated credit memo ${updatedCreditMemo.number}`,
      userId: updatedCreditMemo.userId ?? null,
    })
    await logFieldChangeActivities({
      entityType: 'credit-memo',
      entityId: updatedCreditMemo.id,
      userId: updatedCreditMemo.userId ?? null,
      context: 'Header',
      changes: [
        { fieldName: 'Customer', oldValue: before.customerId, newValue: updatedCreditMemo.customerId },
        { fieldName: 'Invoice', oldValue: before.invoiceId, newValue: updatedCreditMemo.invoiceId },
        { fieldName: 'Subsidiary', oldValue: before.subsidiaryId, newValue: updatedCreditMemo.subsidiaryId },
        { fieldName: 'Currency', oldValue: before.currencyId, newValue: updatedCreditMemo.currencyId },
        { fieldName: 'Status', oldValue: before.status, newValue: updatedCreditMemo.status },
        { fieldName: 'Date', oldValue: before.date, newValue: updatedCreditMemo.date },
        { fieldName: 'Reason', oldValue: before.reason, newValue: updatedCreditMemo.reason },
        { fieldName: 'Notes', oldValue: before.notes, newValue: updatedCreditMemo.notes },
        { fieldName: 'Total', oldValue: before.total, newValue: updatedCreditMemo.total },
      ],
    })

    const creditMemo = await syncCreditMemoPosting(updatedCreditMemo.id, normalizedApplications)

    return NextResponse.json(creditMemo)
  } catch {
    return NextResponse.json({ error: 'Failed to update credit memo' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing credit memo id' }, { status: 400 })
    }

    const before = await prisma.creditMemo.findUnique({
      where: { id },
      include: { customer: true },
    })
    if (!before) {
      return NextResponse.json({ error: 'Credit memo not found' }, { status: 404 })
    }

    await clearCreditDocumentPostingArtifacts('credit-memo', id)
    await deleteDocumentRelationshipsForRecord('credit-memo', id)
    await prisma.creditMemo.delete({ where: { id } })
    await logActivity({
      entityType: 'credit-memo',
      entityId: id,
      action: 'delete',
      summary: `Deleted credit memo ${before.number}`,
      userId: before.userId ?? null,
    })
    await logRecordSnapshotActivities({
      entityType: 'credit-memo',
      entityId: id,
      userId: before.userId ?? null,
      action: 'delete',
      context: 'Header',
      fields: [
        { fieldName: 'Credit Memo Id', value: before.number },
        { fieldName: 'Customer', value: before.customer.name },
        { fieldName: 'Status', value: before.status },
        { fieldName: 'Total', value: before.total },
      ],
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete credit memo' }, { status: 500 })
  }
}
