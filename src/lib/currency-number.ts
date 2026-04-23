import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatCurrencyId(sequence: number, config = DEFAULT_ID_SETTINGS.currency) {
  return formatIdentifier(sequence, config)
}

export async function generateNextCurrencyId() {
  const config = await loadIdSetting('currency')
  const latestCurrencies = await prisma.currency.findMany({
    where: { currencyId: { startsWith: config.prefix } },
    orderBy: { currencyId: 'desc' },
    select: { currencyId: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestCurrencies.map((currency) => currency.currencyId), config)
  return formatCurrencyId(nextSequence, config)
}
