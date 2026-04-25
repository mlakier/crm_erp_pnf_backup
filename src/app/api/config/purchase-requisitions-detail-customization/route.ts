import { NextRequest, NextResponse } from 'next/server'
import {
  defaultPurchaseRequisitionDetailCustomization,
  PURCHASE_REQUISITION_DETAIL_FIELDS,
  type PurchaseRequisitionDetailCustomizationConfig,
} from '@/lib/purchase-requisitions-detail-customization'
import {
  loadPurchaseRequisitionDetailCustomization,
  savePurchaseRequisitionDetailCustomization,
} from '@/lib/purchase-requisitions-detail-customization-store'

function sanitizeInput(input: unknown): PurchaseRequisitionDetailCustomizationConfig {
  const defaults = defaultPurchaseRequisitionDetailCustomization()
  if (!input || typeof input !== 'object') return defaults
  return {
    ...defaults,
    ...(input as Partial<PurchaseRequisitionDetailCustomizationConfig>),
  }
}

export async function GET() {
  try {
    const config = await loadPurchaseRequisitionDetailCustomization()
    return NextResponse.json({ config, fields: PURCHASE_REQUISITION_DETAIL_FIELDS })
  } catch {
    return NextResponse.json({ error: 'Failed to load purchase-requisitions detail customization' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const inputConfig = (body as { config?: unknown })?.config
    const sanitized = sanitizeInput(inputConfig)
    const saved = await savePurchaseRequisitionDetailCustomization(sanitized)
    return NextResponse.json({ config: saved, fields: PURCHASE_REQUISITION_DETAIL_FIELDS })
  } catch {
    return NextResponse.json({ error: 'Failed to save purchase-requisitions detail customization' }, { status: 500 })
  }
}
