'use client'

import Link from 'next/link'
import EditButton, { type EditButtonProps } from '@/components/EditButton'
import DeleteButton, { type DeleteButtonProps } from '@/components/DeleteButton'

type ListRowActionsProps = {
  viewHref?: string
  editHref?: string
  editButton?: EditButtonProps
  deleteButton?: DeleteButtonProps
}

export default function ListRowActions({
  viewHref,
  editHref,
  editButton,
  deleteButton,
}: ListRowActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {viewHref ? (
        <Link
          href={viewHref}
          className="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold shadow-sm"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
        >
          View
        </Link>
      ) : null}
      {editHref ? (
        <Link
          href={editHref}
          className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          Edit
        </Link>
      ) : editButton ? (
        <EditButton {...editButton} forceModal={editButton.forceModal ?? Boolean(viewHref)} />
      ) : null}
      {deleteButton ? <DeleteButton {...deleteButton} /> : null}
    </div>
  )
}
