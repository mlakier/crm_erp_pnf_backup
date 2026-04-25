import Link from 'next/link'
import DeleteButton from '@/components/DeleteButton'

type QuotePageActionsProps = {
  recordId?: string
  detailHref: string
  editing?: boolean
  customizing?: boolean
}

export default function QuotePageActions({
  recordId,
  detailHref,
  editing = false,
  customizing = false,
}: QuotePageActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!editing && !customizing ? (
        <>
          <Link
            href={detailHref + '?edit=1'}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            Edit
          </Link>
          {recordId ? <DeleteButton resource="quotes" id={recordId} /> : null}
        </>
      ) : null}

      {editing ? (
        <>
          <Link
            href={detailHref}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            form={`inline-record-form-${recordId ?? 'draft'}`}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            Save
          </button>
        </>
      ) : null}
    </div>
  )
}
