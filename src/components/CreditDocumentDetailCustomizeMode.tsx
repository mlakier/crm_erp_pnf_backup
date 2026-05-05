'use client'

import TransactionRecordDetailCustomizeMode from '@/components/TransactionRecordDetailCustomizeMode'
import {
  BILL_CREDIT_STAT_CARDS,
  BILL_CREDIT_REFERENCE_SOURCES,
  type BillCreditDetailCustomizationConfig,
} from '@/lib/bill-credit-detail-customization'
import {
  CREDIT_DOCUMENT_LINE_COLUMNS,
} from '@/lib/credit-document-detail-customization-shared'
import {
  TRANSACTION_GL_IMPACT_COLUMNS,
  TRANSACTION_GL_IMPACT_SETTING_AVAILABILITY,
} from '@/lib/transaction-gl-impact'
import {
  CREDIT_MEMO_REFERENCE_SOURCES,
  CREDIT_MEMO_STAT_CARDS,
  type CreditMemoDetailCustomizationConfig,
} from '@/lib/credit-memo-detail-customization'
import type { TransactionVisualTone } from '@/lib/transaction-page-config'

const CREDIT_DOCUMENT_LINE_COLUMN_SETTING_DEFINITIONS = [
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
] as const

type CustomizeField = {
  id: string
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

export default function CreditDocumentDetailCustomizeMode({
  kind,
  detailHref,
  initialLayout,
  fields,
  referenceSourceDefinitions,
  sectionDescriptions,
  statPreviewCards,
}: {
  kind: 'credit-memo' | 'bill-credit'
  detailHref: string
  initialLayout: CreditMemoDetailCustomizationConfig | BillCreditDetailCustomizationConfig
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
  const isCreditMemo = kind === 'credit-memo'
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
      formKey={isCreditMemo ? 'creditMemoCreate' : 'billCreditCreate'}
      saveEndpoint={isCreditMemo ? '/api/config/credit-memo-detail-customization' : '/api/config/bill-credit-detail-customization'}
      recordLabel={isCreditMemo ? 'credit memo' : 'bill credit'}
      lineColumnsLabel={isCreditMemo ? 'Credit Memo Lines' : 'Bill Credit Lines'}
      sectionDescriptions={sectionDescriptions}
      referenceSourceDefinitions={
        referenceSourceDefinitions ??
        (isCreditMemo ? CREDIT_MEMO_REFERENCE_SOURCES : BILL_CREDIT_REFERENCE_SOURCES)
      }
      statCardDefinitions={isCreditMemo ? CREDIT_MEMO_STAT_CARDS : BILL_CREDIT_STAT_CARDS}
      statPreviewCards={statPreviewCards}
      lineColumnDefinitions={CREDIT_DOCUMENT_LINE_COLUMNS}
      lineColumnSettingDefinitions={[...CREDIT_DOCUMENT_LINE_COLUMN_SETTING_DEFINITIONS]}
      secondaryColumnsLabel="GL Impact"
      secondaryColumnDefinitions={TRANSACTION_GL_IMPACT_COLUMNS}
      secondaryColumnSettingAvailability={TRANSACTION_GL_IMPACT_SETTING_AVAILABILITY}
    />
  )
}
