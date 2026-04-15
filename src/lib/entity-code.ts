import { prisma } from '@/lib/prisma'

const ENTITY_CODE_PREFIX = 'SUB-'
const ENTITY_CODE_WIDTH = 3

export function formatEntityCode(sequence: number) {
  return `${ENTITY_CODE_PREFIX}${String(sequence).padStart(ENTITY_CODE_WIDTH, '0')}`
}

export async function generateNextEntityCode() {
  const latestEntity = await prisma.entity.findFirst({
    where: {
      subsidiaryId: {
        startsWith: ENTITY_CODE_PREFIX,
      },
    },
    orderBy: {
      subsidiaryId: 'desc',
    },
    select: {
      subsidiaryId: true,
    },
  })

  const latestSequence = latestEntity?.subsidiaryId
    ? Number.parseInt(latestEntity.subsidiaryId.replace(ENTITY_CODE_PREFIX, ''), 10)
    : 0

  return formatEntityCode(Number.isNaN(latestSequence) ? 1 : latestSequence + 1)
}