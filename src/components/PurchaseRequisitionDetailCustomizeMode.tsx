'use client'

import type {
  PurchaseRequisitionDetailCustomizationConfig,
  PurchaseRequisitionDetailFieldKey,
} from '@/lib/purchase-requisitions-detail-customization'
import TransactionDetailCustomizeMode from '@/components/TransactionDetailCustomizeMode'

type CustomizeField = {
  id: PurchaseRequisitionDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

export default function PurchaseRequisitionDetailCustomizeMode({
  detailHref,
  initialLayout,
  fields,
  sectionDescriptions,
}: {
  detailHref: string
  initialLayout: PurchaseRequisitionDetailCustomizationConfig
  fields: CustomizeField[]
  sectionDescriptions?: Record<string, string>
}) {
  return (
    <TransactionDetailCustomizeMode
      detailHref={detailHref}
      initialLayout={initialLayout}
      fields={fields}
      saveEndpoint="/api/config/purchase-requisitions-detail-customization"
      introText="Edit the purchase requisition detail layout in context. Each filled box is a field placement, and empty boxes are open grid cells."
      sectionDescriptions={sectionDescriptions}
    />
  )
}
