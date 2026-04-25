import { NextRequest, NextResponse } from 'next/server'
import {
  defaultQuoteDetailCustomization,
  QUOTE_DETAIL_FIELDS,
  type QuoteDetailCustomizationConfig,
} from '@/lib/quotes-detail-customization'
import {
  loadQuoteDetailCustomization,
  saveQuoteDetailCustomization,
} from '@/lib/quotes-detail-customization-store'

function sanitizeInput(input: unknown): QuoteDetailCustomizationConfig {
  const defaults = defaultQuoteDetailCustomization()
  if (!input || typeof input !== 'object') return defaults
  return {
    ...defaults,
    ...(input as Partial<QuoteDetailCustomizationConfig>),
  }
}

export async function GET() {
  try {
    const config = await loadQuoteDetailCustomization()
    return NextResponse.json({ config, fields: QUOTE_DETAIL_FIELDS })
  } catch {
    return NextResponse.json({ error: 'Failed to load quotes detail customization' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const inputConfig = (body as { config?: unknown })?.config
    const sanitized = sanitizeInput(inputConfig)
    const saved = await saveQuoteDetailCustomization(sanitized)
    return NextResponse.json({ config: saved, fields: QUOTE_DETAIL_FIELDS })
  } catch {
    return NextResponse.json({ error: 'Failed to save quotes detail customization' }, { status: 500 })
  }
}
