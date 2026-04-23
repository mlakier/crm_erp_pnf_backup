import Link from 'next/link'
import { notFound } from 'next/navigation'
import ManageListDetailClient from '@/components/ManageListDetailClient'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import { loadManagedListDetail } from '@/lib/manage-lists'

export default async function ManagedListDetailPageContent({
  listKey,
  editing,
}: {
  listKey: string
  editing: boolean
}) {
  const detail = await loadManagedListDetail(decodeURIComponent(listKey))
  if (!detail) notFound()

  const detailHref = `/lists/${encodeURIComponent(detail.key)}`

  return (
    <RecordDetailPageShell
      backHref="/lists"
      backLabel="<- Back to Manage Lists"
      meta={detail.systemManaged ? 'Standard List' : 'Custom List'}
      title={detail.label}
      actions={
        editing ? null : (
          <Link
            href={`${detailHref}/edit`}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            Edit
          </Link>
        )
      }
    >
      <ManageListDetailClient
        listKey={detail.key}
        initialLabel={detail.label}
        initialWhereUsed={detail.whereUsed}
        initialDisplayOrder={detail.displayOrder}
        initialRows={detail.rows}
        systemManaged={detail.systemManaged}
        editing={editing}
      />
    </RecordDetailPageShell>
  )
}
