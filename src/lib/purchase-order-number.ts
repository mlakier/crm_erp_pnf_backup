import { prisma } from '@/lib/prisma'

const PURCHASE_ORDER_NUMBER_PREFIX = 'PO-'
const PURCHASE_ORDER_NUMBER_WIDTH = 6

export function formatPurchaseOrderNumber(sequence: number) {
  return `${PURCHASE_ORDER_NUMBER_PREFIX}${String(sequence).padStart(PURCHASE_ORDER_NUMBER_WIDTH, '0')}`
}

export async function generateNextPurchaseOrderNumber() {
  const latestOrders = await prisma.purchaseOrder.findMany({
    orderBy: {
      number: 'desc',
    },
    select: {
      number: true,
    },
    take: 50,
  })

  for (const order of latestOrders) {
    const match = order.number.match(/(\d+)$/)
    if (match) {
      const parsed = Number.parseInt(match[1], 10)
      return formatPurchaseOrderNumber(Number.isNaN(parsed) ? 1 : parsed + 1)
    }
  }

  return formatPurchaseOrderNumber(1)
}