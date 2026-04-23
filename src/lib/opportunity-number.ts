import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatOpportunityNumber(sequence: number, config = DEFAULT_ID_SETTINGS.opportunity) {
  return formatIdentifier(sequence, config)
}

export async function generateNextOpportunityNumber() {
  const config = await loadIdSetting('opportunity')
  const latestOpportunities = await prisma.opportunity.findMany({
    where: { opportunityNumber: { startsWith: config.prefix } },
    orderBy: { opportunityNumber: 'desc' },
    select: { opportunityNumber: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestOpportunities.map((opportunity) => opportunity.opportunityNumber), config)
  return formatOpportunityNumber(nextSequence, config)
}
