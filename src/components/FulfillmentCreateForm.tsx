'use client'
import { useState } from 'react'

type Option = { value: string; label: string }

export default function FulfillmentCreateForm({
  salesOrders,
  statusOptions,
  onSuccess,
  onCancel,
}: {
  salesOrders: { id: string; label: string }[]
  statusOptions: Option[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [salesOrderId, setSalesOrderId] = useState(salesOrders[0]?.id ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState(statusOptions[0]?.value ?? '')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/fulfillments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ salesOrderId, date: new Date(date), status, notes: notes || null }) })
    setSaving(false)
    if (res.ok) { onSuccess?.() } else { alert('Error creating fulfillment') }
  }

  const inputStyle = { borderColor: 'var(--border-muted)' }
  const inputClass = 'w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white'

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Sales Order</label><select value={salesOrderId} onChange={e => setSalesOrderId(e.target.value)} className={inputClass} style={inputStyle}>{salesOrders.map(so => <option key={so.id} value={so.id}>{so.label}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} style={inputStyle} /></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Status</label><select value={status} onChange={e => setStatus(e.target.value)} className={inputClass} style={inputStyle}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} style={inputStyle} rows={2} /></div>
      <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button><button type="submit" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>{saving ? 'Saving…' : 'Create Fulfillment'}</button></div>
    </form>
  )
}
