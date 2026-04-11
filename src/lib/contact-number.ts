import { prisma } from '@/lib/prisma'

const CONTACT_NUMBER_PREFIX = 'CONT-'
const CONTACT_NUMBER_WIDTH = 6

export function formatContactNumber(sequence: number) {
  return `${CONTACT_NUMBER_PREFIX}${String(sequence).padStart(CONTACT_NUMBER_WIDTH, '0')}`
}

export async function generateNextContactNumber() {
  const latestContact = await prisma.contact.findFirst({
    where: {
      contactNumber: {
        not: null,
      },
    },
    orderBy: {
      contactNumber: 'desc',
    },
    select: {
      contactNumber: true,
    },
  })

  const latestSequence = latestContact?.contactNumber
    ? Number.parseInt(latestContact.contactNumber.replace(CONTACT_NUMBER_PREFIX, ''), 10)
    : 0

  return formatContactNumber(Number.isNaN(latestSequence) ? 1 : latestSequence + 1)
}