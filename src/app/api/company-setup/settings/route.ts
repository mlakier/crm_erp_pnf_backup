import { NextRequest, NextResponse } from 'next/server'
import {
  loadCompanySetupSettings,
  saveCompanySetupSettings,
} from '@/lib/company-setup-settings-store'

export async function GET() {
  try {
    const settings = await loadCompanySetupSettings()
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: 'Failed to load company setup settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const saved = await saveCompanySetupSettings(body)
    return NextResponse.json(saved)
  } catch {
    return NextResponse.json({ error: 'Failed to save company setup settings' }, { status: 500 })
  }
}
