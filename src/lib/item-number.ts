import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'
import { prisma } from '@/lib/prisma'

export function formatItemNumber(sequence: number, config = DEFAULT_ID_SETTINGS.item) {
  return formatIdentifier(sequence, config)
}

export async function generateNextItemNumber(): Promise<string> {
  const config = await loadIdSetting('item')
  const items = await prisma.item.findMany({
    where: { itemId: { startsWith: config.prefix } },
    select: { itemId: true },
    orderBy: { itemId: 'desc' },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(items.map((item) => item.itemId), config)
  return formatItemNumber(nextSequence, config)
}
