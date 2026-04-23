import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatBillNumber(sequence: number, config = DEFAULT_ID_SETTINGS.bill) {
  return formatIdentifier(sequence, config)
}

export async function generateNextBillNumber() {
  const config = await loadIdSetting('bill')
  const latestBills = await prisma.bill.findMany({
    where: { number: { startsWith: config.prefix } },
    orderBy: {
      number: 'desc',
    },
    select: {
      number: true,
    },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestBills.map((bill) => bill.number), config)
  return formatBillNumber(nextSequence, config)
}
