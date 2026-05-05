'use client'

import TransactionGlImpactSection from '@/components/TransactionGlImpactSection'
import type {
  TransactionGlImpactColumnCustomization,
  TransactionGlImpactRow,
  TransactionGlImpactSettings,
} from '@/lib/transaction-gl-impact'

export type ClearingDocumentGlImpactRow = TransactionGlImpactRow

export default function ClearingDocumentGlImpactSection({
  rows,
  settings,
  columnCustomization,
}: {
  rows: ClearingDocumentGlImpactRow[]
  settings?: TransactionGlImpactSettings
  columnCustomization?: Record<string, TransactionGlImpactColumnCustomization>
}) {
  return (
    <TransactionGlImpactSection
      rows={rows}
      settings={settings}
      columnCustomization={columnCustomization}
      title="GL Impact"
      emptyMessage="No posted accounting impact is linked to this clearing document yet."
    />
  )
}
