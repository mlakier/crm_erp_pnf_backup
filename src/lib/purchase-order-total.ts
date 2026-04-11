import { prisma } from '@/lib/prisma'

export async function syncPurchaseOrderTotal(purchaseOrderId: string) {
  const lineItems = await prisma.purchaseOrderLineItem.findMany({
    where: { purchaseOrderId },
    select: { lineTotal: true },
  })

  const total = lineItems.reduce((sum, item) => sum + item.lineTotal, 0)

  return prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { total },
  })
}