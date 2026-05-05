import {
  buildDefaultCurrencyReadoutFieldCustomizations,
  buildPostedCurrencyReadoutSection,
  CURRENCY_READOUT_CUSTOMIZE_FIELDS,
  CURRENCY_READOUT_FIELD_KEYS,
  CURRENCY_READOUT_SECTION_TITLE,
  type CurrencyReadoutFieldKey,
} from '@/lib/four-currency-readout'

export {
  buildDefaultCurrencyReadoutFieldCustomizations,
  buildPostedCurrencyReadoutSection,
  CURRENCY_READOUT_CUSTOMIZE_FIELDS,
  CURRENCY_READOUT_FIELD_KEYS,
  CURRENCY_READOUT_SECTION_TITLE,
}

export type { CurrencyReadoutFieldKey }

export type CreditDocumentLineColumnKey =
  | 'db-id'
  | 'item'
  | 'description'
  | 'quantity'
  | 'unit-price'
  | 'line-total'
  | 'notes'
  | 'created-at'
  | 'updated-at'

export type CreditDocumentLineFontSize = 'xs' | 'sm'
export type CreditDocumentLineWidthMode = 'auto' | 'compact' | 'normal' | 'wide'

export type CreditDocumentLineColumnCustomization = {
  visible: boolean
  order: number
  widthMode: CreditDocumentLineWidthMode
}

export type CreditDocumentLineSettings = {
  fontSize: CreditDocumentLineFontSize
}

export const CREDIT_DOCUMENT_LINE_COLUMNS: Array<{
  id: CreditDocumentLineColumnKey
  label: string
  description?: string
}> = [
  { id: 'db-id', label: 'Line DB Id', description: 'Internal database identifier for the line.' },
  { id: 'item', label: 'Item', description: 'Linked item reference for the line.' },
  { id: 'description', label: 'Description', description: 'User-facing description of the credit line.' },
  { id: 'quantity', label: 'Qty', description: 'Credited quantity on the line.' },
  { id: 'unit-price', label: 'Unit Price', description: 'Unit price used to calculate the line amount.' },
  { id: 'line-total', label: 'Line Total', description: 'Extended amount for the line.' },
  { id: 'notes', label: 'Notes', description: 'Line-specific notes.' },
  { id: 'created-at', label: 'Created', description: 'Date/time the line was created.' },
  { id: 'updated-at', label: 'Last Modified', description: 'Date/time the line was last modified.' },
]

export function defaultCreditDocumentLineSettings(): CreditDocumentLineSettings {
  return { fontSize: 'sm' }
}

export function defaultCreditDocumentLineColumns(): Record<
  CreditDocumentLineColumnKey,
  CreditDocumentLineColumnCustomization
> {
  return Object.fromEntries(
    CREDIT_DOCUMENT_LINE_COLUMNS.map((column, index) => [
      column.id,
      {
        visible: true,
        order: index,
        widthMode:
          column.id === 'db-id' || column.id === 'quantity'
            ? 'compact'
            : column.id === 'description' || column.id === 'notes'
              ? 'wide'
              : 'normal',
      },
    ]),
  ) as Record<CreditDocumentLineColumnKey, CreditDocumentLineColumnCustomization>
}
