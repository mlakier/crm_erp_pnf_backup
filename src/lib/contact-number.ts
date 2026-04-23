import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatContactNumber(sequence: number, config = DEFAULT_ID_SETTINGS.contact) {
  return formatIdentifier(sequence, config)
}

export async function generateNextContactNumber() {
  const config = await loadIdSetting('contact')
  const latestContacts = await prisma.contact.findMany({
    where: { contactNumber: { startsWith: config.prefix } },
    orderBy: { contactNumber: 'desc' },
    select: { contactNumber: true },
    take: 200,
  })
  const nextSequence = getNextSequenceFromValues(latestContacts.map((contact) => contact.contactNumber), config)
  return formatContactNumber(nextSequence, config)
}
