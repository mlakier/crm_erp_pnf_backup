import { NextRequest, NextResponse } from 'next/server'
import {
  defaultJournalDetailCustomization,
  JOURNAL_DETAIL_FIELDS,
  JOURNAL_STAT_CARDS,
  type JournalDetailCustomizationConfig,
  type JournalDetailFieldKey,
  type JournalStatCardKey,
} from '@/lib/journal-detail-customization'
import {
  loadJournalDetailCustomization,
  saveJournalDetailCustomization,
} from '@/lib/journal-detail-customization-store'

function sanitizeInput(input: unknown): JournalDetailCustomizationConfig {
  const defaults = defaultJournalDetailCustomization()
  if (!input || typeof input !== 'object') return defaults

  const root = input as Record<string, unknown>
  const formColumns =
    typeof root.formColumns === 'number' && Number.isFinite(root.formColumns)
      ? Math.min(4, Math.max(1, Math.trunc(root.formColumns)))
      : defaults.formColumns
  const sections = Array.isArray(root.sections)
    ? root.sections.map((section) => String(section ?? '').trim()).filter(Boolean)
    : defaults.sections
  const sectionRowsInput =
    root.sectionRows && typeof root.sectionRows === 'object'
      ? (root.sectionRows as Record<string, unknown>)
      : {}
  const fieldsInput = root.fields && typeof root.fields === 'object' ? (root.fields as Record<string, unknown>) : {}

  const fields = Object.fromEntries(
    JOURNAL_DETAIL_FIELDS.map((field) => {
      const fieldInput =
        fieldsInput[field.id] && typeof fieldsInput[field.id] === 'object'
          ? (fieldsInput[field.id] as Record<string, unknown>)
          : {}

      return [
        field.id,
        {
          visible: fieldInput.visible === undefined ? defaults.fields[field.id].visible : fieldInput.visible === true,
          section:
            String(fieldInput.section ?? defaults.fields[field.id].section).trim() ||
            defaults.fields[field.id].section,
          order:
            typeof fieldInput.order === 'number' && Number.isFinite(fieldInput.order)
              ? fieldInput.order
              : defaults.fields[field.id].order,
          column:
            typeof fieldInput.column === 'number' && Number.isFinite(fieldInput.column)
              ? Math.min(formColumns, Math.max(1, Math.trunc(fieldInput.column)))
              : defaults.fields[field.id].column,
        },
      ]
    }),
  ) as Record<JournalDetailFieldKey, JournalDetailCustomizationConfig['fields'][JournalDetailFieldKey]>

  const finalSections = sections.length > 0 ? Array.from(new Set(sections)) : defaults.sections
  const validStatMetrics = new Set(JOURNAL_STAT_CARDS.map((card) => card.id))
  const statCardInputs = Array.isArray(root.statCards) ? root.statCards : defaults.statCards
  const statCards = statCardInputs
    .map((card, index) => {
      if (!card || typeof card !== 'object') return null
      const value = card as Record<string, unknown>
      const metric = String(value.metric ?? '').trim() as JournalStatCardKey
      if (!validStatMetrics.has(metric)) return null
      return {
        id: String(value.id ?? `slot-${index + 1}`),
        metric,
        visible: value.visible !== false,
        order:
          typeof value.order === 'number' && Number.isFinite(value.order)
            ? Math.max(0, Math.trunc(value.order))
            : index,
      }
    })
    .filter((card): card is JournalDetailCustomizationConfig['statCards'][number] => Boolean(card))
    .sort((left, right) => left.order - right.order)
    .map((card, index) => ({ ...card, order: index }))

  return {
    formColumns,
    sections: finalSections,
    sectionRows: Object.fromEntries(
      finalSections.map((section) => [
        section,
        typeof sectionRowsInput[section] === 'number' && Number.isFinite(sectionRowsInput[section])
          ? Math.min(12, Math.max(1, Math.trunc(sectionRowsInput[section] as number)))
          : (defaults.sectionRows[section] ?? 2),
      ]),
    ),
    fields,
    statCards: statCards.length > 0 ? statCards : defaults.statCards,
  }
}

export async function GET() {
  try {
    const config = await loadJournalDetailCustomization()
    return NextResponse.json({ config, fields: JOURNAL_DETAIL_FIELDS })
  } catch {
    return NextResponse.json({ error: 'Failed to load journal detail customization' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const sanitized = sanitizeInput((body as { config?: unknown })?.config)
    const saved = await saveJournalDetailCustomization(sanitized)
    return NextResponse.json({ config: saved, fields: JOURNAL_DETAIL_FIELDS })
  } catch {
    return NextResponse.json({ error: 'Failed to save journal detail customization' }, { status: 500 })
  }
}
