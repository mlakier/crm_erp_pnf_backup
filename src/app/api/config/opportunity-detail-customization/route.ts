import { NextRequest, NextResponse } from 'next/server'
import {
  defaultOpportunityDetailCustomization,
  OPPORTUNITY_DETAIL_FIELDS,
  type OpportunityDetailCustomizationConfig,
} from '@/lib/opportunity-detail-customization'
import {
  loadOpportunityDetailCustomization,
  saveOpportunityDetailCustomization,
} from '@/lib/opportunity-detail-customization-store'

export async function GET() {
  try {
    const config = await loadOpportunityDetailCustomization()
    return NextResponse.json({ config, fields: OPPORTUNITY_DETAIL_FIELDS })
  } catch {
    return NextResponse.json({ error: 'Failed to load opportunity detail customization' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const nextConfig =
      ((body as { config?: unknown }).config as OpportunityDetailCustomizationConfig | undefined) ??
      defaultOpportunityDetailCustomization()
    const saved = await saveOpportunityDetailCustomization(nextConfig)
    return NextResponse.json({ config: saved, fields: OPPORTUNITY_DETAIL_FIELDS })
  } catch {
    return NextResponse.json({ error: 'Failed to save opportunity detail customization' }, { status: 500 })
  }
}
