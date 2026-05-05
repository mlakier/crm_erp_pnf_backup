'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import SearchableSelect from '@/components/SearchableSelect'

type AccountingPeriodOption = {
  id: string
  name: string
  subsidiaryId: string | null
}

type SubsidiaryOption = {
  id: string
  subsidiaryId: string
  name: string
}

type Props = {
  accountingPeriods: AccountingPeriodOption[]
  subsidiaries: SubsidiaryOption[]
  defaultAsOfDate: string
}

export default function FxRevaluationRunPanel({
  accountingPeriods,
  subsidiaries,
  defaultAsOfDate,
}: Props) {
  const router = useRouter()
  const [accountingPeriodId, setAccountingPeriodId] = useState(accountingPeriods[0]?.id ?? '')
  const [subsidiaryId, setSubsidiaryId] = useState('')
  const [asOfDate, setAsOfDate] = useState(defaultAsOfDate)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const accountingPeriodOptions = accountingPeriods.map((period) => ({
    value: period.id,
    label: period.name,
    searchText: period.name,
  }))

  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
    searchText: `${subsidiary.subsidiaryId} ${subsidiary.name}`,
  }))

  async function handleRun() {
    setRunning(true)
    setMessage(null)

    try {
      const response = await fetch('/api/fx-revaluation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountingPeriodId,
          asOfDate,
          subsidiaryId: subsidiaryId || null,
        }),
      })

      const body = await response.json() as {
        error?: string
        runNumber?: string
        message?: string | null
        summary?: {
          revaluedItems?: number
          failedItems?: number
          journalEntryId?: string | null
        }
      }

      if (!response.ok) {
        setMessageType('error')
        setMessage(body.error ?? 'Unable to run FX revaluation.')
        return
      }

      setMessageType('success')
      setMessage(
        body.message
          ?? `FX revaluation ${body.runNumber ?? ''} completed. Revalued items: ${body.summary?.revaluedItems ?? 0}. Failed items: ${body.summary?.failedItems ?? 0}.`,
      )
      router.refresh()
    } catch {
      setMessageType('error')
      setMessage('Unable to run FX revaluation.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <section
      className="mb-6 rounded-2xl border px-6 py-5"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            FX Revaluation Run
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Revalue open monetary balances on accounts flagged `Revalue Open Balance`. The run creates an audited batch and a journal using the configured unrealized FX gain and loss accounts.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>Accounting Period</span>
          <SearchableSelect
            selectedValue={accountingPeriodId}
            onSelect={setAccountingPeriodId}
            options={accountingPeriodOptions}
            placeholder="Select accounting period"
            searchPlaceholder="Search accounting period"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>Subsidiary Scope</span>
          <SearchableSelect
            selectedValue={subsidiaryId}
            onSelect={setSubsidiaryId}
            options={subsidiaryOptions}
            placeholder="All Eligible Subsidiaries"
            searchPlaceholder="Search subsidiary"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>As-Of Date</span>
          <input
            type="date"
            value={asOfDate}
            onChange={(event) => setAsOfDate(event.target.value)}
            className="rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={running || !accountingPeriodId || !asOfDate}
            className="inline-flex w-full items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            {running ? 'Running...' : 'Run FX Revaluation'}
          </button>
        </div>
      </div>

      {message ? (
        <p
          className="mt-3 text-sm"
          style={messageType === 'success' ? { color: '#86efac' } : { color: '#fca5a5' }}
        >
          {message}
        </p>
      ) : null}
    </section>
  )
}
