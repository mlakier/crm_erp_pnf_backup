import Link from 'next/link'
import type { ReactNode } from 'react'

type RecordDetailPageShellProps = {
  backHref: string
  backLabel: string
  meta: string
  title: string
  badge?: ReactNode
  actions?: ReactNode
  children: ReactNode
  widthClassName?: string
}

export default function RecordDetailPageShell({
  backHref,
  backLabel,
  meta,
  title,
  badge,
  actions,
  children,
  widthClassName = 'w-full max-w-none',
}: RecordDetailPageShellProps) {
  return (
    <div className="min-h-full px-8 py-8">
      <div className={widthClassName}>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link
              href={backHref}
              className="text-sm hover:underline"
              style={{ color: 'var(--accent-primary-strong)' }}
            >
              {backLabel}
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {meta}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
            {badge ? <div className="mt-1">{badge}</div> : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
          ) : null}
        </div>

        {children}
      </div>
    </div>
  )
}
