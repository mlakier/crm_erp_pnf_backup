import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity, logCommunicationActivity, logFieldChangeActivities } from '@/lib/activity'
import { generateNextPurchaseOrderNumber } from '@/lib/purchase-order-number'

export async function GET() {
  try {
    const purchaseOrders = await prisma.purchaseOrder.findMany({ include: { vendor: true } })
    return NextResponse.json(purchaseOrders)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const body = await request.json()

    if (searchParams.get('action') === 'send-email') {
      const {
        purchaseOrderId,
        userId,
        to,
        from,
        subject,
        preview,
        attachPdf,
      } = body as {
        purchaseOrderId?: string
        userId?: string | null
        to?: string
        from?: string
        subject?: string
        preview?: string
        attachPdf?: boolean
      }

      if (!purchaseOrderId || !to?.trim() || !subject?.trim()) {
        return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
      }

      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: { id: true },
      })

      if (!purchaseOrder) {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
      }

      await logCommunicationActivity({
        entityType: 'purchase-order',
        entityId: purchaseOrderId,
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

    const { number, status, total, vendorId, entityId, subsidiaryId, userId, lineItems } = body
    const requestSubsidiaryId = subsidiaryId ?? entityId

    if (!vendorId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const normalizedNumber = number?.trim() || await generateNextPurchaseOrderNumber()
    const normalizedLineItems = Array.isArray(lineItems)
      ? lineItems
          .map((line, index) => {
            const row = line as {
              itemId?: string | null
              description?: string
              quantity?: number | string
              unitPrice?: number | string
              lineTotal?: number | string
              displayOrder?: number
            }
            const quantity = Math.max(1, Number(row.quantity ?? 0) || 1)
            const unitPrice = Math.max(0, Number(row.unitPrice ?? 0) || 0)
            const description = String(row.description ?? '').trim()
            return {
              itemId: row.itemId || null,
              description,
              quantity,
              unitPrice,
              lineTotal:
                row.lineTotal != null && row.lineTotal !== ''
                  ? Math.max(0, Number(row.lineTotal) || 0)
                  : quantity * unitPrice,
              displayOrder:
                typeof row.displayOrder === 'number' && Number.isFinite(row.displayOrder)
                  ? Math.max(0, Math.trunc(row.displayOrder))
                  : index,
            }
          })
          .filter((line) => line.description || line.itemId)
      : []
    const normalizedTotal =
      normalizedLineItems.length > 0
        ? normalizedLineItems.reduce((sum, line) => sum + line.lineTotal, 0)
        : Number(total ?? 0) || 0

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        number: normalizedNumber,
        status,
        total: normalizedTotal,
        vendorId,
        subsidiaryId: requestSubsidiaryId || null,
        userId,
        ...(normalizedLineItems.length > 0
          ? {
              lineItems: {
                create: normalizedLineItems,
              },
            }
          : {}),
      },
    })

    await logActivity({
      entityType: 'purchase-order',
      entityId: purchaseOrder.id,
      action: 'create',
      summary: `Created purchase order ${purchaseOrder.number}`,
      userId,
    })

    return NextResponse.json(purchaseOrder, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing purchase order id' }, { status: 400 })

    const body = await request.json()
    const { number, status, total, vendorId, entityId, subsidiaryId } = body
    const requestSubsidiaryId = subsidiaryId ?? entityId

    const existing = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            id: true,
            vendorNumber: true,
            name: true,
          },
        },
        subsidiary: {
          select: {
            id: true,
            subsidiaryId: true,
            name: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    const normalizedNumber = number?.trim() || existing.number
    const normalizedVendorId = vendorId || existing.vendorId
    const normalizedEntityId = requestSubsidiaryId || null
    const normalizedStatus = status || null
    const normalizedTotal = total !== '' && total != null ? parseFloat(total) : 0

    const vendorIds = Array.from(new Set([existing.vendorId, normalizedVendorId].filter(Boolean)))
    const vendors = vendorIds.length
      ? await prisma.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: { id: true, vendorNumber: true, name: true },
        })
      : []
    const vendorLabelById = new Map(
      vendors.map((vendor) => [vendor.id, `${vendor.vendorNumber ?? 'VENDOR'} - ${vendor.name}`])
    )
    const entityIds = Array.from(new Set([existing.subsidiaryId, normalizedEntityId].filter(Boolean)))
    const entities = entityIds.length
      ? await prisma.subsidiary.findMany({
          where: { id: { in: entityIds } },
          select: { id: true, subsidiaryId: true, name: true },
        })
      : []
    const entityLabelById = new Map(
      entities.map((Subsidiary) => [Subsidiary.id, `${Subsidiary.subsidiaryId} - ${Subsidiary.name}`])
    )

    const po = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        number: normalizedNumber,
        subsidiaryId: normalizedEntityId,
        vendorId: normalizedVendorId,
        status: normalizedStatus,
        total: normalizedTotal,
      },
    })

    const changes = [
      existing.number !== normalizedNumber
        ? {
            fieldName: 'Purchase Order #',
            oldValue: existing.number,
            newValue: normalizedNumber,
          }
        : null,
      existing.vendorId !== normalizedVendorId
        ? {
            fieldName: 'Vendor',
            oldValue: vendorLabelById.get(existing.vendorId) ?? existing.vendorId,
            newValue: vendorLabelById.get(normalizedVendorId) ?? normalizedVendorId,
          }
        : null,
      (existing.subsidiaryId ?? '') !== (normalizedEntityId ?? '')
        ? {
            fieldName: 'Subsidiary',
            oldValue: existing.subsidiaryId ? entityLabelById.get(existing.subsidiaryId) ?? existing.subsidiaryId : '-',
            newValue: normalizedEntityId ? entityLabelById.get(normalizedEntityId) ?? normalizedEntityId : '-',
          }
        : null,
      (existing.status ?? '') !== (normalizedStatus ?? '')
        ? {
            fieldName: 'Status',
            oldValue: existing.status ?? '-',
            newValue: normalizedStatus ?? '-',
          }
        : null,
      existing.total !== normalizedTotal
        ? {
            fieldName: 'Total',
            oldValue: existing.total.toString(),
            newValue: normalizedTotal.toString(),
          }
        : null,
    ].filter(Boolean) as Array<{ fieldName: string; oldValue: string; newValue: string }>

    await logActivity({
      entityType: 'purchase-order',
      entityId: po.id,
      action: 'update',
      summary: `Updated purchase order ${po.number}`,
      userId: po.userId,
    })

    await logFieldChangeActivities({
      entityType: 'purchase-order',
      entityId: po.id,
      userId: po.userId,
      context: 'UI',
      changes,
    })

    return NextResponse.json(po)
  } catch {
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing purchase order id' }, { status: 400 })
    }

    const existing = await prisma.purchaseOrder.findUnique({ where: { id } })
    await prisma.purchaseOrder.delete({ where: { id } })

    await logActivity({
      entityType: 'purchase-order',
      entityId: id,
      action: 'delete',
      summary: `Deleted purchase order ${existing?.number ?? id}`,
      userId: existing?.userId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 })
  }
}
