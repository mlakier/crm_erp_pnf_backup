'use client'

import Link from 'next/link'
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { TransactionStatCardSize, TransactionVisualTone } from '@/lib/transaction-page-config'

export function RecordDetailStatCard({
  label,
  value,
  accent,
  href,
  valueTone,
  cardTone,
  size = 'md',
}: {
  label: string
  value: ReactNode
  accent?: true | 'teal' | 'yellow'
  href?: string | null
  valueTone?: TransactionVisualTone
  cardTone?: TransactionVisualTone
  size?: TransactionStatCardSize
}) {
  const textColor =
    accent === 'teal'
      ? '#5eead4'
      : accent === 'yellow'
        ? '#fcd34d'
        : accent
          ? 'var(--accent-primary-strong)'
          : 'var(--text-muted)'
  const valueColor =
    valueTone === 'gray'
      ? 'var(--text-muted)'
      : valueTone === 'accent'
      ? 'var(--accent-primary-strong)'
      : valueTone === 'teal'
        ? '#5eead4'
        : valueTone === 'yellow'
          ? '#fcd34d'
          : valueTone === 'orange'
            ? '#fdba74'
          : valueTone === 'green'
            ? '#86efac'
            : valueTone === 'red'
              ? '#fca5a5'
              : valueTone === 'purple'
                ? '#d8b4fe'
                : valueTone === 'pink'
                  ? '#f9a8d4'
              : '#ffffff'
  const cardBackgroundColor =
    cardTone === 'gray'
      ? 'rgba(148,163,184,0.10)'
      : cardTone === 'accent'
      ? 'rgba(59,130,246,0.16)'
      : cardTone === 'teal'
        ? 'rgba(20,184,166,0.16)'
        : cardTone === 'yellow'
          ? 'rgba(245,158,11,0.16)'
          : cardTone === 'orange'
            ? 'rgba(249,115,22,0.16)'
          : cardTone === 'green'
            ? 'rgba(34,197,94,0.14)'
            : cardTone === 'red'
              ? 'rgba(239,68,68,0.14)'
              : cardTone === 'purple'
                ? 'rgba(168,85,247,0.16)'
                : cardTone === 'pink'
                  ? 'rgba(236,72,153,0.16)'
              : accent
                ? 'var(--card-elevated)'
                : 'var(--card)'
  const cardBorderColor =
    cardTone === 'gray'
      ? 'rgba(148,163,184,0.22)'
      : cardTone === 'accent'
      ? 'rgba(59,130,246,0.32)'
      : cardTone === 'teal'
        ? 'rgba(20,184,166,0.32)'
        : cardTone === 'yellow'
          ? 'rgba(245,158,11,0.32)'
          : cardTone === 'orange'
            ? 'rgba(249,115,22,0.32)'
          : cardTone === 'green'
            ? 'rgba(34,197,94,0.28)'
            : cardTone === 'red'
              ? 'rgba(239,68,68,0.28)'
              : cardTone === 'purple'
                ? 'rgba(168,85,247,0.32)'
                : cardTone === 'pink'
                  ? 'rgba(236,72,153,0.32)'
              : 'var(--border-muted)'
  const cardPaddingClass = size === 'sm' ? 'p-4' : size === 'lg' ? 'p-6' : 'p-5'
  const labelClass = size === 'sm' ? 'text-xs' : 'text-sm'
  const valueClass = size === 'sm' ? 'mt-2 text-xl' : size === 'lg' ? 'mt-4 text-3xl' : 'mt-3 text-2xl'
  return (
    <div
      className={`rounded-2xl border ${cardPaddingClass}`}
      style={{
        backgroundColor: cardBackgroundColor,
        borderColor: cardBorderColor,
      }}
    >
      <p className={`${labelClass} font-medium`} style={{ color: textColor }}>
        {label}
      </p>
      <div className={`${valueClass} font-semibold`} style={{ color: valueColor }}>
        {href ? (
          <Link href={href} className="hover:underline" style={{ color: valueColor }}>
            {value}
          </Link>
        ) : (
          value
        )}
      </div>
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
      className="mb-6 overflow-visible rounded-xl border"
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
      {expanded ? <div style={{ overflowX: 'auto', overflowY: 'visible' }}>{children}</div> : null}
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
  style,
}: {
  children?: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <th
      className={`px-4 py-2 text-left text-xs font-medium uppercase tracking-wide ${className}`.trim()}
      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)', ...style }}
    >
      {children}
    </th>
  )
}

export function RecordDetailCell({
  children,
  className = '',
  style,
}: {
  children?: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <td
      className={`px-4 py-2 text-sm ${className}`.trim()}
      style={{ color: 'var(--text-secondary)', ...style }}
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
