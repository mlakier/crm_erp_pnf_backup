import { prisma } from '@/lib/prisma'

const PR_NUMBER_PREFIX = 'PR-'
const PR_NUMBER_WIDTH = 6

export function formatRequisitionNumber(sequence: number) {
  return `${PR_NUMBER_PREFIX}${String(sequence).padStart(PR_NUMBER_WIDTH, '0')}`
}

export async function generateNextRequisitionNumber() {
  const latest = await prisma.requisition.findMany({
    orderBy: { number: 'desc' },
    select: { number: true },
    take: 50,
  })

  for (const req of latest) {
    const match = req.number.match(/(\d+)$/)
    if (match) {
      const parsed = Number.parseInt(match[1], 10)
      return formatRequisitionNumber(Number.isNaN(parsed) ? 1 : parsed + 1)
    }
  }

  return formatRequisitionNumber(1)
}
