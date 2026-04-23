import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatFulfillmentNumber(sequence: number, config = DEFAULT_ID_SETTINGS.fulfillment) {
  return formatIdentifier(sequence, config)
}

export async function generateFulfillmentNumber(): Promise<string> {
  const config = await loadIdSetting('fulfillment')
  const all = await prisma.fulfillment.findMany({
    where: { number: { startsWith: config.prefix } },
    select: { number: true },
    orderBy: { number: 'desc' },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(all.map((record) => record.number), config)
  return formatFulfillmentNumber(nextSequence, config)
}
