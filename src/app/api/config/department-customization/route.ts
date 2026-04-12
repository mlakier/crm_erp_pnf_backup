import { NextRequest, NextResponse } from 'next/server'
import {
  DEPARTMENT_COLUMN_IDS,
  DEPARTMENT_OPTIONAL_FIELD_KEYS,
  cloneDepartmentCustomizationDefaults,
} from '@/lib/department-customization'
import { loadDepartmentCustomization, saveDepartmentCustomization } from '@/lib/department-customization-store'

export async function GET() {
  try {
    const config = await loadDepartmentCustomization()
    return NextResponse.json({
      fields: DEPARTMENT_OPTIONAL_FIELD_KEYS,
      columns: DEPARTMENT_COLUMN_IDS,
      config,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load department customization' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const config = (body as { config?: unknown })?.config ?? cloneDepartmentCustomizationDefaults()
    const saved = await saveDepartmentCustomization(config)

    return NextResponse.json({
      fields: DEPARTMENT_OPTIONAL_FIELD_KEYS,
      columns: DEPARTMENT_COLUMN_IDS,
      config: saved,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to save department customization' }, { status: 500 })
  }
}
