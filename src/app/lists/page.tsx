'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getDefaultListValues,
  LIST_LABELS,
  LIST_PAGE_LABELS,
  ListOptionsConfig,
  ListPageKey,
} from '@/lib/list-options'

function pageKeys(): ListPageKey[] {
  return Object.keys(LIST_PAGE_LABELS) as ListPageKey[]
}

export default function ListsPage() {
  const [page, setPage] = useState<ListPageKey>('customer')
  const [list, setList] = useState<string>('industry')
  const [values, setValues] = useState<string[]>(() => getDefaultListValues('customer', 'industry'))
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const availableLists = useMemo(() => Object.keys(LIST_LABELS[page]), [page])

  useEffect(() => {
    setList((current) => (availableLists.includes(current) ? current : availableLists[0]))
  }, [availableLists])

  useEffect(() => {
    let mounted = true
    async function loadConfig() {
      try {
        const response = await fetch('/api/config/lists', { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok || !mounted) return

        const configured = body?.config?.[page]?.[list]
        if (Array.isArray(configured) && configured.length > 0) {
          setValues(configured.map((value: unknown) => String(value)))
          return
        }

        setValues(getDefaultListValues(page, list as keyof ListOptionsConfig[typeof page] & string))
      } catch {
        setValues(getDefaultListValues(page, list as keyof ListOptionsConfig[typeof page] & string))
      }
    }

    loadConfig()
    return () => {
      mounted = false
    }
  }, [page, list])

  const addValue = () => {
    const next = newValue.trim()
    if (!next) return
    if (values.includes(next)) {
      setNewValue('')
      return
    }
    setValues((prev) => [...prev, next])
    setNewValue('')
  }

  const updateValue = (index: number, next: string) => {
    setValues((prev) => prev.map((value, i) => (i === index ? next : value)))
  }

  const removeValue = (index: number) => {
    setValues((prev) => prev.filter((_, i) => i !== index))
  }

  const saveValues = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/config/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, list, values }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error || 'Unable to save list values')
        setSaving(false)
        return
      }

      const nextValues = body?.config?.[page]?.[list]
      if (Array.isArray(nextValues)) {
        setValues(nextValues.map((value: unknown) => String(value)))
      }
      setSuccess('List values saved')
      setSaving(false)
    } catch {
      setError('Unable to save list values')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Master Data Lists</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Manage dropdown values used across create forms.
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="grid gap-3 md:grid-cols-[240px_240px_1fr]">
            <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>Page</span>
              <select
                value={page}
                onChange={(event) => setPage(event.target.value as ListPageKey)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              >
                {pageKeys().map((key) => (
                  <option key={key} value={key}>
                    {LIST_PAGE_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>List</span>
              <select
                value={list}
                onChange={(event) => setList(event.target.value)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              >
                {availableLists.map((listKey) => (
                  <option key={listKey} value={listKey}>
                    {LIST_LABELS[page][listKey as keyof typeof LIST_LABELS[typeof page]]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="mb-4 flex items-end gap-2">
            <label className="flex-1 space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span>Add value</span>
              <input
                value={newValue}
                onChange={(event) => setNewValue(event.target.value)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
                placeholder="Type value and click Add"
              />
            </label>
            <button
              type="button"
              onClick={addValue}
              className="rounded-md px-3 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              Add
            </button>
          </div>

          <div className="space-y-2">
            {values.map((value, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={value}
                  onChange={(event) => updateValue(index, event.target.value)}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                />
                <button
                  type="button"
                  onClick={() => removeValue(index)}
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {error ? <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}
          {success ? <p className="mt-3 text-sm text-emerald-300">{success}</p> : null}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={saveValues}
              disabled={saving}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              {saving ? 'Saving...' : 'Save List'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
