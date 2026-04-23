import { buildDefaultListHeaderTooltip } from '@/lib/record-list-header-tooltip'

export function buildFieldStyleListTooltip({
  label,
  fieldId,
  fieldType,
  description,
  sourceText,
}: {
  label: string
  fieldId: string
  fieldType: string
  description?: string
  sourceText?: string
}) {
  const normalizedFieldType = fieldType === 'select' ? 'list' : fieldType
  const sourceLine = normalizedFieldType === 'list' && sourceText ? `\nField Source: ${sourceText}` : ''
  return `${description ?? buildDefaultListHeaderTooltip(label)}\n\nField ID: ${fieldId}\nField Type: ${normalizedFieldType}${sourceLine}`
}
