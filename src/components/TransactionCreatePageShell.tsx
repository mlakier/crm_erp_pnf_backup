import Link from 'next/link'
import type { ReactNode } from 'react'
import TransactionActionStack from '@/components/TransactionActionStack'

export default function TransactionCreatePageShell({
  backHref,
  backLabel,
  title,
  description,
  formId,
  children,
}: {
  backHref: string
  backLabel: string
  title: string
  description?: string
  formId?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-full px-8 py-8">
      <div className="w-full max-w-none">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href={backHref} className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              {backLabel}
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>
              New
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                {description}
              </p>
            ) : null}
          </div>
          {formId ? <TransactionActionStack mode="create" cancelHref={backHref} formId={formId} /> : null}
        </div>
        <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
