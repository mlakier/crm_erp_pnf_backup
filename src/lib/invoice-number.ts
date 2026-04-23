import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatInvoiceNumber(sequence: number, config = DEFAULT_ID_SETTINGS.invoice) {
  return formatIdentifier(sequence, config)
}

export async function generateNextInvoiceNumber() {
  const config = await loadIdSetting('invoice')
  const latestInvoices = await prisma.invoice.findMany({
    where: { number: { startsWith: config.prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestInvoices.map((invoice) => invoice.number), config)
  return formatInvoiceNumber(nextSequence, config)
}
