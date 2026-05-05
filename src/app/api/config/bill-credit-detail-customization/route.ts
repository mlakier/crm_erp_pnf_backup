import { NextRequest, NextResponse } from 'next/server'
import {
  BILL_CREDIT_DETAIL_FIELDS,
  BILL_CREDIT_STAT_CARDS,
  defaultBillCreditDetailCustomization,
  type BillCreditDetailCustomizationConfig,
} from '@/lib/bill-credit-detail-customization'
import {
  loadBillCreditDetailCustomization,
  saveBillCreditDetailCustomization,
} from '@/lib/bill-credit-detail-customization-store'

export async function GET() {
  try {
    const config = await loadBillCreditDetailCustomization()
    return NextResponse.json({ config, fields: BILL_CREDIT_DETAIL_FIELDS, statCards: BILL_CREDIT_STAT_CARDS })
  } catch {
    return NextResponse.json({ error: 'Failed to load bill-credit detail customization' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = ((body as { config?: unknown }).config ?? defaultBillCreditDetailCustomization()) as Record<string, unknown>
    const defaults = defaultBillCreditDetailCustomization()
    const nextConfig = {
      ...defaults,
      ...(input as Partial<BillCreditDetailCustomizationConfig>),
      glImpactSettings:
        input.glImpactSettings && typeof input.glImpactSettings === 'object'
          ? (input.glImpactSettings as BillCreditDetailCustomizationConfig['glImpactSettings'])
          : input.secondarySettings && typeof input.secondarySettings === 'object'
            ? (input.secondarySettings as BillCreditDetailCustomizationConfig['glImpactSettings'])
            : defaults.glImpactSettings,
      glImpactColumns:
        input.glImpactColumns && typeof input.glImpactColumns === 'object'
          ? (input.glImpactColumns as BillCreditDetailCustomizationConfig['glImpactColumns'])
          : input.secondaryColumns && typeof input.secondaryColumns === 'object'
            ? (input.secondaryColumns as BillCreditDetailCustomizationConfig['glImpactColumns'])
            : defaults.glImpactColumns,
    } as BillCreditDetailCustomizationConfig
    const saved = await saveBillCreditDetailCustomization(nextConfig)
    return NextResponse.json({ config: saved, fields: BILL_CREDIT_DETAIL_FIELDS, statCards: BILL_CREDIT_STAT_CARDS })
  } catch {
    return NextResponse.json({ error: 'Failed to save bill-credit detail customization' }, { status: 500 })
  }
}
