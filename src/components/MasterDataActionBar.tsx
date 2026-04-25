'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import DeleteButton from '@/components/DeleteButton'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'

type ExportField = {
  label: string
  value: string
  type?: string
  multiple?: boolean
  options?: Array<{ value: string; label: string }>
}

type ExportSection = {
  title: string
  fields: ExportField[]
}

export default function MasterDataActionBar({
  mode,
  detailHref,
  formId,
  newHref,
  duplicateHref,
  customizeHref,
  editHref,
  deleteResource,
  deleteId,
  deleteLabel,
  exportTitle,
  exportFileName,
  exportSections,
  extraActions,
}: {
  mode: 'detail' | 'edit' | 'create'
  detailHref?: string
  formId?: string
  newHref?: string
  duplicateHref?: string
  customizeHref?: string
  editHref?: string
  deleteResource?: string
  deleteId?: string
  deleteLabel?: string
  exportTitle?: string
  exportFileName?: string
  exportSections?: ExportSection[]
  extraActions?: ReactNode
}) {
  if (mode === 'create' || mode === 'edit') {
    return (
      <>
        {detailHref ? (
          <Link
            href={detailHref}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </Link>
        ) : null}
        {formId ? (
          <button
            type="submit"
            form={formId}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            Save
          </button>
        ) : null}
        {extraActions}
      </>
    )
  }

  return (
    <>
      {newHref ? <MasterDataDetailCreateMenu newHref={newHref} duplicateHref={duplicateHref} /> : null}
      {exportTitle && exportSections ? (
        <MasterDataDetailExportMenu title={exportTitle} fileName={exportFileName} sections={exportSections} />
      ) : null}
      {customizeHref ? (
        <Link
          href={customizeHref}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
        >
          Customize
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
      ) : null}
      {deleteResource && deleteId ? <DeleteButton resource={deleteResource} id={deleteId} label={deleteLabel} /> : null}
      {extraActions}
    </>
  )
}
