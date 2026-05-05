import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatCreditMemoNumber(sequence: number, config = DEFAULT_ID_SETTINGS.invoice) {
  return formatIdentifier(sequence, {
    ...config,
    prefix: config.prefix.replace(/^INV/i, 'CM'),
  })
}

export async function generateNextCreditMemoNumber() {
  const baseConfig = await loadIdSetting('invoice')
  const config = {
    ...baseConfig,
    prefix: baseConfig.prefix.replace(/^INV/i, 'CM'),
  }
  const latestCreditMemos = await prisma.creditMemo.findMany({
    where: { number: { startsWith: config.prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestCreditMemos.map((creditMemo) => creditMemo.number), config)
  return formatCreditMemoNumber(nextSequence, config)
}
