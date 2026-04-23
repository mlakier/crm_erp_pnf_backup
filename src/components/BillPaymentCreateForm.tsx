'use client'
import { useState } from 'react'

type Option = { value: string; label: string }

export default function BillPaymentCreateForm({
  bills,
  methodOptions,
  statusOptions,
  onSuccess,
  onCancel,
}: {
  bills: { id: string; label: string }[]
  methodOptions: Option[]
  statusOptions: Option[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [billId, setBillId] = useState(bills[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState(methodOptions[0]?.value ?? '')
  const [status, setStatus] = useState(statusOptions[0]?.value ?? '')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/bill-payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ billId, amount, date, method, status, reference: reference || null, notes: notes || null }) })
    setSaving(false)
    if (res.ok) { onSuccess?.() } else { alert('Error creating bill payment') }
  }

  const inputStyle = { borderColor: 'var(--border-muted)' }
  const inputClass = 'w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white'

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Bill</label><select value={billId} onChange={e => setBillId(e.target.value)} className={inputClass} style={inputStyle}>{bills.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Amount</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} style={inputStyle} required /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} style={inputStyle} required /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Method</label><select value={method} onChange={e => setMethod(e.target.value)} className={inputClass} style={inputStyle}>{methodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Status</label><select value={status} onChange={e => setStatus(e.target.value)} className={inputClass} style={inputStyle}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Reference</label><input type="text" value={reference} onChange={e => setReference(e.target.value)} className={inputClass} style={inputStyle} /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} style={inputStyle} rows={2} /></div>
      <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button><button type="submit" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving…' : 'Create Bill Payment'}</button></div>
    </form>
  )
}
