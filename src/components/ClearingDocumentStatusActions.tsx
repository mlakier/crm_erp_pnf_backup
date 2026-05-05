'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ClearingDocumentStatusActions({
  clearingDocumentId,
  canPost,
  canReverse,
}: {
  clearingDocumentId: string
  canPost: boolean
  canReverse: boolean
}) {
  const router = useRouter()
  const [savingAction, setSavingAction] = useState<'post' | 'reverse' | null>(null)
  const [error, setError] = useState('')

  async function runAction(action: 'post' | 'reverse') {
    setSavingAction(action)
    setError('')

    try {
      const response = await fetch(
        `/api/clearing-documents?action=${encodeURIComponent(action)}&id=${encodeURIComponent(clearingDocumentId)}`,
        { method: 'POST' },
      )
      const body = (await response.json().catch(() => ({}))) as {
        error?: string
        reversalId?: string
      }

      if (!response.ok) {
        setError(body.error ?? `Unable to ${action} clearing document`)
        return
      }

      if (action === 'reverse' && body.reversalId) {
        router.push(`/clearing-documents/${body.reversalId}`)
        return
      }

      router.refresh()
    } catch {
      setError(`Unable to ${action} clearing document`)
    } finally {
      setSavingAction(null)
    }
  }

  if (!canPost && !canReverse) return null

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {canPost ? (
          <button
            type="button"
            onClick={() => void runAction('post')}
            disabled={savingAction !== null}
            className="inline-flex items-center rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {savingAction === 'post' ? 'Posting...' : 'Post'}
          </button>
        ) : null}
        {canReverse ? (
          <button
            type="button"
            onClick={() => void runAction('reverse')}
            disabled={savingAction !== null}
            className="inline-flex items-center rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-60"
          >
            {savingAction === 'reverse' ? 'Reversing...' : 'Reverse'}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
