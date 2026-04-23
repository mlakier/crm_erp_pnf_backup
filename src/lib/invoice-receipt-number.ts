import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatInvoiceReceiptNumber(sequence: number, config = DEFAULT_ID_SETTINGS.invoiceReceipt) {
  return formatIdentifier(sequence, config)
}

export async function generateInvoiceReceiptNumber(): Promise<string> {
  const config = await loadIdSetting('invoiceReceipt')
  const all = await prisma.cashReceipt.findMany({
    where: { number: { startsWith: config.prefix } },
    select: { number: true },
    orderBy: { number: 'desc' },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(all.map((record) => record.number), config)
  return formatInvoiceReceiptNumber(nextSequence, config)
}
