import type { ReactNode } from 'react'
import { RecordDetailSection } from '@/components/RecordDetailPanels'

export type TransactionSummaryField = {
  label: string
  value: ReactNode
  helpText?: string
  fieldId?: string
  fieldType?: 'text' | 'number' | 'date' | 'email' | 'list' | 'checkbox' | 'currency'
  sourceText?: string
}

export default function TransactionFieldSummarySection({
  title,
  count = 0,
  description,
  fields,
  columns = 2,
}: {
  title: string
  count?: number
  description?: string
  fields: TransactionSummaryField[]
  columns?: 1 | 2 | 3 | 4
}) {
  const normalizedColumns = Math.min(4, Math.max(1, columns))

  return (
    <RecordDetailSection title={title} count={count}>
      {description ? (
        <p className="px-6 pt-6 text-xs" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      ) : null}
      <dl
        className="grid gap-3 px-6 py-6"
        style={{ gridTemplateColumns: `repeat(${normalizedColumns}, minmax(0, 1fr))` }}
      >
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              <span>{field.label}</span>
              {field.helpText ? (
                <FieldTooltip content={buildTooltipContent(field)} />
              ) : null}
            </dt>
            <dd className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </RecordDetailSection>
  )
}

function buildTooltipContent(field: TransactionSummaryField) {
  const fieldType = field.fieldType ?? 'text'
  const fieldId = field.fieldId ?? field.label
  const sourceLine =
    fieldType === 'list' && field.sourceText ? `\nField Source: ${field.sourceText}` : ''
  return `${field.helpText}\n\nField ID: ${fieldId}\nField Type: ${fieldType}${sourceLine}`
}

function FieldTooltip({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <span className="group relative inline-flex">
      <span
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border text-[10px] font-semibold"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}
        aria-label={content}
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-[60] mt-2 hidden w-72 rounded-lg border px-3 py-2 text-left text-xs leading-5 shadow-xl group-hover:block"
        style={{
          backgroundColor: 'var(--card-elevated)',
          borderColor: 'var(--border-muted)',
          color: 'var(--text-secondary)',
        }}
      >
        {lines.map((line, index) => (
          <span key={`${line}-${index}`} className="block whitespace-pre-wrap">
            {line || '\u00A0'}
          </span>
        ))}
      </span>
    </span>
  )
}
