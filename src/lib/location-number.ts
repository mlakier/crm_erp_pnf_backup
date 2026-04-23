import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatLocationId(sequence: number, config = DEFAULT_ID_SETTINGS.location) {
  return formatIdentifier(sequence, config)
}

export async function generateNextLocationId() {
  const config = await loadIdSetting('location')
  const latestLocations = await prisma.location.findMany({
    where: { locationId: { startsWith: config.prefix } },
    orderBy: { locationId: 'desc' },
    select: { locationId: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestLocations.map((location) => location.locationId), config)
  return formatLocationId(nextSequence, config)
}
