import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatSubsidiaryCode(sequence: number, config = DEFAULT_ID_SETTINGS.subsidiary) {
  return formatIdentifier(sequence, config)
}

export async function generateNextSubsidiaryCode() {
  const config = await loadIdSetting('subsidiary')
  const latestSubsidiaries = await prisma.subsidiary.findMany({
    where: { subsidiaryId: { startsWith: config.prefix } },
    orderBy: { subsidiaryId: 'desc' },
    select: { subsidiaryId: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestSubsidiaries.map((subsidiary) => subsidiary.subsidiaryId), config)
  return formatSubsidiaryCode(nextSequence, config)
}
