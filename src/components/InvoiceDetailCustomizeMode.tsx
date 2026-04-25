'use client'

import type {
  InvoiceDetailCustomizationConfig,
  InvoiceDetailFieldKey,
} from '@/lib/invoice-detail-customization'
import TransactionDetailCustomizeMode from '@/components/TransactionDetailCustomizeMode'
import { INVOICE_LINE_COLUMNS, INVOICE_STAT_CARDS } from '@/lib/invoice-detail-customization'

type CustomizeField = {
  id: InvoiceDetailFieldKey
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

export default function InvoiceDetailCustomizeMode({
  detailHref,
  initialLayout,
  fields,
  sectionDescriptions,
}: {
  detailHref: string
  initialLayout: InvoiceDetailCustomizationConfig
  fields: CustomizeField[]
  sectionDescriptions?: Record<string, string>
}) {
  return (
    <TransactionDetailCustomizeMode
      detailHref={detailHref}
      initialLayout={initialLayout}
      fields={fields}
      saveEndpoint="/api/config/invoice-detail-customization"
      introText="Edit the invoice detail layout in context. Each filled box is a field placement, and empty boxes are open grid cells."
      sectionDescriptions={sectionDescriptions}
      statCardDefinitions={INVOICE_STAT_CARDS}
      lineColumnDefinitions={INVOICE_LINE_COLUMNS}
      statCardsTitle="Stat Cards"
      statCardsIntro="Control which summary cards appear at the top of the invoice detail page and their order."
      lineColumnsTitle="Invoice Line Items Columns"
      lineColumnsIntro="Control whether an invoice line-item column shows and its default order."
    />
  )
}
