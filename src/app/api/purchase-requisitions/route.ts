import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { generateNextRequisitionNumber } from '@/lib/requisition-number'
import { generateNextPurchaseOrderNumber } from '@/lib/purchase-order-number'

const INCLUDE = {
  vendor: true,
  department: true,
  subsidiary: true,
  currency: true,
  lineItems: { orderBy: { createdAt: 'asc' as const } },
} as const

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const req = await prisma.requisition.findUnique({ where: { id }, include: INCLUDE })
      if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(req)
    }

    const requisitions = await prisma.requisition.findMany({
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(requisitions)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch requisitions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, priority, neededByDate, notes, vendorId, departmentId, entityId, subsidiaryId, currencyId, userId } = body
    const requestSubsidiaryId = subsidiaryId ?? entityId

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const number = await generateNextRequisitionNumber()

    const requisition = await prisma.requisition.create({
      data: {
        number,
        status: 'draft',
        title: title || null,
        description: description || null,
        priority: priority || 'medium',
        neededByDate: neededByDate ? new Date(neededByDate) : null,
        notes: notes || null,
        total: 0,
        userId,
        departmentId: departmentId || null,
        vendorId: vendorId || null,
        subsidiaryId: requestSubsidiaryId || null,
        currencyId: currencyId || null,
      },
      include: INCLUDE,
    })

    await logActivity({
      entityType: 'purchase-requisition',
      entityId: requisition.id,
      action: 'create',
      summary: `Created purchase requisition ${requisition.number}`,
      userId,
    })

    return NextResponse.json(requisition, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create requisition' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const body = await request.json()
    const { status, title, description, priority, neededByDate, notes, vendorId, departmentId, entityId, subsidiaryId, currencyId } = body
    const requestSubsidiaryId = subsidiaryId ?? entityId

    // Load current state before updating so we can detect the approval transition
    const before = await prisma.requisition.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { createdAt: 'asc' } },
        purchaseOrder: { select: { id: true } },
      },
    })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const requisition = await prisma.requisition.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(title !== undefined ? { title: title || null } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(neededByDate !== undefined ? { neededByDate: neededByDate ? new Date(neededByDate) : null } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(vendorId !== undefined ? { vendorId: vendorId || null } : {}),
        ...(departmentId !== undefined ? { departmentId: departmentId || null } : {}),
        ...(requestSubsidiaryId !== undefined ? { subsidiaryId: requestSubsidiaryId || null } : {}),
        ...(currencyId !== undefined ? { currencyId: currencyId || null } : {}),
      },
    })

    await logActivity({
      entityType: 'purchase-requisition',
      entityId: requisition.id,
      action: 'update',
      summary: `Updated purchase requisition ${requisition.number}`,
      userId: requisition.userId,
    })

    // Auto-convert to PO when status transitions to "approved" and no PO exists yet
    if (
      status === 'approved' &&
      before.status !== 'approved' &&
      !before.purchaseOrder
    ) {
      const effectiveVendorId = vendorId !== undefined ? (vendorId || null) : before.vendorId
      if (effectiveVendorId) {
        const poNumber = await generateNextPurchaseOrderNumber()
        const po = await prisma.purchaseOrder.create({
          data: {
            number: poNumber,
            status: 'draft',
            total: before.total,
            vendorId: effectiveVendorId,
            userId: before.userId,
            subsidiaryId: requestSubsidiaryId !== undefined ? (requestSubsidiaryId || null) : before.subsidiaryId,
            currencyId: currencyId !== undefined ? (currencyId || null) : before.currencyId,
            requisitionId: before.id,
            lineItems: {
              create: before.lineItems.map((li) => ({
                description: li.description,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                lineTotal: li.lineTotal,
              })),
            },
          },
        })

        // Mark requisition as ordered now that PO is raised
        await prisma.requisition.update({
          where: { id },
          data: { status: 'ordered' },
        })

        await logActivity({
          entityType: 'purchase-order',
          entityId: po.id,
          action: 'create',
          summary: `Auto-created PO ${po.number} from approved requisition ${before.number}`,
          userId: before.userId,
        })
      }
    }

    return NextResponse.json(requisition)
  } catch {
    return NextResponse.json({ error: 'Failed to update requisition' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const existing = await prisma.requisition.findUnique({ where: { id } })
    await prisma.requisition.delete({ where: { id } })

    await logActivity({
      entityType: 'purchase-requisition',
      entityId: id,
      action: 'delete',
      summary: `Deleted purchase requisition ${existing?.number ?? id}`,
      userId: existing?.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete requisition' }, { status: 500 })
  }
}
