import type { ReactNode } from 'react'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import MasterDataActionBar from '@/components/MasterDataActionBar'

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
      actions={formId ? <MasterDataActionBar mode="create" detailHref={backHref} formId={formId} /> : null}
    >
      {children}
    </RecordDetailPageShell>
  )
}
