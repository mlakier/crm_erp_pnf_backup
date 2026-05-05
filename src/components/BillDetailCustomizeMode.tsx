'use client'

import type {
  BillDetailCustomizationConfig,
  BillLineColumnKey,
} from '@/lib/bill-detail-customization'
import TransactionRecordDetailCustomizeMode from '@/components/TransactionRecordDetailCustomizeMode'
import { BILL_LINE_COLUMNS, BILL_REFERENCE_SOURCES, BILL_STAT_CARDS } from '@/lib/bill-detail-customization'
import {
  TRANSACTION_GL_IMPACT_COLUMNS,
  TRANSACTION_GL_IMPACT_SETTING_AVAILABILITY,
} from '@/lib/transaction-gl-impact'
import type { TransactionVisualTone } from '@/lib/transaction-page-config'

const LOOKUP_DISPLAY_COLUMNS = new Set<BillLineColumnKey>(['item-id', 'expense-account'])

const BILL_LINE_SHOW_COLUMN_OPTIONS = [
  { value: 'always', label: 'Always' },
  { value: 'itemOnly', label: 'Item Lines Only' },
  { value: 'expenseOnly', label: 'Expense Lines Only' },
] as const

const BILL_LINE_COLUMN_SETTING_DEFINITIONS = [
  { id: 'widthMode', label: 'Width', options: [
    { value: 'auto', label: 'Auto' },
    { value: 'compact', label: 'Compact' },
    { value: 'normal', label: 'Normal' },
    { value: 'wide', label: 'Wide' },
  ] },
  { id: 'showColumnMode', label: 'Show Column', options: [...BILL_LINE_SHOW_COLUMN_OPTIONS] },
  { id: 'dropdownDisplay', label: 'Dropdown', options: [
    { value: 'label', label: 'Desc Only' },
    { value: 'idAndLabel', label: 'Id + Desc' },
    { value: 'id', label: 'Id Only' },
  ] },
  { id: 'dropdownSort', label: 'Sort', options: [
    { value: 'id', label: 'Id/Num' },
    { value: 'label', label: 'Description' },
  ] },
  { id: 'editDisplay', label: 'Edit', options: [
    { value: 'label', label: 'Desc Only' },
    { value: 'idAndLabel', label: 'Id + Desc' },
    { value: 'id', label: 'Id Only' },
  ] },
  { id: 'viewDisplay', label: 'View', options: [
    { value: 'label', label: 'Desc Only' },
    { value: 'idAndLabel', label: 'Id + Desc' },
    { value: 'id', label: 'Id Only' },
  ] },
] as const

const BILL_LINE_SETTING_AVAILABILITY = Object.fromEntries(
  BILL_LINE_COLUMNS.map((column) => [
    column.id,
    [
      'widthMode',
      ...((column.id === 'item-id' || column.id === 'expense-account') ? ['showColumnMode'] : []),
      ...(LOOKUP_DISPLAY_COLUMNS.has(column.id) ? ['dropdownDisplay', 'dropdownSort', 'editDisplay', 'viewDisplay'] : []),
    ],
  ]),
) as Record<BillLineColumnKey, string[]>

type CustomizeField = {
  id: string
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

export default function BillDetailCustomizeMode({
  detailHref,
  initialLayout,
  fields,
  referenceSourceDefinitions,
  sectionDescriptions,
  statPreviewCards,
}: {
  detailHref: string
  initialLayout: BillDetailCustomizationConfig
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
      formKey="billCreate"
      saveEndpoint="/api/config/bill-detail-customization"
      recordLabel="bill"
      lineColumnsLabel="Bill Line Items"
      sectionDescriptions={sectionDescriptions}
      referenceSourceDefinitions={referenceSourceDefinitions ?? BILL_REFERENCE_SOURCES}
      statCardDefinitions={BILL_STAT_CARDS}
      statPreviewCards={statPreviewCards}
      lineColumnDefinitions={BILL_LINE_COLUMNS}
      lineColumnSettingDefinitions={[...BILL_LINE_COLUMN_SETTING_DEFINITIONS]}
      lineColumnSettingAvailability={BILL_LINE_SETTING_AVAILABILITY}
      secondaryColumnsLabel="GL Impact"
      secondaryColumnDefinitions={TRANSACTION_GL_IMPACT_COLUMNS}
      secondaryColumnSettingAvailability={TRANSACTION_GL_IMPACT_SETTING_AVAILABILITY}
    />
  )
}
