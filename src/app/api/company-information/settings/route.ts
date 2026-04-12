import { NextRequest, NextResponse } from 'next/server'
import {
  loadCompanyInformationSettings,
  saveCompanyInformationSettings,
} from '@/lib/company-information-settings-store'

export async function GET() {
  try {
    const settings = await loadCompanyInformationSettings()
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const saved = await saveCompanyInformationSettings(body)
    return NextResponse.json(saved)
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
