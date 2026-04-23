import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatBillPaymentNumber(sequence: number, config = DEFAULT_ID_SETTINGS.billPayment) {
  return formatIdentifier(sequence, config)
}

export async function generateBillPaymentNumber(): Promise<string> {
  const config = await loadIdSetting('billPayment')
  const all = await prisma.billPayment.findMany({
    where: { number: { startsWith: config.prefix } },
    select: { number: true },
    orderBy: { number: 'desc' },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(all.map((record) => record.number), config)
  return formatBillPaymentNumber(nextSequence, config)
}
