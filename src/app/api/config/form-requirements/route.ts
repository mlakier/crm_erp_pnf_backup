import { NextRequest, NextResponse } from 'next/server'
import {
  FORM_FIELD_LABELS,
  FORM_LABELS,
  FORM_REQUIREMENTS,
  FormKey,
  FormRequirementsMap,
} from '@/lib/form-requirements'
import { loadFormRequirements, saveFormRequirements } from '@/lib/form-requirements-store'

function formKeys(): FormKey[] {
  return Object.keys(FORM_REQUIREMENTS) as FormKey[]
}

function sanitizeInput(input: unknown): FormRequirementsMap {
  const clean = JSON.parse(JSON.stringify(FORM_REQUIREMENTS)) as FormRequirementsMap
  if (!input || typeof input !== 'object') return clean

  const root = input as Record<string, unknown>

  for (const form of formKeys()) {
    const formInput = root[form]
    if (!formInput || typeof formInput !== 'object') continue

    const formRecord = formInput as Record<string, unknown>
    for (const field of Object.keys(clean[form])) {
      if (Object.prototype.hasOwnProperty.call(formRecord, field)) {
        clean[form][field] = formRecord[field] === true
      }
    }
  }

  return clean
}

export async function GET() {
  try {
    const config = await loadFormRequirements()
    return NextResponse.json({
      formLabels: FORM_LABELS,
      fieldLabels: FORM_FIELD_LABELS,
      config,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load form requirements' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const inputConfig = (body as { config?: unknown })?.config
    const sanitized = sanitizeInput(inputConfig)
    const saved = await saveFormRequirements(sanitized)

    return NextResponse.json({
      formLabels: FORM_LABELS,
      fieldLabels: FORM_FIELD_LABELS,
      config: saved,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to save form requirements' }, { status: 500 })
  }
}
