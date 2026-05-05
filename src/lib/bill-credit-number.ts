import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatBillCreditNumber(sequence: number, config = DEFAULT_ID_SETTINGS.bill) {
  return formatIdentifier(sequence, {
    ...config,
    prefix: config.prefix.replace(/^BILL/i, 'BC'),
  })
}

export async function generateNextBillCreditNumber() {
  const baseConfig = await loadIdSetting('bill')
  const config = {
    ...baseConfig,
    prefix: baseConfig.prefix.replace(/^BILL/i, 'BC'),
  }
  const latestBillCredits = await prisma.billCredit.findMany({
    where: { number: { startsWith: config.prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestBillCredits.map((billCredit) => billCredit.number), config)
  return formatBillCreditNumber(nextSequence, config)
}
