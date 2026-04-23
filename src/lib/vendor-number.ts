import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatVendorNumber(sequence: number, config = DEFAULT_ID_SETTINGS.vendor) {
  return formatIdentifier(sequence, config)
}

export async function generateNextVendorNumber() {
  const config = await loadIdSetting('vendor')
  const latestVendors = await prisma.vendor.findMany({
    where: { vendorNumber: { startsWith: config.prefix } },
    orderBy: { vendorNumber: 'desc' },
    select: { vendorNumber: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestVendors.map((vendor) => vendor.vendorNumber), config)
  return formatVendorNumber(nextSequence, config)
}
