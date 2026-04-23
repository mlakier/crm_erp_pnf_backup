import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logCommunicationActivity } from '@/lib/activity'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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
  } catch {
    return NextResponse.json({ error: 'Failed to prepare purchase order email' }, { status: 500 })
  }
}
