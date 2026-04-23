import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatCustomerNumber(sequence: number, config = DEFAULT_ID_SETTINGS.customer) {
  return formatIdentifier(sequence, config)
}

export async function generateNextCustomerNumber() {
  const config = await loadIdSetting('customer')
  const latestCustomers = await prisma.customer.findMany({
    where: { customerId: { startsWith: config.prefix } },
    orderBy: { customerId: 'desc' },
    select: { customerId: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestCustomers.map((customer) => customer.customerId), config)
  return formatCustomerNumber(nextSequence, config)
}
