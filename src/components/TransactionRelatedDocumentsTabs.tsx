'use client'

import { useState, type ReactNode } from 'react'

export type TransactionRelatedDocumentsTabTone = 'upstream' | 'downstream'

export type TransactionRelatedDocumentsTab = {
  key: string
  label: string
  count: number
  tone: TransactionRelatedDocumentsTabTone
  emptyMessage: string
  headers: string[]
  rows: Array<{
    id: string
    cells: ReactNode[]
  }>
}

export function RelatedDocumentsStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  const styles: Record<string, { bg: string; color: string }> = {
    paid: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    booked: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    fulfilled: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    accepted: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    approved: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    received: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    pending: { bg: 'rgba(245,158,11,0.16)', color: '#fcd34d' },
    cancelled: { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' },
    sent: { bg: 'rgba(99,102,241,0.18)', color: '#c7d2fe' },
    draft: { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
  }
  const style = styles[s] ?? styles.draft
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status}
    </span>
  )
}

export default function TransactionRelatedDocumentsTabs({
  tabs,
  defaultActiveKey,
}: {
  tabs: TransactionRelatedDocumentsTab[]
  defaultActiveKey?: string
}) {
  const firstKey = tabs[0]?.key ?? ''
  const [active, setActive] = useState(defaultActiveKey ?? firstKey)
  const [expanded, setExpanded] = useState(true)
  const activeTab = tabs.find((tab) => tab.key === active) ?? tabs[0]

  return (
    <div
      className="mb-6 overflow-hidden rounded-xl border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
    >
      <div className="border-b px-6 pt-5 pb-0" style={{ borderColor: 'var(--border-muted)' }}>
        <div className="mb-3 flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Related Documents
          </p>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-md px-1.5 py-0.5 text-xs"
            style={{ color: 'var(--text-muted)' }}
            aria-label={expanded ? 'Collapse Related Documents' : 'Expand Related Documents'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        </div>
        {expanded ? (
          <div className="flex overflow-x-auto overflow-y-hidden">
            {tabs.map((tab) => {
              const isActive = active === tab.key
              const palette =
                tab.tone === 'upstream'
                  ? {
                      activeBorder: '#f59e0b',
                      activeText: '#fcd34d',
                      activeBadgeBg: 'rgba(245,158,11,0.16)',
                      inactiveBadgeBg: 'rgba(245,158,11,0.1)',
                      inactiveBadgeText: '#d1a24a',
                      inactiveText: '#d8b86a',
                    }
                  : {
                      activeBorder: 'var(--accent-primary-strong)',
                      activeText: '#93c5fd',
                      activeBadgeBg: 'rgba(59,130,246,0.18)',
                      inactiveBadgeBg: 'rgba(59,130,246,0.1)',
                      inactiveBadgeText: '#7fb0f8',
                      inactiveText: '#8ab4f8',
                    }

              return (
                <button
                  key={tab.key}
                  onClick={() => setActive(tab.key)}
                  className="flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px"
                  style={{
                    borderColor: isActive ? palette.activeBorder : 'transparent',
                    color: isActive ? palette.activeText : palette.inactiveText,
                  }}
                >
                  {tab.label}
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{
                      backgroundColor: isActive ? palette.activeBadgeBg : palette.inactiveBadgeBg,
                      color: isActive ? palette.activeText : palette.inactiveBadgeText,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {expanded && activeTab ? (
        <div className="overflow-x-auto overflow-y-hidden">
          {activeTab.rows.length === 0 ? (
            <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              {activeTab.emptyMessage}
            </p>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  {activeTab.headers.map((header) => (
                    <th
                      key={header}
                      className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeTab.rows.map((row) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, index) => (
                      <td key={`${row.id}-${index}`} className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  )
}
