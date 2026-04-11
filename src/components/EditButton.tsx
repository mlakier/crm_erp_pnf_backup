'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface EditField {
  name: string
  label: string
  value: string
  type?: 'text' | 'number' | 'date'
}

export default function EditButton({
  resource,
  id,
  fields,
}: {
  resource: string
  id: string
  fields: EditField[]
}) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.value]))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/${resource}?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body?.error || 'Failed to save')
        setSaving(false)
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError('Failed to save')
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
        style={{ backgroundColor: 'var(--accent-primary-strong)' }}
      >
        Edit
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            className="w-full max-w-md rounded-xl border p-6 shadow-xl"
            style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
          >
            <h3 className="mb-4 text-base font-semibold text-white">Edit record</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {fields.map((f) => (
                <div key={f.name}>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                  <input
                    type={f.type ?? 'text'}
                    value={values[f.name]}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [f.name]: e.target.value }))
                    }
                    className="mt-1 block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white shadow-sm focus:outline-none"
                    style={{ borderColor: 'var(--border-muted)' }}
                  />
                </div>
              ))}
              {error ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
