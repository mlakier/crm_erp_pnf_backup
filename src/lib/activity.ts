import { prisma } from '@/lib/prisma'

export async function logActivity({
  entityType,
  entityId,
  action,
  summary,
  userId,
}: {
  entityType: string
  entityId: string
  action: 'create' | 'update' | 'delete'
  summary: string
  userId?: string | null
}) {
  try {
    await prisma.activity.create({
      data: {
        entityType,
        entityId,
        action,
        summary,
        userId: userId ?? null,
      },
    })
  } catch {
    // Activity logging must never block business operations.
  }
}
