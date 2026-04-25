import { NextRequest, NextResponse } from 'next/server'
import {
  defaultInvoiceDetailCustomization,
  INVOICE_DETAIL_FIELDS,
  INVOICE_LINE_COLUMNS,
  INVOICE_STAT_CARDS,
  type InvoiceDetailCustomizationConfig,
} from '@/lib/invoice-detail-customization'
import {
  loadInvoiceDetailCustomization,
  saveInvoiceDetailCustomization,
} from '@/lib/invoice-detail-customization-store'

function sanitizeInput(input: unknown): InvoiceDetailCustomizationConfig {
  const defaults = defaultInvoiceDetailCustomization()
  if (!input || typeof input !== 'object') return defaults
  return {
    ...defaults,
    ...(input as Partial<InvoiceDetailCustomizationConfig>),
  }
}

export async function GET() {
  try {
    const config = await loadInvoiceDetailCustomization()
    return NextResponse.json({ config, fields: INVOICE_DETAIL_FIELDS, lineColumns: INVOICE_LINE_COLUMNS, statCards: INVOICE_STAT_CARDS })
  } catch {
    return NextResponse.json({ error: 'Failed to load invoice detail customization' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const inputConfig = (body as { config?: unknown })?.config
    const sanitized = sanitizeInput(inputConfig)
    const saved = await saveInvoiceDetailCustomization(sanitized)
    return NextResponse.json({ config: saved, fields: INVOICE_DETAIL_FIELDS, lineColumns: INVOICE_LINE_COLUMNS, statCards: INVOICE_STAT_CARDS })
  } catch {
    return NextResponse.json({ error: 'Failed to save invoice detail customization' }, { status: 500 })
  }
}
