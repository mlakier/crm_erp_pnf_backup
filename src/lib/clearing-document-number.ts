import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatClearingDocumentNumber(sequence: number, config = DEFAULT_ID_SETTINGS.clearingDocument) {
  return formatIdentifier(sequence, config)
}

export async function generateNextClearingDocumentNumber() {
  const config = await loadIdSetting('clearingDocument')
  const latestEntries = await prisma.clearingDocumentHeader.findMany({
    where: {
      clearingNumber: {
        startsWith: config.prefix,
      },
    },
    orderBy: {
      clearingNumber: 'desc',
    },
    select: {
      clearingNumber: true,
    },
    take: 200,
  })

  const nextSequence = getNextSequenceFromValues(
    latestEntries.map((entry) => entry.clearingNumber),
    config,
  )

  return formatClearingDocumentNumber(nextSequence, config)
}
