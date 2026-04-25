import { prisma } from '@/lib/prisma'
import { sumMoney } from '@/lib/money'
import { toNumericValue } from '@/lib/format'

export async function syncSalesOrderTotal(salesOrderId: string) {
  const salesOrder = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    include: {
      lineItems: {
        select: {
          lineTotal: true,
        },
      },
    },
  })

  if (!salesOrder) {
    throw new Error('Sales order not found')
  }

  const total = sumMoney(salesOrder.lineItems.map((line) => toNumericValue(line.lineTotal, 0)))

  return prisma.salesOrder.update({
    where: { id: salesOrderId },
    data: { total },
  })
}
