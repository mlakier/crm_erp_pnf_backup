import type { InlineRecordField, InlineRecordSection } from '@/components/InlineRecordDetails'

type FieldWithId<TKey extends string> = {
  id: TKey
  fieldType: string
  source?: string
  description?: string
}

type LayoutFieldConfig = {
  visible: boolean
  section: string
  order: number
  column: number
}

type LayoutConfig<TKey extends string> = {
  sections: string[]
  fields: Record<TKey, LayoutFieldConfig>
}

export type CustomizePreviewField<TKey extends string> = {
  id: TKey
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue: string
}

export function getInlineFieldPreviewValue(field: InlineRecordField): string {
  if (field.type === 'checkbox') {
    return field.value === 'true' ? 'Yes' : 'No'
  }

  return (
    field.options?.find((option) => option.value === field.value)?.label ??
    field.value ??
    ''
  )
}

export function buildCustomizePreviewFields<TKey extends string, TField extends FieldWithId<TKey>>(
  fields: TField[],
  fieldDefinitions: Record<TKey, InlineRecordField>
): CustomizePreviewField<TKey>[] {
  return fields.map((field) => ({
    id: field.id,
    label: fieldDefinitions[field.id].label,
    fieldType: field.fieldType,
    source: field.source,
    description: field.description,
    previewValue: getInlineFieldPreviewValue(fieldDefinitions[field.id]),
  }))
}

export function buildConfiguredInlineSections<TKey extends string, TField extends FieldWithId<TKey>>({
  fields,
  layout,
  fieldDefinitions,
  sectionDescriptions,
}: {
  fields: TField[]
  layout: LayoutConfig<TKey>
  fieldDefinitions: Record<TKey, InlineRecordField>
  sectionDescriptions?: Record<string, string>
}): InlineRecordSection[] {
  return layout.sections.flatMap((sectionTitle) => {
      const configuredFields = fields
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

      if (configuredFields.length === 0) return []

      return [{
        title: sectionTitle,
        description: sectionDescriptions?.[sectionTitle],
        collapsible: true,
        defaultExpanded: true,
        fields: configuredFields,
      }]
    })
}
