'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OpportunityStageMoveButton({
  id,
  name,
  amount,
  closeDate,
  targetStage,
  label,
}: {
  id: string
  name: string
  amount: number | null
  closeDate: string
  targetStage: string
  label: string
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const moveStage = async () => {
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/opportunities?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          amount: amount ?? '',
          stage: targetStage,
          closeDate,
        }),
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body?.error || 'Unable to move stage')
        setSaving(false)
        return
      }

      router.refresh()
    } catch {
      setError('Unable to move stage')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={moveStage}
        disabled={saving}
        className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
      >
        {saving ? '...' : label}
      </button>
      {error ? <span className="text-[10px] text-red-600">{error}</span> : null}
    </div>
  )
}
