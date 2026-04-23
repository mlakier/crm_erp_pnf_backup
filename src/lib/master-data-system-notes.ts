import { parseFieldChangeSummary } from '@/lib/activity'
import { prisma } from '@/lib/prisma'
import type { SystemNoteRow } from '@/components/SystemNotesSection'

function displayUser(user?: { userId: string | null; name: string | null; email: string } | null) {
  if (!user) return null
  const label = user.name ?? user.email
  return user.userId ? `${user.userId} - ${label}` : label
}

function formatAction(action: string) {
  if (!action) return 'Activity'
  return action.charAt(0).toUpperCase() + action.slice(1)
}

export async function loadMasterDataSystemNotes({
  entityType,
  entityId,
}: {
  entityType: string
  entityId: string
}): Promise<SystemNoteRow[]> {
  const activities = await prisma.activity.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      action: true,
      summary: true,
      userId: true,
      createdAt: true,
    },
  })

  const userIds = Array.from(new Set(activities.map((activity) => activity.userId).filter((value): value is string => Boolean(value))))
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, userId: true, name: true, email: true },
      })
    : []
  const userById = new Map(users.map((user) => [user.id, user]))

  return activities.map((activity) => {
    const parsed = parseFieldChangeSummary(activity.summary)
    const setBy = displayUser(userById.get(activity.userId ?? '')) ?? 'System'

    if (parsed) {
      return {
        id: activity.id,
        date: activity.createdAt.toLocaleString(),
        setBy,
        context: parsed.context,
        fieldName: parsed.fieldName,
        oldValue: parsed.oldValue || '-',
        newValue: parsed.newValue || '-',
      }
    }

    return {
      id: activity.id,
      date: activity.createdAt.toLocaleString(),
      setBy,
      context: 'Record',
      fieldName: formatAction(activity.action),
      oldValue: '-',
      newValue: activity.summary || '-',
    }
  })
}
