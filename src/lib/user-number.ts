import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatUserNumber(sequence: number, config = DEFAULT_ID_SETTINGS.user) {
  return formatIdentifier(sequence, config)
}

export async function generateNextUserNumber() {
  const config = await loadIdSetting('user')
  const latestUsers = await prisma.user.findMany({
    where: { userId: { startsWith: config.prefix } },
    orderBy: { userId: 'desc' },
    select: { userId: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestUsers.map((user) => user.userId), config)
  return formatUserNumber(nextSequence, config)
}
