import { prisma } from '@/lib/prisma'

export type MasterDataSystemInfo = {
  createdAt: Date
  updatedAt: Date
  createdBy: string
  lastModifiedBy: string
}

function displayUser(user?: { userId: string | null; name: string | null; email: string } | null) {
  if (!user) return null
  const label = user.name ?? user.email
  return user.userId ? `${user.userId} - ${label}` : label
}

export async function loadMasterDataSystemInfo({
  entityType,
  entityId,
  createdAt,
  updatedAt,
  fallbackCreatedByUserId,
}: {
  entityType: string
  entityId: string
  createdAt: Date
  updatedAt: Date
  fallbackCreatedByUserId?: string | null
}): Promise<MasterDataSystemInfo> {
  const [createdActivity, updatedActivity] = await Promise.all([
    prisma.activity.findFirst({
      where: { entityType, entityId, action: 'create' },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    }),
    prisma.activity.findFirst({
      where: { entityType, entityId, action: 'update' },
      orderBy: { createdAt: 'desc' },
      select: { userId: true },
    }),
  ])

  const userIds = Array.from(new Set([
    createdActivity?.userId,
    updatedActivity?.userId,
    fallbackCreatedByUserId,
  ].filter((value): value is string => Boolean(value))))

  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, userId: true, name: true, email: true },
      })
    : []
  const userById = new Map(users.map((user) => [user.id, user]))

  const createdBy = displayUser(userById.get(createdActivity?.userId ?? ''))
    ?? displayUser(userById.get(fallbackCreatedByUserId ?? ''))
    ?? 'System'
  const lastModifiedBy = displayUser(userById.get(updatedActivity?.userId ?? '')) ?? '-'

  return {
    createdAt,
    updatedAt,
    createdBy,
    lastModifiedBy,
  }
}
