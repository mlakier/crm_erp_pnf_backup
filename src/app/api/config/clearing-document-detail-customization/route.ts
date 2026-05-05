import { NextRequest, NextResponse } from 'next/server'
import {
  CLEARING_DOCUMENT_DETAIL_FIELDS,
  CLEARING_DOCUMENT_STAT_CARDS,
  defaultClearingDocumentDetailCustomization,
  type ClearingDocumentDetailCustomizationConfig,
} from '@/lib/clearing-document-detail-customization'
import {
  loadClearingDocumentDetailCustomization,
  saveClearingDocumentDetailCustomization,
} from '@/lib/clearing-document-detail-customization-store'

export async function GET() {
  try {
    const config = await loadClearingDocumentDetailCustomization()
    return NextResponse.json({
      config,
      fields: CLEARING_DOCUMENT_DETAIL_FIELDS,
      statCards: CLEARING_DOCUMENT_STAT_CARDS,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load clearing document detail customization' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = ((body as { config?: unknown }).config ?? defaultClearingDocumentDetailCustomization()) as Record<string, unknown>
    const defaults = defaultClearingDocumentDetailCustomization()
    const nextConfig = {
      ...defaults,
      ...(input as Partial<ClearingDocumentDetailCustomizationConfig>),
    } as ClearingDocumentDetailCustomizationConfig
    const saved = await saveClearingDocumentDetailCustomization(nextConfig)
    return NextResponse.json({
      config: saved,
      fields: CLEARING_DOCUMENT_DETAIL_FIELDS,
      statCards: CLEARING_DOCUMENT_STAT_CARDS,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to save clearing document detail customization' }, { status: 500 })
  }
}
