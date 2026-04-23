'use client'

import { useState, type ReactNode } from 'react'

export function RecordDetailStatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: true | 'teal' | 'yellow'
}) {
  const textColor =
    accent === 'teal'
      ? '#5eead4'
      : accent === 'yellow'
        ? '#fcd34d'
        : accent
          ? 'var(--accent-primary-strong)'
          : 'var(--text-muted)'
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        backgroundColor: accent ? 'var(--card-elevated)' : 'var(--card)',
        borderColor: 'var(--border-muted)',
      }}
    >
      <p className="text-sm font-medium" style={{ color: textColor }}>
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

export function RecordDetailSection({
  title,
  count,
  summary,
  actions,
  collapsible = false,
  defaultExpanded = true,
  children,
}: {
  title: string
  count: number
  summary?: ReactNode
  actions?: ReactNode
  collapsible?: boolean
  defaultExpanded?: boolean
  children?: ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div
      className="mb-6 overflow-hidden rounded-xl border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
    >
      <div
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'var(--border-muted)' }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {collapsible ? (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="rounded-md px-1.5 py-0.5 text-xs"
              style={{ color: 'var(--text-muted)' }}
              aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            >
              {expanded ? '▾' : '▸'}
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {summary ? (
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {summary}
            </span>
          ) : null}
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: 'rgba(59,130,246,0.18)',
              color: 'var(--accent-primary-strong)',
            }}
          >
            {count}
          </span>
        </div>
      </div>
      {expanded ? <div className="overflow-x-auto">{children}</div> : null}
    </div>
  )
}

export function RecordDetailEmptyState({ message }: { message: string }) {
  return (
    <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
      {message}
    </p>
  )
}

export function RecordDetailHeaderCell({
  children,
  className = '',
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <th
      className={`px-4 py-2 text-left text-xs font-medium uppercase tracking-wide ${className}`.trim()}
      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}
    >
      {children}
    </th>
  )
}

export function RecordDetailCell({
  children,
  className = '',
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <td
      className={`px-4 py-2 text-sm ${className}`.trim()}
      style={{ color: 'var(--text-secondary)' }}
    >
      {children}
    </td>
  )
}

export function RecordDetailField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </dt>
      <dd className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </dd>
    </div>
  )
}
