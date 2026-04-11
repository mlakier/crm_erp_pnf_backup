import { prisma } from '@/lib/prisma'

const OPPORTUNITY_NUMBER_PREFIX = 'OPP-'
const OPPORTUNITY_NUMBER_WIDTH = 6

export function formatOpportunityNumber(sequence: number) {
  return `${OPPORTUNITY_NUMBER_PREFIX}${String(sequence).padStart(OPPORTUNITY_NUMBER_WIDTH, '0')}`
}

export async function generateNextOpportunityNumber() {
  const latestOpportunity = await prisma.opportunity.findFirst({
    where: {
      opportunityNumber: {
        not: null,
      },
    },
    orderBy: {
      opportunityNumber: 'desc',
    },
    select: {
      opportunityNumber: true,
    },
  })

  const latestSequence = latestOpportunity?.opportunityNumber
    ? Number.parseInt(latestOpportunity.opportunityNumber.replace(OPPORTUNITY_NUMBER_PREFIX, ''), 10)
    : 0

  return formatOpportunityNumber(Number.isNaN(latestSequence) ? 1 : latestSequence + 1)
}