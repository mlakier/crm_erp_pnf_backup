import Link from 'next/link'
import type { ReactNode } from 'react'

export default function TransactionCreatePageShell({
  backHref,
  backLabel,
  title,
  description,
  children,
}: {
  backHref: string
  backLabel: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-full px-8 py-8">
      <div className="w-full max-w-none">
        <Link href={backHref} className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {backLabel}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        ) : null}
        <div className="mt-6 rounded-2xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
