'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import TransactionSaveButton from '@/components/TransactionSaveButton'

export default function TransactionActionStack({
  mode,
  cancelHref,
  formId,
  recordId,
  primaryActions,
  secondaryActions,
}: {
  mode: 'detail' | 'edit' | 'create'
  cancelHref?: string
  formId?: string
  recordId?: string
  primaryActions?: ReactNode
  secondaryActions?: ReactNode
}) {
  if (mode === 'edit' || mode === 'create') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {cancelHref ? (
          <Link
            href={cancelHref}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </Link>
        ) : null}
        {formId ? <TransactionSaveButton formId={formId} recordId={recordId} /> : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {primaryActions ? <div className="flex flex-wrap items-center gap-2">{primaryActions}</div> : null}
      {secondaryActions ? <div className="flex flex-wrap items-center gap-2">{secondaryActions}</div> : null}
    </div>
  )
}
