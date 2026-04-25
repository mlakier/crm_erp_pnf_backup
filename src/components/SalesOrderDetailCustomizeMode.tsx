'use client'

import TransactionDetailCustomizeMode from '@/components/TransactionDetailCustomizeMode'
import {
  SALES_ORDER_LINE_COLUMNS,
  SALES_ORDER_STAT_CARDS,
  type SalesOrderDetailCustomizationConfig,
  type SalesOrderDetailFieldKey,
} from '@/lib/sales-order-detail-customization'

type CustomizeField = {
  id: SalesOrderDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

export default function SalesOrderDetailCustomizeMode({
  detailHref,
  initialLayout,
  fields,
  sectionDescriptions,
}: {
  detailHref: string
  initialLayout: SalesOrderDetailCustomizationConfig
  fields: CustomizeField[]
  sectionDescriptions?: Record<string, string>
}) {
  return (
    <TransactionDetailCustomizeMode
      detailHref={detailHref}
      initialLayout={initialLayout}
      fields={fields}
      saveEndpoint="/api/config/sales-order-detail-customization"
      introText="Edit the sales order detail layout in context. Each filled box is a field placement, and empty boxes are open grid cells."
      sectionDescriptions={sectionDescriptions}
      statCardDefinitions={SALES_ORDER_STAT_CARDS}
      lineColumnDefinitions={SALES_ORDER_LINE_COLUMNS}
      statCardsTitle="Stat Cards"
      statCardsIntro="Control which summary cards appear at the top of the sales order detail page and their order."
      lineColumnsTitle="Sales Order Line Items Columns"
      lineColumnsIntro="Control whether a sales order line-item column shows and its default order."
    />
  )
}
