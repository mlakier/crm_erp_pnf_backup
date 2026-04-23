import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatPurchaseOrderNumber(sequence: number, config = DEFAULT_ID_SETTINGS.purchaseOrder) {
  return formatIdentifier(sequence, config)
}

export async function generateNextPurchaseOrderNumber() {
  const config = await loadIdSetting('purchaseOrder')
  const latestOrders = await prisma.purchaseOrder.findMany({
    where: {
      number: {
        startsWith: config.prefix,
      },
    },
    orderBy: {
      number: 'desc',
    },
    select: {
      number: true,
    },
    take: 200,
  })

  const nextSequence = getNextSequenceFromValues(
    latestOrders.map((order) => order.number),
    config,
  )
  return formatPurchaseOrderNumber(nextSequence, config)
}
