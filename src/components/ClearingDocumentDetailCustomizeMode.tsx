'use client'

import type { ClearingDocumentDetailCustomizationConfig } from '@/lib/clearing-document-detail-customization'
import TransactionRecordDetailCustomizeMode from '@/components/TransactionRecordDetailCustomizeMode'
import {
  CLEARING_DOCUMENT_LINE_COLUMNS,
  CLEARING_DOCUMENT_REFERENCE_SOURCES,
  CLEARING_DOCUMENT_STAT_CARDS,
} from '@/lib/clearing-document-detail-customization'
import {
  TRANSACTION_GL_IMPACT_COLUMNS,
  TRANSACTION_GL_IMPACT_SETTING_AVAILABILITY,
} from '@/lib/transaction-gl-impact'
import type { TransactionVisualTone } from '@/lib/transaction-page-config'

type CustomizeField = {
  id: string
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

export default function ClearingDocumentDetailCustomizeMode({
  detailHref,
  initialLayout,
  fields,
  referenceSourceDefinitions,
  sectionDescriptions,
  statPreviewCards,
}: {
  detailHref: string
  initialLayout: ClearingDocumentDetailCustomizationConfig
  fields: CustomizeField[]
  referenceSourceDefinitions?: Array<{
    id: string
    label: string
    linkedFieldLabel: string
    description: string
    defaultVisibleFieldIds: string[]
    defaultColumns?: number
    defaultRows?: number
    fields: CustomizeField[]
  }>
  sectionDescriptions?: Record<string, string>
  statPreviewCards?: Array<{
    id: string
    label: string
    value: string | number
    href?: string | null
    accent?: true | 'teal' | 'yellow'
    valueTone?: TransactionVisualTone
    cardTone?: TransactionVisualTone
    supportsColorized?: boolean
    supportsLink?: boolean
  }>
}) {
  const customizeLayout = {
    ...initialLayout,
    secondarySettings: initialLayout.glImpactSettings,
    secondaryColumns: initialLayout.glImpactColumns,
  }

  return (
    <TransactionRecordDetailCustomizeMode
      detailHref={detailHref}
      initialLayout={customizeLayout}
      fields={fields}
      formKey="journalCreate"
      saveEndpoint="/api/config/clearing-document-detail-customization"
      recordLabel="clearing document"
      sectionDescriptions={sectionDescriptions}
      referenceSourceDefinitions={referenceSourceDefinitions ?? CLEARING_DOCUMENT_REFERENCE_SOURCES}
      lineColumnsLabel="Clearing Lines"
      lineColumnDefinitions={CLEARING_DOCUMENT_LINE_COLUMNS}
      lineColumnSettingDefinitions={[
        {
          id: 'widthMode',
          label: 'Width',
          options: [
            { value: 'auto', label: 'Auto' },
            { value: 'compact', label: 'Compact' },
            { value: 'normal', label: 'Normal' },
            { value: 'wide', label: 'Wide' },
          ],
        },
      ]}
      lineColumnSettingAvailability={Object.fromEntries(CLEARING_DOCUMENT_LINE_COLUMNS.map((column) => [column.id, ['widthMode']]))}
      statCardDefinitions={CLEARING_DOCUMENT_STAT_CARDS}
      statPreviewCards={statPreviewCards}
      secondaryColumnsLabel="GL Impact"
      secondaryColumnDefinitions={TRANSACTION_GL_IMPACT_COLUMNS}
      secondaryColumnSettingAvailability={TRANSACTION_GL_IMPACT_SETTING_AVAILABILITY}
      layoutErrorMessage="Unable to save clearing document detail layout"
      requirementsErrorMessage="Unable to save clearing document field requirements"
      fallbackErrorMessage="Unable to save clearing document customization"
    />
  )
}
