'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteButton({ resource, id }: { resource: string; id: string }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm('Delete this item permanently?')) {
      return
    }

    setDeleting(true)
    setError('')

    try {
      const response = await fetch(`/api/${resource}?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body?.error || 'Unable to delete item')
        setDeleting(false)
        return
      }

      router.refresh()
    } catch (err) {
      setError('Unable to delete item')
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex items-center rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
      >
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
