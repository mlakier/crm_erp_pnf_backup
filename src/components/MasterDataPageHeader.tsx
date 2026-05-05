import type { ReactNode } from 'react'

type MasterDataPageHeaderProps = {
  title: string
  total: number
  logoUrl?: string | null
  actions?: ReactNode
}

export default function MasterDataPageHeader({
  title,
  total,
  logoUrl,
  actions,
}: MasterDataPageHeaderProps) {
  void logoUrl
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1 text-center">
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {total} total
        </p>
      </div>
      <div className="flex justify-end gap-2">
        {actions}
      </div>
    </div>
  )
}
