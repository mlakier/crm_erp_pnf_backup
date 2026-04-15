import { prisma } from '@/lib/prisma'

const USER_NUMBER_PREFIX = 'USER-'
const USER_NUMBER_WIDTH = 6

export function formatUserNumber(sequence: number) {
  return `${USER_NUMBER_PREFIX}${String(sequence).padStart(USER_NUMBER_WIDTH, '0')}`
}

export async function generateNextUserNumber() {
  const latestUser = await prisma.user.findFirst({
    where: {
      userId: {
        not: null,
      },
    },
    orderBy: {
      userId: 'desc',
    },
    select: {
      userId: true,
    },
  })

  const latestSequence = latestUser?.userId
    ? Number.parseInt(latestUser.userId.replace(USER_NUMBER_PREFIX, ''), 10)
    : 0

  return formatUserNumber(Number.isNaN(latestSequence) ? 1 : latestSequence + 1)
}
