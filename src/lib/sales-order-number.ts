import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatSalesOrderNumber(sequence: number, config = DEFAULT_ID_SETTINGS.salesOrder) {
  return formatIdentifier(sequence, config)
}

export async function generateNextSalesOrderNumber() {
  const config = await loadIdSetting('salesOrder')
  const latestOrders = await prisma.salesOrder.findMany({
    where: { number: { startsWith: config.prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestOrders.map((order) => order.number), config)
  return formatSalesOrderNumber(nextSequence, config)
}
