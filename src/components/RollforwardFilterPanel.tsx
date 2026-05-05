'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import SearchableSelect from '@/components/SearchableSelect'
import type { RollforwardAmountLayer } from '@/lib/rollforward-report'

type Option = {
  value: string
  label: string
  searchText?: string
}

type Props = {
  accountingPeriods: Option[]
  subsidiaries: Option[]
  rollforwardCategories: Option[]
  accounts: Option[]
  amountLayers: Array<{ value: RollforwardAmountLayer; label: string }>
  initialAccountingPeriodId: string
  initialSubsidiaryId: string
  initialRollforwardCategory: string
  initialAccountId: string
  initialAmountLayer: RollforwardAmountLayer
}

function buildQueryString(next: Record<string, string | null | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(next)) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export default function RollforwardFilterPanel({
  accountingPeriods,
  subsidiaries,
  rollforwardCategories,
  accounts,
  amountLayers,
  initialAccountingPeriodId,
  initialSubsidiaryId,
  initialRollforwardCategory,
  initialAccountId,
  initialAmountLayer,
}: Props) {
  const router = useRouter()
  const [accountingPeriodId, setAccountingPeriodId] = useState(initialAccountingPeriodId)
  const [subsidiaryId, setSubsidiaryId] = useState(initialSubsidiaryId)
  const [rollforwardCategory, setRollforwardCategory] = useState(initialRollforwardCategory)
  const [accountId, setAccountId] = useState(initialAccountId)
  const [amountLayer, setAmountLayer] = useState<RollforwardAmountLayer>(initialAmountLayer)

  function handleRun() {
    router.push(`/rollforwards${buildQueryString({
      accountingPeriodId,
      subsidiaryId: subsidiaryId || null,
      rollforwardCategory: rollforwardCategory || null,
      accountId: accountId || null,
      amountLayer,
    })}`)
  }

  return (
    <section
      className="mb-6 rounded-2xl border px-6 py-5"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
    >
      <div className="grid gap-4 md:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>Accounting Period</span>
          <SearchableSelect
            selectedValue={accountingPeriodId}
            onSelect={setAccountingPeriodId}
            options={accountingPeriods}
            placeholder="Select accounting period"
            searchPlaceholder="Search accounting period"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>Subsidiary</span>
          <SearchableSelect
            selectedValue={subsidiaryId}
            onSelect={setSubsidiaryId}
            options={subsidiaries}
            placeholder="All Eligible Subsidiaries"
            searchPlaceholder="Search subsidiary"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>Rollforward Category</span>
          <SearchableSelect
            selectedValue={rollforwardCategory}
            onSelect={setRollforwardCategory}
            options={rollforwardCategories}
            placeholder="All Categories"
            searchPlaceholder="Search rollforward category"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>Account</span>
          <SearchableSelect
            selectedValue={accountId}
            onSelect={setAccountId}
            options={accounts}
            placeholder="All Accounts"
            searchPlaceholder="Search account"
            dropdownWidthMode="trigger"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>Amount Layer</span>
          <SearchableSelect
            selectedValue={amountLayer}
            onSelect={(value) => setAmountLayer((value || initialAmountLayer) as RollforwardAmountLayer)}
            options={amountLayers.map((option) => ({
              value: option.value,
              label: option.label,
              searchText: option.label,
            }))}
            placeholder="Select amount layer"
            searchPlaceholder="Search amount layer"
            clearSelectionOnQueryChange={false}
          />
        </label>

        <div className="md:col-span-5 flex items-center gap-3">
          <button
            type="button"
            onClick={handleRun}
            disabled={!accountingPeriodId}
            className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            Run Rollforward
          </button>
          <button
            type="button"
            onClick={() => router.push('/rollforwards')}
            className="inline-flex items-center justify-center rounded-lg border px-3.5 py-2 text-sm font-semibold"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  )
}
