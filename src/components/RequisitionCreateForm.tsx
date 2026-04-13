'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type Vendor = { id: string; name: string }
type Department = { id: string; name: string; code: string }
type Entity = { id: string; code: string; name: string }
type Currency = { id: string; code: string; name: string }

export default function RequisitionCreateForm({
  userId,
  vendors,
  departments,
  entities,
  currencies,
  onSuccess,
  onCancel,
}: {
  userId: string
  vendors: Vendor[]
  departments: Department[]
  entities: Entity[]
  currencies: Currency[]
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [neededByDate, setNeededByDate] = useState('')
  const [notes, setNotes] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [entityId, setEntityId] = useState('')
  const [currencyId, setCurrencyId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await fetch('/api/purchase-requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || null,
          description: description || null,
          priority,
          neededByDate: neededByDate || null,
          notes: notes || null,
          vendorId: vendorId || null,
          departmentId: departmentId || null,
          entityId: entityId || null,
          currencyId: currencyId || null,
          userId,
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'Unable to create requisition')
        setSaving(false)
        return
      }

      router.refresh()
      onSuccess?.()
    } catch {
      setError('Unable to create requisition')
      setSaving(false)
    }
  }

  const inputCls = 'mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white focus:outline-none'
  const labelCls = 'block text-sm font-medium'

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Requisition number is generated automatically.
      </p>

      <div>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief description of what is needed"
          className={inputCls}
          style={{ borderColor: 'var(--border-muted)' }}
        />
      </div>

      <div>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={inputCls}
          style={{ borderColor: 'var(--border-muted)', resize: 'vertical' }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={inputCls}
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="low" style={{ backgroundColor: 'var(--card-elevated)' }}>Low</option>
            <option value="medium" style={{ backgroundColor: 'var(--card-elevated)' }}>Medium</option>
            <option value="high" style={{ backgroundColor: 'var(--card-elevated)' }}>High</option>
            <option value="urgent" style={{ backgroundColor: 'var(--card-elevated)' }}>Urgent</option>
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Needed by date</label>
          <input
            type="date"
            value={neededByDate}
            onChange={(e) => setNeededByDate(e.target.value)}
            className={inputCls}
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Department</label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className={inputCls}
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>— Select department —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                {d.code} – {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Preferred vendor</label>
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className={inputCls}
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>— Select vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Subsidiary</label>
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className={inputCls}
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>— Select subsidiary —</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                {e.code} – {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Currency</label>
          <select
            value={currencyId}
            onChange={(e) => setCurrencyId(e.target.value)}
            className={inputCls}
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>— Select currency —</option>
            {currencies.map((c) => (
              <option key={c.id} value={c.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                {c.code} – {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={inputCls}
          style={{ borderColor: 'var(--border-muted)', resize: 'vertical' }}
        />
      </div>

      {error ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-3 py-1.5 text-sm font-medium"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          {saving ? 'Creating…' : 'Create requisition'}
        </button>
      </div>
    </form>
  )
}
