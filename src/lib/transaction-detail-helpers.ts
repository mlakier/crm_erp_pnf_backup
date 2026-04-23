import type { ReactNode } from 'react'

type LayoutFieldConfig = {
  visible: boolean
  section: string
  order: number
  column: number
}

type SectionedLayout<TKey extends string> = {
  sections: string[]
  fields: Record<TKey, LayoutFieldConfig>
}

type LineColumnLayout<TKey extends string> = {
  lineColumns: Record<TKey, { visible: boolean; order: number }>
}

type FieldMeta<TKey extends string> = {
  id: TKey
  label: string
  fieldType: string
  source?: string
  description?: string
}

type TransactionFieldType = 'text' | 'number' | 'date' | 'email' | 'list' | 'checkbox' | 'currency'

type SectionField = {
  key: string
  label: string
  value: string
  displayValue?: ReactNode
  helpText?: string
  fieldType?: TransactionFieldType
  sourceText?: string
  editable?: boolean
  type?: 'text' | 'number' | 'select'
  options?: Array<{ value: string; label: string }>
  column?: number
  order?: number
}

export function getTransactionFieldPreviewValue(
  fieldDefinition: {
    value: string
    displayValue?: ReactNode
    options?: Array<{ value: string; label: string }>
  },
  override?: string
): string {
  if (override != null) return override
  if (typeof fieldDefinition.displayValue === 'string') return fieldDefinition.displayValue
  return (
    fieldDefinition.options?.find((option) => option.value === fieldDefinition.value)?.label ??
    fieldDefinition.value ??
    ''
  )
}

export function buildTransactionCustomizePreviewFields<
  TKey extends string,
  TMeta extends FieldMeta<TKey>,
  TDefinition extends SectionField,
>({
  fields,
  fieldDefinitions,
  previewOverrides,
}: {
  fields: TMeta[]
  fieldDefinitions: Record<TKey, TDefinition & { options?: Array<{ value: string; label: string }> }>
  previewOverrides?: Partial<Record<TKey, string>>
}) {
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    fieldType: field.fieldType,
    source: field.source,
    description: field.description,
    previewValue: getTransactionFieldPreviewValue(fieldDefinitions[field.id], previewOverrides?.[field.id]),
  }))
}

export function buildConfiguredTransactionSections<
  TKey extends string,
  TMeta extends FieldMeta<TKey>,
  TDefinition extends SectionField,
>({
  fields,
  layout,
  fieldDefinitions,
  sectionDescriptions,
}: {
  fields: TMeta[]
  layout: SectionedLayout<TKey>
  fieldDefinitions: Record<TKey, TDefinition>
  sectionDescriptions?: Record<string, string>
}): Array<{ title: string; description?: string; fields: TDefinition[] }> {
  return layout.sections.flatMap((sectionTitle) => {
      const sectionFields = fields
        .filter((field) => {
          const config = layout.fields[field.id]
          return config.visible && config.section === sectionTitle
        })
        .sort((a, b) => {
          const left = layout.fields[a.id]
          const right = layout.fields[b.id]
          if (left.column !== right.column) return left.column - right.column
          return left.order - right.order
        })
        .map((field) => ({
          ...fieldDefinitions[field.id],
          column: layout.fields[field.id].column,
          order: layout.fields[field.id].order,
        }))

      if (sectionFields.length === 0) return []

      return [{
        title: sectionTitle,
        description: sectionDescriptions?.[sectionTitle],
        fields: sectionFields,
      }]
    })
}

export function getOrderedVisibleTransactionLineColumns<
  TKey extends string,
  TColumn extends { id: TKey; label: string }
>(columns: TColumn[], layout: LineColumnLayout<TKey>) {
  return [...columns]
    .filter((column) => layout.lineColumns[column.id]?.visible !== false)
    .sort((left, right) => layout.lineColumns[left.id].order - layout.lineColumns[right.id].order)
    .map((column) => ({ id: column.id, label: column.label }))
}

export function buildTransactionExportHeaderFields<
  TKey extends string,
  TField extends SectionField
>(
  sections: Array<{ fields: TField[] }>,
  formatters?: Partial<Record<TKey, (field: TField) => string>>
) {
  return sections.flatMap((section) =>
    section.fields.map((field) => ({
      label: field.label,
      value: formatters?.[field.key as TKey]?.(field) ?? String(field.value || field.displayValue || '-'),
    }))
  )
}
