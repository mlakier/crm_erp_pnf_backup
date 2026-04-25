'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Option = { value: string; label: string }

export default function InvoiceReceiptCreateForm({
  invoices,
  methodOptions,
  formId,
  showInlineActions = true,
  fullPage,
  onSuccess,
  onCreated,
  onCancel,
}: {
  invoices: { id: string; label: string }[]
  methodOptions: Option[]
  formId?: string
  showInlineActions?: boolean
  fullPage?: boolean
  onSuccess?: () => void
  onCreated?: (id: string) => void
  onCancel?: () => void
}) {
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState(methodOptions[0]?.value ?? '')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/invoice-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, amount, date, method, reference: reference || null }),
      })
      const body = await res.json()
      setSaving(false)

      if (!res.ok) {
        setError(body?.error || 'Error creating receipt')
        return
      }

      if (body?.id) {
        onCreated?.(body.id)
        if (fullPage) {
          router.push(`/invoice-receipts/${body.id}`)
          return
        }
      }

      onSuccess?.()
    } catch {
      setSaving(false)
      setError('Error creating receipt')
    }
  }

  const inputStyle = { borderColor: 'var(--border-muted)' }
  const inputClass = 'w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white'

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Invoice
        </label>
        <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className={inputClass} style={inputStyle}>
          {invoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Amount
        </label>
        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} style={inputStyle} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Date
        </label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} style={inputStyle} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Method
        </label>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass} style={inputStyle}>
          {methodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Reference
        </label>
        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} style={inputStyle} />
      </div>
      {error ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
      {showInlineActions ? (
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>
            {saving ? 'Saving...' : 'Create Receipt'}
          </button>
        </div>
      ) : null}
    </form>
  )
}
