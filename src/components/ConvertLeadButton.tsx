'use client'

import Link from 'next/link'

export default function ConvertLeadButton({
  leadId,
  canConvert,
  opportunityId,
}: {
  leadId: string
  canConvert: boolean
  opportunityId?: string | null
}) {
  if (opportunityId) {
    return (
      <Link
        href={`/opportunities/${opportunityId}`}
        className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
      >
        View Opp
      </Link>
    )
  }

  if (!canConvert) {
    return null
  }

  return (
    <Link
      href={`/leads/${leadId}/convert`}
      className="inline-flex items-center rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
    >
      Convert
    </Link>
  )
}