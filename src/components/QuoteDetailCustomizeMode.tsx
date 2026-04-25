'use client'

import TransactionDetailCustomizeMode from '@/components/TransactionDetailCustomizeMode'
import {
  QUOTE_LINE_COLUMNS,
  QUOTE_STAT_CARDS,
  type QuoteDetailCustomizationConfig,
  type QuoteDetailFieldKey,
} from '@/lib/quotes-detail-customization'

type CustomizeField = {
  id: QuoteDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

export default function QuoteDetailCustomizeMode({
  detailHref,
  initialLayout,
  fields,
  sectionDescriptions,
}: {
  detailHref: string
  initialLayout: QuoteDetailCustomizationConfig
  fields: CustomizeField[]
  sectionDescriptions?: Record<string, string>
}) {
  return (
    <TransactionDetailCustomizeMode
      detailHref={detailHref}
      initialLayout={initialLayout}
      fields={fields}
      saveEndpoint="/api/config/quote-detail-customization"
      introText="Edit the quote detail layout in context. Each filled box is a field placement, and empty boxes are open grid cells."
      sectionDescriptions={sectionDescriptions}
      statCardDefinitions={QUOTE_STAT_CARDS}
      lineColumnDefinitions={QUOTE_LINE_COLUMNS}
      statCardsTitle="Stat Cards"
      statCardsIntro="Control which summary cards appear at the top of the quote detail page and their order."
      lineColumnsTitle="Quote Line Items Columns"
      lineColumnsIntro="Control whether a quote line-item column shows and its default order."
    />
  )
}
