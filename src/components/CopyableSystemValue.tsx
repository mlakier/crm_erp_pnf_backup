'use client'

import { useState } from 'react'

export default function CopyableSystemValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const copyValue = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="break-all font-mono text-xs">{value}</span>
      <button
        type="button"
        onClick={copyValue}
        className="shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  )
}
