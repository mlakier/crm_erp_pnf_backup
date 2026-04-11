'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function RecordStatusButton({
  resource,
  id,
  status,
  label,
  tone = 'indigo',
}: {
  resource: string
  id: string
  status: string
  label: string
  tone?: 'indigo' | 'emerald' | 'blue' | 'amber' | 'red' | 'gray'
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const styles: Record<string, string> = {
    indigo: 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400',
    blue: 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400',
    amber: 'bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300',
    red: 'bg-red-600 hover:bg-red-700 disabled:bg-red-400',
    gray: 'bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400',
  }

  const handleClick = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/${resource}?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body?.error || 'Unable to update status')
        setSaving(false)
        return
      }

      router.refresh()
    } catch {
      setError('Unable to update status')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={saving}
        className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white ${styles[tone]}`}
      >
        {saving ? 'Saving...' : label}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}