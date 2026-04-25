import { prisma } from '@/lib/prisma'
import { sumMoney } from '@/lib/money'

export async function syncPurchaseOrderTotal(purchaseOrderId: string) {
  const lineItems = await prisma.purchaseOrderLineItem.findMany({
    where: { purchaseOrderId },
    select: { lineTotal: true },
  })

  const total = sumMoney(lineItems.map((item) => item.lineTotal))

  return prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { total },
  })
}
