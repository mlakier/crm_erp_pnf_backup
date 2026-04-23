import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatQuoteNumber(sequence: number, config = DEFAULT_ID_SETTINGS.quote) {
  return formatIdentifier(sequence, config)
}

export async function generateNextQuoteNumber() {
  const config = await loadIdSetting('quote')
  const latestQuotes = await prisma.quote.findMany({
    where: { number: { startsWith: config.prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestQuotes.map((quote) => quote.number), config)
  return formatQuoteNumber(nextSequence, config)
}
