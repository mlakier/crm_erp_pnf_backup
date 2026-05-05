import { NextRequest, NextResponse } from 'next/server'
import {
  VENDOR_REFUND_DETAIL_FIELDS,
  VENDOR_REFUND_STAT_CARDS,
  defaultVendorRefundDetailCustomization,
  type VendorRefundDetailCustomizationConfig,
} from '@/lib/vendor-refund-detail-customization'
import { TRANSACTION_GL_IMPACT_COLUMNS } from '@/lib/transaction-gl-impact'
import {
  loadVendorRefundDetailCustomization,
  saveVendorRefundDetailCustomization,
} from '@/lib/vendor-refund-detail-customization-store'

export async function GET() {
  try {
    const config = await loadVendorRefundDetailCustomization()
    return NextResponse.json({
      config,
      fields: VENDOR_REFUND_DETAIL_FIELDS,
      glImpactColumns: TRANSACTION_GL_IMPACT_COLUMNS,
      statCards: VENDOR_REFUND_STAT_CARDS,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load vendor refunds detail customization' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = ((body as { config?: unknown }).config ?? defaultVendorRefundDetailCustomization()) as Record<string, unknown>
    const defaults = defaultVendorRefundDetailCustomization()
    const nextConfig = {
      ...defaults,
      ...(input as Partial<VendorRefundDetailCustomizationConfig>),
      glImpactSettings:
        input.glImpactSettings && typeof input.glImpactSettings === 'object'
          ? (input.glImpactSettings as VendorRefundDetailCustomizationConfig['glImpactSettings'])
          : input.secondarySettings && typeof input.secondarySettings === 'object'
            ? (input.secondarySettings as VendorRefundDetailCustomizationConfig['glImpactSettings'])
            : defaults.glImpactSettings,
      glImpactColumns:
        input.glImpactColumns && typeof input.glImpactColumns === 'object'
          ? (input.glImpactColumns as VendorRefundDetailCustomizationConfig['glImpactColumns'])
          : input.secondaryColumns && typeof input.secondaryColumns === 'object'
            ? (input.secondaryColumns as VendorRefundDetailCustomizationConfig['glImpactColumns'])
            : defaults.glImpactColumns,
    } as VendorRefundDetailCustomizationConfig
    const saved = await saveVendorRefundDetailCustomization(nextConfig)
    return NextResponse.json({
      config: saved,
      fields: VENDOR_REFUND_DETAIL_FIELDS,
      glImpactColumns: TRANSACTION_GL_IMPACT_COLUMNS,
      statCards: VENDOR_REFUND_STAT_CARDS,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to save vendor refunds detail customization' }, { status: 500 })
  }
}
