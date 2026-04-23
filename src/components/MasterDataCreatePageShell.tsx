import Link from 'next/link'
import type { ReactNode } from 'react'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'

export default function MasterDataCreatePageShell({
  backHref,
  backLabel,
  title,
  formId,
  children,
}: {
  backHref: string
  backLabel: string
  title: string
  formId?: string
  children: ReactNode
}) {
  return (
    <RecordDetailPageShell
      backHref={backHref}
      backLabel={backLabel}
      meta="New"
      title={title}
      actions={formId ? (
        <>
          <Link
            href={backHref}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            form={formId}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            Save
          </button>
        </>
      ) : null}
    >
      {children}
    </RecordDetailPageShell>
  )
}
