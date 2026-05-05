'use client'

import TransactionGlImpactSection from '@/components/TransactionGlImpactSection'
import type {
  TransactionGlImpactColumnCustomization,
  TransactionGlImpactRow,
  TransactionGlImpactSettings,
} from '@/lib/transaction-gl-impact'

export default function CreditDocumentGlImpactSection({
  rows,
  settings,
  columnCustomization,
  currencyCodes,
}: {
  rows: TransactionGlImpactRow[]
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
    <TransactionGlImpactSection
      rows={rows}
      settings={settings}
      columnCustomization={columnCustomization}
      currencyCodes={currencyCodes}
      title="GL Impact"
      emptyMessage="No posted accounting impact is linked to this credit document yet."
    />
  )
}
