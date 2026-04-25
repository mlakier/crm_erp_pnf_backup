import Link from 'next/link'
import type { ReactNode } from 'react'

type RecordDetailPageShellProps = {
  backHref: string
  backLabel: string
  meta: string
  title: string
  badge?: ReactNode
  headerCenter?: ReactNode
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
  headerCenter,
  actions,
  children,
  widthClassName = 'w-full max-w-none',
}: RecordDetailPageShellProps) {
  return (
    <div className="min-h-full px-8 py-8">
      <div className={widthClassName}>
        <div className="mb-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
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
          {headerCenter ? (
            <div className="flex flex-wrap items-center justify-center gap-2 md:pt-10">{headerCenter}</div>
          ) : (
            <div />
          )}
          {actions ? (
            <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">{actions}</div>
          ) : null}
        </div>

        {children}
      </div>
    </div>
  )
}
