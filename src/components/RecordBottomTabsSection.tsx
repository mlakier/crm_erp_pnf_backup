'use client'

import { useState, type ReactNode } from 'react'

type RecordBottomTab = {
  key: string
  label: string
  count: number
  content: ReactNode
  toolbarTargetId?: string
  toolbarPlacement?: 'panel' | 'tab-bar'
}

const STANDARD_TAB_ORDER = [
  'related-records',
  'related-documents',
  'communications',
  'system-notes',
] as const

const STANDARD_TAB_LABELS: Record<(typeof STANDARD_TAB_ORDER)[number], string> = {
  'related-records': 'Related Records',
  'related-documents': 'Related Documents',
  communications: 'Communications',
  'system-notes': 'System Notes',
}

const STANDARD_EMPTY_MESSAGES: Record<(typeof STANDARD_TAB_ORDER)[number], string> = {
  'related-records': 'No related master data records.',
  'related-documents': 'No related transaction documents.',
  communications: 'No communications tracked for this record yet.',
  'system-notes': 'No system notes yet.',
}

function EmptyTabContent({ message }: { message: string }) {
  return (
    <div className="px-6 py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
      {message}
    </div>
  )
}

export default function RecordBottomTabsSection({
  title = 'Related | Communications | System Notes',
  tabs,
  defaultActiveKey,
  defaultTabbed = true,
  showViewToggle = true,
}: {
  title?: string
  tabs: RecordBottomTab[]
  defaultActiveKey?: string
  defaultTabbed?: boolean
  showViewToggle?: boolean
}) {
  const providedTabs = new Map(tabs.map((tab) => [tab.key, tab] as const))
  const normalizedTabs: RecordBottomTab[] = STANDARD_TAB_ORDER.map((key) => {
    const existing = providedTabs.get(key)
    if (existing) {
      return {
        ...existing,
        label: STANDARD_TAB_LABELS[key],
      }
    }
    return {
      key,
      label: STANDARD_TAB_LABELS[key],
      count: 0,
      content: <EmptyTabContent message={STANDARD_EMPTY_MESSAGES[key]} />,
      toolbarTargetId: undefined,
      toolbarPlacement: undefined,
    }
  })
  const firstKey = normalizedTabs[0]?.key ?? ''
  const [active, setActive] = useState(defaultActiveKey ?? firstKey)
  const [tabbed, setTabbed] = useState(defaultTabbed)
  const activeTab = normalizedTabs.find((tab) => tab.key === active) ?? normalizedTabs[0]

  if (!normalizedTabs.length || !activeTab) return null

  return (
    <div
      className="mb-6 overflow-hidden rounded-xl border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
    >
      {title || showViewToggle ? (
        <div
          className="flex items-center justify-between gap-4 border-b px-6 py-4"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          {title ? <h2 className="text-base font-semibold text-white">{title}</h2> : <div className="flex-1" />}
          {showViewToggle ? (
            <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={tabbed}
                onChange={(event) => setTabbed(event.target.checked)}
              />
              Tabbed
            </label>
          ) : null}
        </div>
      ) : null}
      {tabbed ? (
        <>
          <div className="border-b px-6 py-0" style={{ borderColor: 'var(--border-muted)' }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
                {normalizedTabs.map((tab) => {
                  const isActive = active === tab.key
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActive(tab.key)}
                      className="flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors -mb-px"
                      style={{
                        borderColor: isActive ? 'var(--accent-primary-strong)' : 'transparent',
                        color: isActive ? '#93c5fd' : '#8ab4f8',
                      }}
                    >
                      {tab.label}
                      <span
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{
                          backgroundColor: isActive ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.1)',
                          color: isActive ? '#93c5fd' : '#7fb0f8',
                        }}
                      >
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2 py-2">
                {normalizedTabs.map((tab) =>
                  tab.toolbarTargetId && tab.toolbarPlacement === 'tab-bar' ? (
                    <div
                      key={`tab-bar-toolbar-${tab.key}`}
                      id={tab.toolbarTargetId}
                      className="items-center justify-end gap-2"
                      style={{ display: activeTab.key === tab.key ? 'flex' : 'none' }}
                    />
                  ) : null
                )}
              </div>
            </div>
          </div>
          <div className="px-6 py-6">
            <div className="mb-4 flex items-center justify-end gap-2">
              {normalizedTabs.map((tab) =>
                tab.toolbarTargetId && tab.toolbarPlacement !== 'tab-bar' ? (
                  <div
                    key={`panel-toolbar-${tab.key}`}
                    id={tab.toolbarTargetId}
                    className="items-center justify-end gap-2"
                    style={{ display: activeTab.key === tab.key ? 'flex' : 'none' }}
                  />
                ) : null
              )}
            </div>
            <div>{activeTab.content}</div>
          </div>
        </>
      ) : (
        <div className="space-y-6 p-6">
          {normalizedTabs.map((tab) => (
            <div
              key={tab.key}
              className="overflow-hidden rounded-xl border"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
            >
              <div className="border-b px-6 py-0" style={{ borderColor: 'var(--border-muted)' }}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2 py-3">
                    <span className="text-base font-semibold text-white">{tab.label}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{
                        backgroundColor: 'rgba(59,130,246,0.18)',
                        color: '#93c5fd',
                      }}
                    >
                      {tab.count}
                    </span>
                  </div>
                  {tab.toolbarTargetId ? (
                    <div id={tab.toolbarTargetId} className="flex shrink-0 items-center justify-end gap-2 py-2" />
                  ) : (
                    <div />
                  )}
                </div>
              </div>
              <div>{tab.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
