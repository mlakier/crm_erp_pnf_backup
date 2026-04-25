'use client'

import TransactionDetailCustomizeMode from '@/components/TransactionDetailCustomizeMode'
import {
  OPPORTUNITY_LINE_COLUMNS,
  OPPORTUNITY_STAT_CARDS,
  type OpportunityDetailCustomizationConfig,
  type OpportunityDetailFieldKey,
} from '@/lib/opportunity-detail-customization'

type CustomizeField = {
  id: OpportunityDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

export default function OpportunityDetailCustomizeMode({
  detailHref,
  initialLayout,
  fields,
  sectionDescriptions,
}: {
  detailHref: string
  initialLayout: OpportunityDetailCustomizationConfig
  fields: CustomizeField[]
  sectionDescriptions?: Record<string, string>
}) {
  return (
    <TransactionDetailCustomizeMode
      detailHref={detailHref}
      initialLayout={initialLayout}
      fields={fields}
      saveEndpoint="/api/config/opportunity-detail-customization"
      introText="Edit the opportunity detail layout in context. Each filled box is a field placement, and empty boxes are open grid cells."
      sectionDescriptions={sectionDescriptions}
      lineColumnDefinitions={OPPORTUNITY_LINE_COLUMNS}
      lineColumnsTitle="Opportunity Line Items Columns"
      lineColumnsIntro="Control whether an opportunity line-item column shows and its default order."
      statCardDefinitions={OPPORTUNITY_STAT_CARDS}
      statCardsTitle="Stat Cards"
      statCardsIntro="Control which summary cards appear at the top of the opportunity detail page and their order."
    />
  )
}
