import { NextRequest, NextResponse } from 'next/server'
import {
  CREDIT_MEMO_DETAIL_FIELDS,
  CREDIT_MEMO_STAT_CARDS,
  defaultCreditMemoDetailCustomization,
  type CreditMemoDetailCustomizationConfig,
} from '@/lib/credit-memo-detail-customization'
import {
  loadCreditMemoDetailCustomization,
  saveCreditMemoDetailCustomization,
} from '@/lib/credit-memo-detail-customization-store'

export async function GET() {
  try {
    const config = await loadCreditMemoDetailCustomization()
    return NextResponse.json({ config, fields: CREDIT_MEMO_DETAIL_FIELDS, statCards: CREDIT_MEMO_STAT_CARDS })
  } catch {
    return NextResponse.json({ error: 'Failed to load credit-memo detail customization' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = ((body as { config?: unknown }).config ?? defaultCreditMemoDetailCustomization()) as Record<string, unknown>
    const defaults = defaultCreditMemoDetailCustomization()
    const nextConfig = {
      ...defaults,
      ...(input as Partial<CreditMemoDetailCustomizationConfig>),
      glImpactSettings:
        input.glImpactSettings && typeof input.glImpactSettings === 'object'
          ? (input.glImpactSettings as CreditMemoDetailCustomizationConfig['glImpactSettings'])
          : input.secondarySettings && typeof input.secondarySettings === 'object'
            ? (input.secondarySettings as CreditMemoDetailCustomizationConfig['glImpactSettings'])
            : defaults.glImpactSettings,
      glImpactColumns:
        input.glImpactColumns && typeof input.glImpactColumns === 'object'
          ? (input.glImpactColumns as CreditMemoDetailCustomizationConfig['glImpactColumns'])
          : input.secondaryColumns && typeof input.secondaryColumns === 'object'
            ? (input.secondaryColumns as CreditMemoDetailCustomizationConfig['glImpactColumns'])
            : defaults.glImpactColumns,
    } as CreditMemoDetailCustomizationConfig
    const saved = await saveCreditMemoDetailCustomization(nextConfig)
    return NextResponse.json({ config: saved, fields: CREDIT_MEMO_DETAIL_FIELDS, statCards: CREDIT_MEMO_STAT_CARDS })
  } catch {
    return NextResponse.json({ error: 'Failed to save credit-memo detail customization' }, { status: 500 })
  }
}
