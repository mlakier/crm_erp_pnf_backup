import type { ReactNode } from 'react'
import type { TransactionGlImpactRow } from '@/lib/transaction-gl-impact'
import { formatGlAccountLabel } from '@/lib/gl-account-label'

type LayoutFieldConfig = {
  visible: boolean
  section: string
  order: number
  column: number
}

type SectionedLayout<TKey extends string> = {
  sections: string[]
  sectionRows?: Partial<Record<string, number>>
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
  type?: 'text' | 'number' | 'select' | 'date' | 'email' | 'checkbox' | 'address'
  options?: Array<{ value: string; label: string }>
  column?: number
  order?: number
}

export function getTransactionFieldPreviewValue(
  fieldDefinition:
    | {
        value: string
        displayValue?: ReactNode
        options?: Array<{ value: string; label: string }>
      }
    | undefined,
  override?: string
): string {
  if (override != null) return override
  if (!fieldDefinition) return ''
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
  fieldDefinitions: Record<TKey, TDefinition & { options?: Array<{ value: string; label: string }> }> | Record<string, TDefinition & { options?: Array<{ value: string; label: string }> }>
  previewOverrides?: Partial<Record<TKey, string>>
}) {
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    fieldType: field.fieldType,
    source: field.source,
    description: field.description,
    previewValue: getTransactionFieldPreviewValue(
      fieldDefinitions[field.id as keyof typeof fieldDefinitions],
      previewOverrides?.[field.id],
    ),
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
}): Array<{ title: string; description?: string; rows?: number; fields: TDefinition[] }> {
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
        rows: layout.sectionRows?.[sectionTitle],
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

export function formatTransactionSourceType(value: string | null | undefined) {
  if (!value) return 'Unknown'
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function toSignedAmount(debit: number, credit: number) {
  return debit !== 0 ? debit : credit !== 0 ? -credit : 0
}

export function buildTransactionGlImpactRows({
  entries,
  sourceNumberByKey,
  formatDate,
  toNumericValue,
}: {
  entries: Array<{
    number: string
    sourceType: string | null
    sourceId: string | null
    date: Date
    description: string | null
    lineItems: Array<{
      id: string
      description: string | null
      memo: string | null
      debit: unknown
      credit: unknown
      localDebit?: unknown
      localCredit?: unknown
      functionalDebit?: unknown
      functionalCredit?: unknown
      groupDebit?: unknown
      groupCredit?: unknown
      account: { accountId: string; accountNumber?: string | null; name: string }
    }>
  }>
  sourceNumberByKey: Map<string, string>
  formatDate: (date: Date) => string
  toNumericValue: (value: unknown, fallback: number) => number
}): TransactionGlImpactRow[] {
  return entries.flatMap((entry) =>
    entry.lineItems.map((line) => ({
      id: line.id,
      journalNumber: entry.number,
      date: formatDate(entry.date),
      sourceType: formatTransactionSourceType(entry.sourceType),
      sourceNumber: sourceNumberByKey.get(`${entry.sourceType ?? ''}:${entry.sourceId ?? ''}`) ?? entry.sourceId ?? '-',
      account: formatGlAccountLabel(line.account),
      description: line.description ?? line.memo ?? entry.description ?? '-',
      debit: toNumericValue(line.debit, 0),
      credit: toNumericValue(line.credit, 0),
      txnAmount: toSignedAmount(
        toNumericValue(line.debit, 0),
        toNumericValue(line.credit, 0),
      ),
      localAmount: toSignedAmount(
        toNumericValue(line.localDebit, 0),
        toNumericValue(line.localCredit, 0),
      ),
      functionalAmount: toSignedAmount(
        toNumericValue(line.functionalDebit, 0),
        toNumericValue(line.functionalCredit, 0),
      ),
      groupAmount: toSignedAmount(
        toNumericValue(line.groupDebit, 0),
        toNumericValue(line.groupCredit, 0),
      ),
    })),
  )
}
