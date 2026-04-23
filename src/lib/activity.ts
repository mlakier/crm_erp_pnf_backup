import { prisma } from '@/lib/prisma'

export async function logActivity({
  entityType,
  entityId,
  action,
  summary,
  userId,
  target,
}: {
  entityType?: string
  entityId?: string
  action: string
  summary?: string
  userId?: string | null
  target?: string | null
}) {
  try {
    await prisma.activity.create({
      data: {
        entityType: entityType ?? 'system',
        entityId: entityId ?? target ?? 'system',
        action,
        summary: summary ?? (target ? `${action}: ${target}` : action),
        userId: userId ?? null,
      },
    })
  } catch {
    // Activity logging must never block business operations.
  }
}

type FieldChangeActivityPayload = {
  context: string
  fieldName: string
  oldValue: string
  newValue: string
}

type CommunicationActivityPayload = {
  context: string
  channel: string
  direction: string
  subject: string
  from: string
  to: string
  status: string
  preview: string
}

const FIELD_CHANGE_PREFIX = 'FIELD_CHANGE:'
const COMMUNICATION_PREFIX = 'COMMUNICATION:'

export function createFieldChangeSummary(payload: FieldChangeActivityPayload) {
  return `${FIELD_CHANGE_PREFIX}${JSON.stringify(payload)}`
}

export function parseFieldChangeSummary(summary: string): FieldChangeActivityPayload | null {
  if (!summary.startsWith(FIELD_CHANGE_PREFIX)) return null

  try {
    return JSON.parse(summary.slice(FIELD_CHANGE_PREFIX.length)) as FieldChangeActivityPayload
  } catch {
    return null
  }
}

export function createCommunicationSummary(payload: CommunicationActivityPayload) {
  return `${COMMUNICATION_PREFIX}${JSON.stringify(payload)}`
}

export function parseCommunicationSummary(summary: string): CommunicationActivityPayload | null {
  if (!summary.startsWith(COMMUNICATION_PREFIX)) return null

  try {
    return JSON.parse(summary.slice(COMMUNICATION_PREFIX.length)) as CommunicationActivityPayload
  } catch {
    return null
  }
}

export async function logFieldChangeActivities({
  entityType,
  entityId,
  userId,
  context,
  changes,
}: {
  entityType: string
  entityId: string
  userId?: string | null
  context: string
  changes: Array<{
    fieldName: string
    oldValue: string
    newValue: string
  }>
}) {
  if (changes.length === 0) return

  try {
    await prisma.activity.createMany({
      data: changes.map((change) => ({
        entityType,
        entityId,
        action: 'update',
        summary: createFieldChangeSummary({
          context,
          fieldName: change.fieldName,
          oldValue: change.oldValue,
          newValue: change.newValue,
        }),
        userId: userId ?? null,
      })),
    })
  } catch {
    // Activity logging must never block business operations.
  }
}

export async function logCommunicationActivity({
  entityType,
  entityId,
  userId,
  context,
  channel,
  direction,
  subject,
  from,
  to,
  status,
  preview,
}: {
  entityType: string
  entityId: string
  userId?: string | null
  context: string
  channel: string
  direction: string
  subject: string
  from: string
  to: string
  status: string
  preview?: string
}) {
  await logActivity({
    entityType,
    entityId,
    action: 'update',
    summary: createCommunicationSummary({
      context,
      channel,
      direction,
      subject,
      from,
      to,
      status,
      preview: preview ?? '',
    }),
    userId,
  })
}
