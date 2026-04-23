'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFieldRequired } from '@/lib/form-requirements'
import type { SelectOption } from '@/lib/list-source'

type ItemOption = { id: string; name: string; listPrice: number; itemId: string | null }

type LineItemDraft = {
  key: number
  itemId: string
  description: string
  quantity: string
  unitPrice: string
  notes: string
}

function emptyLine(key: number): LineItemDraft {
  return { key, itemId: '', description: '', quantity: '1', unitPrice: '', notes: '' }
}

function calculateLinesTotal(lines: LineItemDraft[]): number {
  return lines.reduce((sum, line) => {
    const qty = Math.max(1, parseInt(line.quantity, 10) || 1)
    const price = parseFloat(line.unitPrice.replace(/,/g, '')) || 0
    return sum + qty * price
  }, 0)
}

export default function OpportunityCreateForm({
  userId,
  customers,
  items = [],
  stageOptions,
  fullPage,
  onSuccess,
  onCancel,
}: {
  userId: string
  customers: Array<{ id: string; name: string }>
  items?: ItemOption[]
  stageOptions: SelectOption[]
  fullPage?: boolean
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [stage, setStage] = useState('prospecting')
  const [closeDate, setCloseDate] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([])
  const [nextKey, setNextKey] = useState(1)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(null)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    async function loadRequirements() {
      try {
        const response = await fetch('/api/config/form-requirements', { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) return
        if (mounted) setRuntimeRequirements(body?.config?.opportunityCreate ?? null)
      } catch {
        // Keep static defaults when config API is unavailable.
      }
    }
    loadRequirements()
    return () => {
      mounted = false
    }
  }, [])

  function req(field: string): boolean {
    if (runtimeRequirements && Object.prototype.hasOwnProperty.call(runtimeRequirements, field)) {
      return Boolean(runtimeRequirements[field])
    }
    return isFieldRequired('opportunityCreate', field)
  }

  function requiredLabel(text: string, required: boolean) {
    if (!required) return <>{text}</>
    return (
      <>
        {text} <span style={{ color: 'var(--danger)' }}>*</span>
      </>
    )
  }

  /* -------- Line item helpers -------- */
  const addLine = () => {
    setLineItems((prev) => {
      const nextLines = [...prev, emptyLine(nextKey)]
      setAmount(calculateLinesTotal(nextLines) ? String(calculateLinesTotal(nextLines)) : '')
      return nextLines
    })
    setNextKey((k) => k + 1)
  }

  const removeLine = (key: number) => {
    setLineItems((prev) => {
      const nextLines = prev.filter((line) => line.key !== key)
      setAmount(calculateLinesTotal(nextLines) ? String(calculateLinesTotal(nextLines)) : '')
      return nextLines
    })
  }

  const updateLine = (key: number, field: keyof LineItemDraft, value: string) => {
    setLineItems((prev) =>
      {
        const nextLines = prev.map((l) => {
          if (l.key !== key) return l
          const updated = { ...l, [field]: value }
        // Auto-fill from item catalog
          if (field === 'itemId' && value) {
            const item = items.find((i) => i.id === value)
            if (item) {
              if (!l.description) updated.description = item.name
              updated.unitPrice = item.listPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            }
          }
          return updated
        })
        setAmount(calculateLinesTotal(nextLines) ? String(calculateLinesTotal(nextLines)) : '')
        return nextLines
      },
    )
  }

  // Recalc amount from line items whenever they change
  const linesTotal = calculateLinesTotal(lineItems)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (req('customerId') && !customerId) {
      setError('Please select a customer')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/opportunities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          amount: parseFloat(amount) || 0,
          stage,
          closeDate: closeDate || null,
          customerId,
          userId,
          lineItems: lineItems.map((l) => ({
            itemId: l.itemId || null,
            description: l.description,
            quantity: Math.max(1, parseInt(l.quantity, 10) || 1),
            unitPrice: parseFloat(l.unitPrice.replace(/,/g, '')) || 0,
            notes: l.notes || null,
          })),
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body.error || 'Unable to create opportunity')
        setSaving(false)
        return
      }

      if (fullPage) {
        router.push(`/opportunities/${body.id}`)
        return
      }

      setName('')
      setAmount('')
      setStage('prospecting')
      setCloseDate('')
      setLineItems([])
      setNextKey(1)
      setSaving(false)
      onSuccess?.()
      router.refresh()
    } catch {
      setError('Unable to create opportunity')
      setSaving(false)
    }
  }

  return (
    <section className={fullPage ? '' : 'rounded-lg p-2'}>
      {!fullPage && <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>Opportunity ID is generated automatically when the record is created.</p>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Customer', req('customerId'))}</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required={req('customerId')}
            className="mt-1 block w-full rounded-md border bg-transparent py-2 px-3 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="" disabled>
              Select customer
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Opportunity name', req('name'))}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required={req('name')}
            className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-transparent py-2 px-3 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              {stageOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="text-right">
            <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{requiredLabel('Total Amount', req('amount'))}</label>
            {lineItems.length > 0 ? (
              <p className="mt-1 px-3 py-2 text-sm font-medium text-white">
                ${(parseFloat(amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            ) : (
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm" style={{ color: 'var(--text-muted)' }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required={req('amount')}
                  className="block w-full rounded-md border bg-transparent pl-7 pr-3 py-2 text-sm text-white text-right"
                  style={{ borderColor: 'var(--border-muted)' }}
                />
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Close date</label>
          <input
            type="date"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
            style={{ borderColor: 'var(--border-muted)', colorScheme: 'dark' }}
          />
        </div>

        {/* ----- Line Items Section ----- */}
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Line Items</h3>
            <button
              type="button"
              onClick={addLine}
              className="rounded-md border px-2.5 py-1 text-xs font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--accent-primary-strong)' }}
            >
              + Add Line
            </button>
          </div>

          {lineItems.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No line items. Click &quot;+ Add Line&quot; to add products/services.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    {items.length > 0 && <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Item</th>}
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Description</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide w-20" style={{ color: 'var(--text-muted)' }}>Qty</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide w-28" style={{ color: 'var(--text-muted)' }}>Unit Price</th>
                    <th className="px-2 py-2 text-right text-xs font-medium uppercase tracking-wide w-28" style={{ color: 'var(--text-muted)' }}>Line Total</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Notes</th>
                    <th className="px-2 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line) => {
                    const lineTotal = (Math.max(1, parseInt(line.quantity, 10) || 1)) * (parseFloat(line.unitPrice.replace(/,/g, '')) || 0)
                    return (
                      <tr key={line.key} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                        {items.length > 0 && (
                          <td className="px-2 py-1.5">
                            <select
                              value={line.itemId}
                              onChange={(e) => updateLine(line.key, 'itemId', e.target.value)}
                              className="w-full min-w-[140px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
                              style={{ borderColor: 'var(--border-muted)' }}
                            >
                              <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>—</option>
                              {items.map((item) => (
                                <option key={item.id} value={item.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                                  {item.itemId ? `${item.itemId} - ${item.name}` : item.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className="px-2 py-1.5">
                          <input
                            required
                            value={line.description}
                            onChange={(e) => updateLine(line.key, 'description', e.target.value)}
                            className="w-full min-w-[120px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
                            style={{ borderColor: 'var(--border-muted)' }}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="1"
                            required
                            value={line.quantity}
                            onChange={(e) => updateLine(line.key, 'quantity', e.target.value)}
                            className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
                            style={{ borderColor: 'var(--border-muted)' }}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-sm" style={{ color: 'var(--text-muted)' }}>$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              required
                              value={line.unitPrice}
                              onFocus={(e) => {
                                // Strip formatting on focus so user can type freely
                                const raw = e.target.value.replace(/[^0-9.]/g, '')
                                updateLine(line.key, 'unitPrice', raw)
                              }}
                              onBlur={() => {
                                // Format on blur
                                const num = parseFloat(line.unitPrice) || 0
                                updateLine(line.key, 'unitPrice', num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                              }}
                              onChange={(e) => updateLine(line.key, 'unitPrice', e.target.value)}
                              className="w-full rounded-md border bg-transparent pl-6 pr-2 py-1.5 text-sm text-white"
                              style={{ borderColor: 'var(--border-muted)' }}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-sm font-medium text-white whitespace-nowrap">
                          ${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={line.notes}
                            onChange={(e) => updateLine(line.key, 'notes', e.target.value)}
                            className="w-full min-w-[80px] rounded-md border bg-transparent px-2 py-1.5 text-sm text-white"
                            style={{ borderColor: 'var(--border-muted)' }}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            className="text-xs rounded px-1.5 py-0.5"
                            style={{ color: 'var(--danger)' }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={items.length > 0 ? 4 : 3} className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Total
                    </td>
                    <td className="px-2 py-2 text-right text-sm font-semibold text-white whitespace-nowrap">
                      ${linesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={fullPage ? () => router.push('/opportunities') : onCancel}
            className="rounded-md border px-4 py-2 text-sm font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: '#7fd0cf', color: '#0f172a' }}
          >
            {saving ? 'Saving...' : 'Create Opportunity'}
          </button>
        </div>
      </form>
    </section>
  )
}
