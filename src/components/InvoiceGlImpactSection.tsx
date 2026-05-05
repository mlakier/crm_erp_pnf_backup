'use client'

import PurchaseOrderGlImpactSection, { type PurchaseOrderGlImpactRow } from '@/components/PurchaseOrderGlImpactSection'
import type { TransactionGlImpactColumnCustomization, TransactionGlImpactSettings } from '@/lib/transaction-gl-impact'

export type InvoiceGlImpactRow = PurchaseOrderGlImpactRow

export default function InvoiceGlImpactSection({
  rows,
  settings,
  columnCustomization,
  currencyCodes,
}: {
  rows: InvoiceGlImpactRow[]
  settings?: TransactionGlImpactSettings
  columnCustomization?: Record<string, TransactionGlImpactColumnCustomization>
  currencyCodes?: {
    transaction?: string | null
    local?: string | null
    functional?: string | null
    group?: string | null
  }
}) {
  return (
    <PurchaseOrderGlImpactSection
      rows={rows}
      settings={settings}
      columnCustomization={columnCustomization}
      currencyCodes={currencyCodes}
    />
  )
}
