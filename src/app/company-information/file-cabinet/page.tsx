'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { fmtDocumentDate } from '@/lib/format'

type CabinetFile = {
  id: string
  originalName: string
  storedName: string
  url: string
  size: number
  type: string
  uploadedAt: string
}

type ApiPayload = {
  files?: CabinetFile[]
  error?: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CompanyFileCabinetPage() {
  const [files, setFiles] = useState<CabinetFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadFiles() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/company-information/file-cabinet', { cache: 'no-store' })
      const body = (await response.json()) as ApiPayload
      if (!response.ok) {
        setError(body.error ?? 'Failed to load files')
        return
      }
      setFiles(body.files ?? [])
    } catch {
      setError('Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFiles()
  }, [])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedFiles || selectedFiles.length === 0) {
      setError('Choose at least one file to upload')
      return
    }

    try {
      setUploading(true)
      setError('')
      setMessage('')

      const formData = new FormData()
      Array.from(selectedFiles).forEach((file) => formData.append('files', file))

      const response = await fetch('/api/company-information/file-cabinet', {
        method: 'POST',
        body: formData,
      })
      const body = (await response.json()) as ApiPayload

      if (!response.ok) {
        setError(body.error ?? 'Upload failed')
        return
      }

      setFiles(body.files ?? [])
      setSelectedFiles(null)
      const fileInput = event.currentTarget.elements.namedItem('uploadFiles') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
      setMessage('Files uploaded successfully')
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      setDeletingId(id)
      setError('')
      setMessage('')

      const response = await fetch('/api/company-information/file-cabinet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const body = (await response.json()) as ApiPayload

      if (!response.ok) {
        setError(body.error ?? 'Delete failed')
        return
      }

      setFiles(body.files ?? [])
      setMessage('File deleted')
    } catch {
      setError('Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const fileCountLabel = useMemo(() => `${files.length} file${files.length === 1 ? '' : 's'}`, [files.length])

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-6xl rounded-2xl border p-8" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Company File Cabinet</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Upload and manage company files used across Company Information.
            </p>
          </div>
          <Link href="/company-information" className="rounded-md border px-3 py-2 text-sm font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
            Back to Company Information
          </Link>
        </div>

        <form onSubmit={handleUpload} className="mt-6 rounded-xl border p-4" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card-elevated)' }}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Upload files</span>
              <input
                id="uploadFiles"
                name="uploadFiles"
                type="file"
                multiple
                onChange={(event) => setSelectedFiles(event.target.files)}
                className="w-full cursor-pointer rounded-md border bg-transparent px-3 py-2 text-sm text-white file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-blue-500 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500"
                style={{ borderColor: 'var(--border-muted)' }}
              />
            </label>

            <button
              type="submit"
              disabled={uploading}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
          {message ? <p className="mt-2 text-sm" style={{ color: 'var(--success)' }}>{message}</p> : null}
          {error ? <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        </form>

        <div className="mt-6 rounded-xl border" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="border-b px-4 py-3 text-sm font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
            Stored files: {fileCountLabel}
          </div>

          {loading ? (
            <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>Loading files...</p>
          ) : files.length === 0 ? (
            <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>No files uploaded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Name</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Type</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Size</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Uploaded</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file, index) => (
                    <tr key={file.id} style={index < files.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                      <td className="px-4 py-2 text-sm text-white">{file.originalName}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{file.type}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatSize(file.size)}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(file.uploadedAt)}</td>
                      <td className="px-4 py-2 text-sm">
                        <div className="flex justify-end gap-2">
                          <a href={file.url} target="_blank" rel="noreferrer" className="rounded-md border px-2 py-1" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                            Open
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDelete(file.id)}
                            disabled={deletingId === file.id}
                            className="rounded-md border px-2 py-1 disabled:opacity-60"
                            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                          >
                            {deletingId === file.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
