import { prisma } from '@/lib/prisma'

const BILL_NUMBER_PREFIX = 'BILL-'
const BILL_NUMBER_WIDTH = 6

export function formatBillNumber(sequence: number) {
  return `${BILL_NUMBER_PREFIX}${String(sequence).padStart(BILL_NUMBER_WIDTH, '0')}`
}

export async function generateNextBillNumber() {
  const latestBills = await prisma.bill.findMany({
    orderBy: {
      number: 'desc',
    },
    select: {
      number: true,
    },
    take: 50,
  })

  for (const bill of latestBills) {
    const match = bill.number.match(/(\d+)$/)
    if (match) {
      const parsed = Number.parseInt(match[1], 10)
      return formatBillNumber(Number.isNaN(parsed) ? 1 : parsed + 1)
    }
  }

  return formatBillNumber(1)
}
