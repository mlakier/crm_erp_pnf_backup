'use client'

import RecordHeaderDetails, {
  type RecordHeaderField,
  type RecordHeaderSection,
} from '@/components/RecordHeaderDetails'
import { CURRENCY_READOUT_SECTION_TITLE } from '@/lib/four-currency-readout'

type CurrencyLayoutConfig = {
  sectionRows?: Partial<Record<string, number>>
  fields: Record<
    string,
    {
      visible: boolean
      section: string
      order: number
      column: number
    }
  >
}

function buildConfiguredCurrencySection(
  section: RecordHeaderSection,
  layout: CurrencyLayoutConfig,
): RecordHeaderSection {
  const configuredFields = section.fields
    .map((field) => {
      const config = layout.fields[field.key]
      if (!config || config.visible === false || config.section !== CURRENCY_READOUT_SECTION_TITLE) {
        return null
      }

      return {
        ...field,
        column: config.column,
        order: config.order,
      }
    })
    .filter((field): field is RecordHeaderField & { column: number; order: number } => Boolean(field))
    .sort((left, right) => {
      const leftColumn = left.column ?? 1
      const rightColumn = right.column ?? 1
      if (leftColumn !== rightColumn) return leftColumn - rightColumn
      return (left.order ?? 0) - (right.order ?? 0)
    })

  return {
    ...section,
    title: '',
    description: undefined,
    rows: layout.sectionRows?.[CURRENCY_READOUT_SECTION_TITLE] ?? section.rows,
    fields: configuredFields,
  }
}

export default function TransactionFourCurrencySection({
  section,
  layout,
  description,
}: {
  section: RecordHeaderSection
  layout: CurrencyLayoutConfig
  description: string
}) {
  const configuredSection = buildConfiguredCurrencySection(section, layout)
  const columns = Math.max(1, ...configuredSection.fields.map((field) => field.column ?? 1))

  return (
    <RecordHeaderDetails
      editing={false}
      sections={[configuredSection]}
      columns={columns}
      containerTitle={CURRENCY_READOUT_SECTION_TITLE}
      containerDescription={description}
      showSubsections={false}
    />
  )
}
