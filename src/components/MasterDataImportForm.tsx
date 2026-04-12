'use client'

import { useState } from 'react'
import { MASTER_DATA_ENTITY_OPTIONS, MASTER_DATA_IMPORT_SCHEMA, type SupportedEntity } from '@/lib/master-data-import-schema'

type ImportMode = 'add' | 'update' | 'addOrUpdate'

type ImportResult = {
  entity: string
  mode: ImportMode
  dryRun: boolean
  totalRows: number
  succeeded: number
  failed: number
  errors: Array<{ row: number; message: string }>
}

export default function MasterDataImportForm() {
  const [entity, setEntity] = useState<SupportedEntity>('currencies')
  const [mode, setMode] = useState<ImportMode>('addOrUpdate')
  const [dryRun, setDryRun] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setResult(null)

    if (!file) {
      setError('Please select a CSV or XLSX file.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('entity', entity)
      formData.append('mode', mode)
      formData.append('dryRun', String(dryRun))
      formData.append('file', file)

      const response = await fetch('/api/master-data/import', {
        method: 'POST',
        body: formData,
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body?.error ?? 'Import failed')
        return
      }
      setResult(body as ImportResult)
    } catch {
      setError('Import failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Master Data Type</span>
          <select
            value={entity}
            onChange={(event) => setEntity(event.target.value as SupportedEntity)}
            className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            {MASTER_DATA_ENTITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>File (CSV or XLSX)</span>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>Import Mode</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as ImportMode)}
            className="w-full rounded-md border px-3 py-2 text-white bg-transparent"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="addOrUpdate">Add or Update (Upsert)</option>
            <option value="add">Add Only (Skip existing)</option>
            <option value="update">Update Only (Skip new)</option>
          </select>
        </label>

        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(event) => setDryRun(event.target.checked)}
            />
            Dry run only (validate without writing)
          </label>
        </div>
      </div>

      <div className="rounded-lg border p-4 text-xs" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
        <p className="font-semibold text-white">Expected key columns by type</p>
        {MASTER_DATA_ENTITY_OPTIONS.map((option, index) => {
          const fields = MASTER_DATA_IMPORT_SCHEMA[option.value].fields.map((field) => field.key).join(', ')
          return (
            <p key={option.value} className={index === 0 || index === 5 ? 'mt-2' : ''}>
              {option.label}: {fields}
            </p>
          )
        })}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            const link = document.createElement('a')
            link.href = `/api/master-data/templates?entity=${entity}`
            link.download = `${entity}_template.xlsx`
            link.click()
          }}
          className="rounded-md px-3 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--text-tertiary)' }}
        >
          Download Template
        </button>
        <button
          type="submit"
          disabled={uploading}
          className="rounded-md px-3 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          {uploading ? 'Uploading...' : dryRun ? 'Validate File' : 'Import Data'}
        </button>
      </div>

      {result ? (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
          <p className="text-sm text-white font-semibold">Import Result ({result.mode === 'addOrUpdate' ? 'Add or Update' : result.mode === 'add' ? 'Add Only' : 'Update Only'} | {result.dryRun ? 'Dry Run' : 'Committed'})</p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Rows: {result.totalRows}, Success: {result.succeeded}, Failed: {result.failed}</p>
          {result.errors.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs" style={{ color: 'var(--danger)' }}>
              {result.errors.slice(0, 50).map((entry, index) => (
                <li key={`${entry.row}-${index}`}>Row {entry.row}: {entry.message}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>No validation errors.</p>
          )}
        </div>
      ) : null}
    </form>
  )
}
