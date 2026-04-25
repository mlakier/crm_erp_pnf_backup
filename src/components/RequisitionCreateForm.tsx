'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type Vendor = { id: string; name: string }
type Department = { id: string; name: string; departmentId: string }
type Subsidiary = { id: string; subsidiaryId: string; name: string }
type Currency = { id: string; currencyId: string; code?: string; name: string }

export default function RequisitionCreateForm({
  userId,
  vendors,
  departments,
  entities,
  currencies,
  formId,
  fullPage,
  showFooterActions = true,
  redirectBasePath,
  onSuccess,
  onCancel,
}: {
  userId: string
  vendors: Vendor[]
  departments: Department[]
  entities: Subsidiary[]
  currencies: Currency[]
  formId?: string
  fullPage?: boolean
  showFooterActions?: boolean
  redirectBasePath?: string
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
  const [subsidiaryId, setSubsidiaryId] = useState('')
  const [currencyId, setCurrencyId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)

    try {
      const response = await fetch('/api/purchase-requisitions', {
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
          subsidiaryId: subsidiaryId || null,
          currencyId: currencyId || null,
          userId,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body.error || 'Unable to create requisition')
        setSaving(false)
        return
      }

      if ((fullPage || redirectBasePath) && body?.id) {
        router.push(`${redirectBasePath ?? '/purchase-requisitions'}/${body.id}`)
        router.refresh()
        return
      }

      router.refresh()
      onSuccess?.()
    } catch {
      setError('Unable to create requisition')
      setSaving(false)
    }
  }

  const inputClassName =
    'mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white focus:outline-none'
  const labelClassName = 'block text-sm font-medium'

  return (
    <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Requisition number is generated automatically.
      </p>

      <div>
        <label className={labelClassName} style={{ color: 'var(--text-secondary)' }}>
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Brief description of what is needed"
          className={inputClassName}
          style={{ borderColor: 'var(--border-muted)' }}
        />
      </div>

      <div>
        <label className={labelClassName} style={{ color: 'var(--text-secondary)' }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className={inputClassName}
          style={{ borderColor: 'var(--border-muted)', resize: 'vertical' }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName} style={{ color: 'var(--text-secondary)' }}>
            Priority
          </label>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className={inputClassName}
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="low" style={{ backgroundColor: 'var(--card-elevated)' }}>
              Low
            </option>
            <option value="medium" style={{ backgroundColor: 'var(--card-elevated)' }}>
              Medium
            </option>
            <option value="high" style={{ backgroundColor: 'var(--card-elevated)' }}>
              High
            </option>
            <option value="urgent" style={{ backgroundColor: 'var(--card-elevated)' }}>
              Urgent
            </option>
          </select>
        </div>
        <div>
          <label className={labelClassName} style={{ color: 'var(--text-secondary)' }}>
            Needed by date
          </label>
          <input
            type="date"
            value={neededByDate}
            onChange={(event) => setNeededByDate(event.target.value)}
            className={inputClassName}
            style={{ borderColor: 'var(--border-muted)' }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName} style={{ color: 'var(--text-secondary)' }}>
            Department
          </label>
          <select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            className={inputClassName}
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>
              - Select department -
            </option>
            {departments.map((department) => (
              <option
                key={department.id}
                value={department.id}
                style={{ backgroundColor: 'var(--card-elevated)' }}
              >
                {department.departmentId} - {department.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClassName} style={{ color: 'var(--text-secondary)' }}>
            Preferred vendor
          </label>
          <select
            value={vendorId}
            onChange={(event) => setVendorId(event.target.value)}
            className={inputClassName}
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>
              - Select vendor -
            </option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName} style={{ color: 'var(--text-secondary)' }}>
            Subsidiary
          </label>
          <select
            value={subsidiaryId}
            onChange={(event) => setSubsidiaryId(event.target.value)}
            className={inputClassName}
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>
              - Select subsidiary -
            </option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                {entity.subsidiaryId} - {entity.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClassName} style={{ color: 'var(--text-secondary)' }}>
            Currency
          </label>
          <select
            value={currencyId}
            onChange={(event) => setCurrencyId(event.target.value)}
            className={inputClassName}
            style={{ borderColor: 'var(--border-muted)' }}
          >
            <option value="" style={{ backgroundColor: 'var(--card-elevated)' }}>
              - Select currency -
            </option>
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.id} style={{ backgroundColor: 'var(--card-elevated)' }}>
                {currency.code ?? currency.currencyId} - {currency.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClassName} style={{ color: 'var(--text-secondary)' }}>
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className={inputClassName}
          style={{ borderColor: 'var(--border-muted)', resize: 'vertical' }}
        />
      </div>

      {error ? (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}

      {showFooterActions ? (
        <div className="flex justify-end gap-2 pt-2">
          {fullPage ? (
            <button
              type="button"
              onClick={() => router.push('/purchase-requisitions')}
              className="rounded-md border px-3 py-1.5 text-sm font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border px-3 py-1.5 text-sm font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            {saving ? 'Creating...' : 'Create requisition'}
          </button>
        </div>
      ) : null}
    </form>
  )
}
