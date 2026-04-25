'use client'

import TransactionDetailCustomizeMode from '@/components/TransactionDetailCustomizeMode'
import {
  JOURNAL_STAT_CARDS,
  type JournalDetailCustomizationConfig,
  type JournalDetailFieldKey,
} from '@/lib/journal-detail-customization'

type CustomizeField = {
  id: JournalDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

export default function JournalDetailCustomizeMode({
  detailHref,
  initialLayout,
  fields,
  sectionDescriptions,
}: {
  detailHref: string
  initialLayout: JournalDetailCustomizationConfig
  fields: CustomizeField[]
  sectionDescriptions?: Record<string, string>
}) {
  return (
    <TransactionDetailCustomizeMode
      detailHref={detailHref}
      initialLayout={initialLayout}
      fields={fields}
      saveEndpoint="/api/config/journal-detail-customization"
      introText="Edit the journal detail layout in context. Each filled box is a field placement, and empty boxes are open grid cells."
      sectionDescriptions={sectionDescriptions}
      statCardDefinitions={JOURNAL_STAT_CARDS}
      statCardsTitle="Stat Cards"
      statCardsIntro="Control which summary cards appear at the top of the journal detail page and their order."
    />
  )
}
