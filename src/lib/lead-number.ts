import { prisma } from '@/lib/prisma'

const LEAD_NUMBER_PREFIX = 'LEAD-'
const LEAD_NUMBER_WIDTH = 6

export function formatLeadNumber(sequence: number) {
  return `${LEAD_NUMBER_PREFIX}${String(sequence).padStart(LEAD_NUMBER_WIDTH, '0')}`
}

export async function generateNextLeadNumber() {
  const latestLead = await prisma.lead.findFirst({
    where: {
      leadNumber: {
        not: null,
      },
    },
    orderBy: {
      leadNumber: 'desc',
    },
    select: {
      leadNumber: true,
    },
  })

  const latestSequence = latestLead?.leadNumber
    ? Number.parseInt(latestLead.leadNumber.replace(LEAD_NUMBER_PREFIX, ''), 10)
    : 0

  return formatLeadNumber(Number.isNaN(latestSequence) ? 1 : latestSequence + 1)
}