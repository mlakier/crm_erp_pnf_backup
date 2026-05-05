import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logActivity, logCommunicationActivity, logFieldChangeActivities, logRecordSnapshotActivities } from '@/lib/activity'
import { normalizeBillCreditApplications } from '@/lib/bill-credit-applications'
import { generateNextBillCreditNumber } from '@/lib/bill-credit-number'
import { clearCreditDocumentPostingArtifacts, syncBillCreditPosting } from '@/lib/credit-document-posting'
import { deleteDocumentRelationshipsForRecord } from '@/lib/document-relationships'
import { calcLineTotal, parseMoneyValue, sumMoney } from '@/lib/money'

const INCLUDE = {
  vendor: true,
  bill: {
    include: {
      vendor: true,
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
} satisfies Prisma.BillCreditInclude

type BillCreditLineInput = {
  itemId?: string | null
  description?: string | null
  quantity?: number
  unitPrice?: number
  notes?: string | null
}

function normalizeLineItems(lineItems: BillCreditLineInput[]) {
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
      const billCredit = await prisma.billCredit.findUnique({
        where: { id },
        include: INCLUDE,
      })
      if (!billCredit) {
        return NextResponse.json({ error: 'Bill credit not found' }, { status: 404 })
      }
      return NextResponse.json(billCredit)
    }

    const billCredits = await prisma.billCredit.findMany({
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(billCredits)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch bill credits' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const body = await request.json()
    if (searchParams.get('action') === 'send-email') {
      const {
        billCreditId,
        userId,
        to,
        from,
        subject,
        preview,
        attachPdf,
      } = body as {
        billCreditId?: string
        userId?: string | null
        to?: string
        from?: string
        subject?: string
        preview?: string
        attachPdf?: boolean
      }

      if (!billCreditId || !to?.trim() || !subject?.trim()) {
        return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
      }

      const billCredit = await prisma.billCredit.findUnique({ where: { id: billCreditId }, select: { id: true } })
      if (!billCredit) {
        return NextResponse.json({ error: 'Bill credit not found' }, { status: 404 })
      }

      await logCommunicationActivity({
        entityType: 'bill-credit',
        entityId: billCreditId,
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
      vendorId,
      billId,
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

    if (!vendorId || !date) {
      return NextResponse.json({ error: 'vendorId and date are required' }, { status: 400 })
    }

    const number = await generateNextBillCreditNumber()
    const normalizedLineItems = Array.isArray(lineItems) ? normalizeLineItems(lineItems) : []
    const normalizedApplications = normalizeBillCreditApplications(applications)
    const computedTotal = normalizedLineItems.length
      ? sumMoney(normalizedLineItems.map((line) => line.lineTotal))
      : parseMoneyValue(total)

    const createdBillCredit = await prisma.billCredit.create({
      data: {
        number,
        vendorId,
        billId: billId || null,
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
      entityType: 'bill-credit',
      entityId: createdBillCredit.id,
      action: 'create',
      summary: `Created bill credit ${createdBillCredit.number}`,
      userId: createdBillCredit.userId ?? null,
    })
    await logRecordSnapshotActivities({
      entityType: 'bill-credit',
      entityId: createdBillCredit.id,
      userId: createdBillCredit.userId ?? null,
      action: 'create',
      context: 'Header',
      fields: [
        { fieldName: 'Bill Credit Id', value: createdBillCredit.number },
        { fieldName: 'Vendor', value: createdBillCredit.vendorId },
        { fieldName: 'Bill', value: createdBillCredit.billId },
        { fieldName: 'Subsidiary', value: createdBillCredit.subsidiaryId },
        { fieldName: 'Currency', value: createdBillCredit.currencyId },
        { fieldName: 'Status', value: createdBillCredit.status },
        { fieldName: 'Date', value: createdBillCredit.date },
        { fieldName: 'Reason', value: createdBillCredit.reason },
        { fieldName: 'Notes', value: createdBillCredit.notes },
        { fieldName: 'Total', value: createdBillCredit.total },
      ],
    })

    const billCredit = await syncBillCreditPosting(createdBillCredit.id, normalizedApplications)

    return NextResponse.json(billCredit, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create bill credit' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing bill credit id' }, { status: 400 })
    }

    const body = await request.json()
    const {
      vendorId,
      billId,
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

    const before = await prisma.billCredit.findUnique({
      where: { id },
      include: { lineItems: true },
    })
    if (!before) {
      return NextResponse.json({ error: 'Bill credit not found' }, { status: 404 })
    }

    const normalizedLineItems = Array.isArray(lineItems) ? normalizeLineItems(lineItems) : []
    const normalizedApplications = normalizeBillCreditApplications(applications)
    const computedTotal = normalizedLineItems.length
      ? sumMoney(normalizedLineItems.map((line) => line.lineTotal))
      : parseMoneyValue(total)

    const updatedBillCredit = await prisma.billCredit.update({
      where: { id },
      data: {
        vendorId: vendorId || before.vendorId,
        billId: billId || null,
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
      entityType: 'bill-credit',
      entityId: updatedBillCredit.id,
      action: 'update',
      summary: `Updated bill credit ${updatedBillCredit.number}`,
      userId: updatedBillCredit.userId ?? null,
    })
    await logFieldChangeActivities({
      entityType: 'bill-credit',
      entityId: updatedBillCredit.id,
      userId: updatedBillCredit.userId ?? null,
      context: 'Header',
      changes: [
        { fieldName: 'Vendor', oldValue: before.vendorId, newValue: updatedBillCredit.vendorId },
        { fieldName: 'Bill', oldValue: before.billId, newValue: updatedBillCredit.billId },
        { fieldName: 'Subsidiary', oldValue: before.subsidiaryId, newValue: updatedBillCredit.subsidiaryId },
        { fieldName: 'Currency', oldValue: before.currencyId, newValue: updatedBillCredit.currencyId },
        { fieldName: 'Status', oldValue: before.status, newValue: updatedBillCredit.status },
        { fieldName: 'Date', oldValue: before.date, newValue: updatedBillCredit.date },
        { fieldName: 'Reason', oldValue: before.reason, newValue: updatedBillCredit.reason },
        { fieldName: 'Notes', oldValue: before.notes, newValue: updatedBillCredit.notes },
        { fieldName: 'Total', oldValue: before.total, newValue: updatedBillCredit.total },
      ],
    })

    const billCredit = await syncBillCreditPosting(updatedBillCredit.id, normalizedApplications)

    return NextResponse.json(billCredit)
  } catch {
    return NextResponse.json({ error: 'Failed to update bill credit' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing bill credit id' }, { status: 400 })
    }

    const before = await prisma.billCredit.findUnique({
      where: { id },
      include: { vendor: true },
    })
    if (!before) {
      return NextResponse.json({ error: 'Bill credit not found' }, { status: 404 })
    }

    await clearCreditDocumentPostingArtifacts('bill-credit', id)
    await deleteDocumentRelationshipsForRecord('bill-credit', id)
    await prisma.billCredit.delete({ where: { id } })
    await logActivity({
      entityType: 'bill-credit',
      entityId: id,
      action: 'delete',
      summary: `Deleted bill credit ${before.number}`,
      userId: before.userId ?? null,
    })
    await logRecordSnapshotActivities({
      entityType: 'bill-credit',
      entityId: id,
      userId: before.userId ?? null,
      action: 'delete',
      context: 'Header',
      fields: [
        { fieldName: 'Bill Credit Id', value: before.number },
        { fieldName: 'Vendor', value: before.vendor.name },
        { fieldName: 'Status', value: before.status },
        { fieldName: 'Total', value: before.total },
      ],
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete bill credit' }, { status: 500 })
  }
}
