import { NextResponse } from 'next/server'
import {
  loadCompanyPreferencesSettings,
  saveCompanyPreferencesSettings,
} from '@/lib/company-preferences-store'

export async function GET() {
  try {
    const settings = await loadCompanyPreferencesSettings()
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const settings = await saveCompanyPreferencesSettings(body)
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
