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

function formatActivityValue(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value
      .map((entry) => formatActivityValue(entry))
      .filter(Boolean)
      .join(', ')
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value)
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
    oldValue: unknown
    newValue: unknown
  }>
}) {
  const normalizedChanges = changes
    .map((change) => ({
      fieldName: change.fieldName,
      oldValue: formatActivityValue(change.oldValue),
      newValue: formatActivityValue(change.newValue),
    }))
    .filter((change) => change.oldValue !== change.newValue)

  if (normalizedChanges.length === 0) return

  try {
    await prisma.activity.createMany({
      data: normalizedChanges.map((change) => ({
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

export async function logRecordSnapshotActivities({
  entityType,
  entityId,
  userId,
  context,
  action,
  fields,
}: {
  entityType: string
  entityId: string
  userId?: string | null
  context: string
  action: 'create' | 'delete'
  fields: Array<{
    fieldName: string
    value: unknown
    context?: string
  }>
}) {
  const changes = fields
    .map((field) => {
      const formattedValue = formatActivityValue(field.value)
      if (!formattedValue) return null
      return {
        fieldName: field.fieldName,
        context: field.context ?? context,
        oldValue: action === 'delete' ? formattedValue : '',
        newValue: action === 'create' ? formattedValue : '',
      }
    })
    .filter((change): change is { fieldName: string; context: string; oldValue: string; newValue: string } => Boolean(change))

  if (changes.length === 0) return

  try {
    await prisma.activity.createMany({
      data: changes.map((change) => ({
        entityType,
        entityId,
        action,
        summary: createFieldChangeSummary({
          context: change.context,
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
