'use client'

import type {
  FulfillmentDetailCustomizationConfig,
  FulfillmentDetailFieldKey,
} from '@/lib/fulfillment-detail-customization'
import TransactionDetailCustomizeMode from '@/components/TransactionDetailCustomizeMode'
import {
  FULFILLMENT_LINE_COLUMNS,
  FULFILLMENT_STAT_CARDS,
} from '@/lib/fulfillment-detail-customization'

type CustomizeField = {
  id: FulfillmentDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

export default function FulfillmentDetailCustomizeMode({
  detailHref,
  initialLayout,
  fields,
  sectionDescriptions,
}: {
  detailHref: string
  initialLayout: FulfillmentDetailCustomizationConfig
  fields: CustomizeField[]
  sectionDescriptions?: Record<string, string>
}) {
  return (
    <TransactionDetailCustomizeMode
      detailHref={detailHref}
      initialLayout={initialLayout}
      fields={fields}
      saveEndpoint="/api/config/fulfillment-detail-customization"
      sectionDescriptions={sectionDescriptions}
      statCardDefinitions={FULFILLMENT_STAT_CARDS}
      lineColumnDefinitions={FULFILLMENT_LINE_COLUMNS}
      statCardsTitle="Stat Cards"
      statCardsIntro="Control which summary cards appear at the top of the fulfillment detail page and their order."
      lineColumnsTitle="Fulfillment Lines Columns"
      lineColumnsIntro="Control whether a fulfillment line column shows and its default order."
    />
  )
}
