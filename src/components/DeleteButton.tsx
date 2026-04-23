'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type DeleteButtonProps = {
  id: string
  resource?: string
  endpoint?: string
  label?: string
}

export default function DeleteButton({ resource, endpoint, id, label }: DeleteButtonProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm(`Delete ${label ?? 'this item'} permanently?`)) {
      return
    }

    setDeleting(true)
    setError('')

    try {
      const deleteEndpoint = endpoint ?? (resource ? `/api/${resource}` : null)

      if (!deleteEndpoint) {
        setError('Unable to delete item')
        setDeleting(false)
        return
      }

      const response = await fetch(`${deleteEndpoint}?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error || 'Unable to delete item')
        setDeleting(false)
        return
      }

      router.refresh()
    } catch {
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
      {error ? <span className="whitespace-pre-line text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
