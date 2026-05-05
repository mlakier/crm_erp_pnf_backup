'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import DeleteButton from '@/components/DeleteButton'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionSaveButton from '@/components/TransactionSaveButton'

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

export default function RecordDetailActionBar({
  mode,
  detailHref,
  formId,
  recordId,
  useTransactionSaveButton = false,
  saveLabel = 'Save',
  saveButtonLabel,
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
  onSave,
  saving = false,
  saveError,
  onDelete,
  showDeleteInEdit = false,
  detailExtraActions,
  editExtraActions,
  createExtraActions,
}: {
  mode: 'detail' | 'edit' | 'create' | 'customize'
  detailHref?: string
  formId?: string
  recordId?: string
  useTransactionSaveButton?: boolean
  saveLabel?: string
  saveButtonLabel?: string
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
  onSave?: () => void
  saving?: boolean
  saveError?: string
  onDelete?: () => void
  showDeleteInEdit?: boolean
  detailExtraActions?: ReactNode
  editExtraActions?: ReactNode
  createExtraActions?: ReactNode
}) {
  if (mode === 'customize') {
    return null
  }

  const deleteAction =
    onDelete ? (
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex items-center rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
      >
        {deleteLabel ?? 'Delete'}
      </button>
    ) : deleteResource && deleteId ? (
      <DeleteButton resource={deleteResource} id={deleteId} label={deleteLabel} />
    ) : null

  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'edit' ? editExtraActions : createExtraActions}
          {detailHref ? (
            <Link
              href={detailHref}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </Link>
          ) : null}
          {onSave ? (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              {saving ? 'Saving...' : (saveButtonLabel ?? saveLabel)}
            </button>
          ) : useTransactionSaveButton && formId ? (
            <TransactionSaveButton formId={formId} recordId={recordId} />
          ) : formId ? (
            <button
              type="submit"
              form={formId}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              {saveButtonLabel ?? saveLabel}
            </button>
          ) : null}
          {mode === 'edit' && showDeleteInEdit ? deleteAction : null}
        </div>
        {saveError ? (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>
            {saveError}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
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
        {deleteAction}
        {detailExtraActions}
      </div>
    </div>
  )
}
