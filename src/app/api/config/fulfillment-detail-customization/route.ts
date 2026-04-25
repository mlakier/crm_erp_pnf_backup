import { NextRequest, NextResponse } from 'next/server'
import {
  defaultFulfillmentDetailCustomization,
  FULFILLMENT_DETAIL_FIELDS,
  type FulfillmentDetailCustomizationConfig,
} from '@/lib/fulfillment-detail-customization'
import {
  loadFulfillmentDetailCustomization,
  saveFulfillmentDetailCustomization,
} from '@/lib/fulfillment-detail-customization-store'

export async function GET() {
  try {
    const config = await loadFulfillmentDetailCustomization()
    return NextResponse.json({ config, fields: FULFILLMENT_DETAIL_FIELDS })
  } catch {
    return NextResponse.json({ error: 'Failed to load fulfillment detail customization' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const nextConfig = ((body as { config?: unknown }).config ??
      defaultFulfillmentDetailCustomization()) as FulfillmentDetailCustomizationConfig
    const saved = await saveFulfillmentDetailCustomization(nextConfig)
    return NextResponse.json({ config: saved, fields: FULFILLMENT_DETAIL_FIELDS })
  } catch {
    return NextResponse.json({ error: 'Failed to save fulfillment detail customization' }, { status: 500 })
  }
}
