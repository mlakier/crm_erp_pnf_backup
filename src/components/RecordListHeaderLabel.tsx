'use client'

import type { ReactNode } from 'react'
import HelpTooltipIcon from '@/components/HelpTooltipIcon'
import { buildDefaultListHeaderTooltip } from '@/lib/record-list-header-tooltip'

export function RecordListHeaderLabel({
  label,
  tooltip,
}: {
  label: ReactNode
  tooltip?: unknown
}) {
  const resolvedTooltip =
    typeof tooltip === 'string'
      ? tooltip
      : typeof label === 'string'
        ? buildDefaultListHeaderTooltip(label)
        : undefined

  return (
    <span className="inline-flex items-center gap-1.5" style={{ textTransform: 'none', letterSpacing: 'normal' }}>
      <span>{label}</span>
      {resolvedTooltip ? <HelpTooltipIcon content={resolvedTooltip} /> : null}
    </span>
  )
}
