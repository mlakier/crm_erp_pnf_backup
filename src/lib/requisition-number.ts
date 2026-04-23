import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatRequisitionNumber(sequence: number, config = DEFAULT_ID_SETTINGS.purchaseRequisition) {
  return formatIdentifier(sequence, config)
}

export async function generateNextRequisitionNumber() {
  const config = await loadIdSetting('purchaseRequisition')
  const latest = await prisma.requisition.findMany({
    where: { number: { startsWith: config.prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latest.map((req) => req.number), config)
  return formatRequisitionNumber(nextSequence, config)
}
