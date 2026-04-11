import { prisma } from '@/lib/prisma'

const SALES_ORDER_NUMBER_PREFIX = 'SO-'
const SALES_ORDER_NUMBER_WIDTH = 6

export function formatSalesOrderNumber(sequence: number) {
  return `${SALES_ORDER_NUMBER_PREFIX}${String(sequence).padStart(SALES_ORDER_NUMBER_WIDTH, '0')}`
}

export async function generateNextSalesOrderNumber() {
  const latestOrder = await prisma.salesOrder.findFirst({
    orderBy: { number: 'desc' },
    select: { number: true },
  })

  const latestSequence = latestOrder?.number
    ? Number.parseInt(latestOrder.number.replace(SALES_ORDER_NUMBER_PREFIX, ''), 10)
    : 0

  return formatSalesOrderNumber(Number.isNaN(latestSequence) ? 1 : latestSequence + 1)
}