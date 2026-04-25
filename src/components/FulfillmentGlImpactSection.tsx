'use client'

import InvoiceReceiptGlImpactSection, {
  type InvoiceReceiptGlImpactRow,
} from '@/components/InvoiceReceiptGlImpactSection'

export type FulfillmentGlImpactRow = InvoiceReceiptGlImpactRow

export default function FulfillmentGlImpactSection({ rows }: { rows: FulfillmentGlImpactRow[] }) {
  return <InvoiceReceiptGlImpactSection rows={rows} />
}
