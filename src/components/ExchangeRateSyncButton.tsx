'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ExchangeRateSyncButton() {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  async function handleSync(mode: 'latest' | 'historical') {
    setSyncing(true)
    setMessage('')

    try {
      if (mode === 'historical' && (!startDate || !endDate)) {
        setMessageType('error')
        setMessage('Historical FX backfill requires both a start date and end date.')
        return
      }

      const response = await fetch('/api/exchange-rates/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'historical'
            ? { startDate, endDate }
            : {},
        ),
      })

      const body = await response.json() as {
        error?: string
        total?: number
        baseCurrency?: string
        effectiveDate?: string | null
        processedDates?: number
        failedDates?: number
        mode?: 'latest' | 'historical'
      }
      if (!response.ok) {
        setMessageType('error')
        setMessage(body.error ?? 'Unable to sync exchange rates')
        return
      }

      setMessageType('success')
      setMessage(
        body.mode === 'historical'
          ? `Backfilled ${body.processedDates ?? 0} date${(body.processedDates ?? 0) === 1 ? '' : 's'} for ${body.baseCurrency ?? 'base currency'}. Failed dates: ${body.failedDates ?? 0}.`
          : `Synced ${body.total ?? 0} rates for ${body.baseCurrency ?? 'base currency'} on ${body.effectiveDate ?? 'latest date'}.`,
      )
      router.refresh()
    } catch {
      setMessageType('error')
      setMessage('Unable to sync exchange rates')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-end justify-end gap-2">
        <label className="flex flex-col gap-1 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>Start Date</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-md border bg-transparent px-2.5 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </label>
        <label className="flex flex-col gap-1 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>End Date</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-md border bg-transparent px-2.5 py-1.5 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </label>
        <button
          type="button"
          onClick={() => handleSync('historical')}
          disabled={syncing}
          className="inline-flex items-center rounded-lg border px-3.5 py-1.5 text-sm font-semibold text-white transition disabled:opacity-60"
          style={{ borderColor: 'var(--border-muted)' }}
        >
          {syncing ? 'Syncing...' : 'Backfill History'}
        </button>
        <button
          type="button"
          onClick={() => handleSync('latest')}
          disabled={syncing}
          className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white transition disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          {syncing ? 'Syncing...' : 'Sync Latest Rates'}
        </button>
      </div>
      {message ? (
        <p
          className="max-w-sm text-right text-xs"
          style={messageType === 'success' ? { color: '#86efac' } : { color: '#fca5a5' }}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
