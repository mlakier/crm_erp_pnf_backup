import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatLeadNumber(sequence: number, config = DEFAULT_ID_SETTINGS.lead) {
  return formatIdentifier(sequence, config)
}

export async function generateNextLeadNumber() {
  const config = await loadIdSetting('lead')
  const latestLeads = await prisma.lead.findMany({
    where: { leadNumber: { startsWith: config.prefix } },
    orderBy: { leadNumber: 'desc' },
    select: { leadNumber: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestLeads.map((lead) => lead.leadNumber), config)
  return formatLeadNumber(nextSequence, config)
}
