'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Subsidiary = {
  id: string
  code: string
  name: string
}

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense', 'Other']

export default function ChartOfAccountCreateForm({
  subsidiaries,
  onSuccess,
  onCancel,
}: {
  subsidiaries: Subsidiary[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [accountNumber, setAccountNumber] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [accountType, setAccountType] = useState(ACCOUNT_TYPES[0])

  const [inventory, setInventory] = useState(false)
  const [revalueOpenBalance, setRevalueOpenBalance] = useState(false)
  const [eliminateIntercoTransactions, setEliminateIntercoTransactions] = useState(false)
  const [summary, setSummary] = useState(false)

  const [scopeMode, setScopeMode] = useState<'selected' | 'parent'>('selected')
  const [selectedSubsidiaryIds, setSelectedSubsidiaryIds] = useState<string[]>([])
  const [parentSubsidiaryId, setParentSubsidiaryId] = useState(subsidiaries[0]?.id ?? '')
  const [includeChildren, setIncludeChildren] = useState(true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const sortedSubsidiaries = useMemo(
    () => [...subsidiaries].sort((a, b) => a.code.localeCompare(b.code)),
    [subsidiaries]
  )

  const toggleSubsidiary = (id: string) => {
    setSelectedSubsidiaryIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    if (scopeMode === 'selected' && selectedSubsidiaryIds.length === 0) {
      setError('Select at least one subsidiary, or switch to Parent mode.')
      setSaving(false)
      return
    }

    if (scopeMode === 'parent' && !parentSubsidiaryId) {
      setError('Select a parent subsidiary.')
      setSaving(false)
      return
    }

    try {
      const response = await fetch('/api/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber,
          name,
          description,
          accountType,
          inventory,
          revalueOpenBalance,
          eliminateIntercoTransactions,
          summary,
          scopeMode,
          subsidiaryIds: scopeMode === 'selected' ? selectedSubsidiaryIds : [],
          parentSubsidiaryId: scopeMode === 'parent' ? parentSubsidiaryId : null,
          includeChildren: scopeMode === 'parent' ? includeChildren : false,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body.error || 'Unable to create chart account')
        setSaving(false)
        return
      }

      setAccountNumber('')
      setName('')
      setDescription('')
      setAccountType(ACCOUNT_TYPES[0])
      setInventory(false)
      setRevalueOpenBalance(false)
      setEliminateIntercoTransactions(false)
      setSummary(false)
      setScopeMode('selected')
      setSelectedSubsidiaryIds([])
      setParentSubsidiaryId(subsidiaries[0]?.id ?? '')
      setIncludeChildren(true)
      setSaving(false)
      router.refresh()
      onSuccess?.()
    } catch {
      setError('Unable to create chart account')
      setSaving(false)
    }
  }

  return (
    <section>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Account #</label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
              placeholder="1000"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
              placeholder="Cash"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Account Type</label>
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-transparent py-2 px-3 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CheckboxRow label="Inventory" checked={inventory} onChange={setInventory} />
          <CheckboxRow label="Revalue Open Balance" checked={revalueOpenBalance} onChange={setRevalueOpenBalance} />
          <CheckboxRow label="Eliminate Interco Transactions" checked={eliminateIntercoTransactions} onChange={setEliminateIntercoTransactions} />
          <CheckboxRow label="Summary" checked={summary} onChange={setSummary} />
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-muted)' }}>
          <p className="text-sm font-semibold text-white">Subsidiary Scope</p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="scopeMode"
                checked={scopeMode === 'selected'}
                onChange={() => setScopeMode('selected')}
              />
              Select Multiple Subsidiaries
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="scopeMode"
                checked={scopeMode === 'parent'}
                onChange={() => setScopeMode('parent')}
              />
              Select Parent Subsidiary
            </label>
          </div>

          {scopeMode === 'selected' ? (
            <div className="mt-3 max-h-44 overflow-y-auto rounded-md border p-3" style={{ borderColor: 'var(--border-muted)' }}>
              {sortedSubsidiaries.map((subsidiary) => (
                <label key={subsidiary.id} className="mb-2 flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={selectedSubsidiaryIds.includes(subsidiary.id)}
                    onChange={() => toggleSubsidiary(subsidiary.id)}
                  />
                  <span>{subsidiary.code} - {subsidiary.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <select
                value={parentSubsidiaryId}
                onChange={(e) => setParentSubsidiaryId(e.target.value)}
                className="block w-full rounded-md border bg-transparent py-2 px-3 text-sm text-white"
                style={{ borderColor: 'var(--border-muted)' }}
              >
                {sortedSubsidiaries.map((subsidiary) => (
                  <option key={subsidiary.id} value={subsidiary.id}>
                    {subsidiary.code} - {subsidiary.name}
                  </option>
                ))}
              </select>
              <CheckboxRow label="Include Children" checked={includeChildren} onChange={setIncludeChildren} />
            </div>
          )}
        </div>

        {error ? <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        <div className="flex items-center justify-end gap-3">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border px-4 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed"
            style={{ backgroundColor: saving ? '#64748b' : 'var(--accent-primary-strong)' }}
          >
            {saving ? 'Saving...' : 'Create Account'}
          </button>
        </div>
      </form>
    </section>
  )
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}
