'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SelectOption = {
  value: string
  label: string
}

export default function LocationCreateForm({
  initialLocationId,
  initialValues,
  parentLocationOptions,
  subsidiaryOptions,
  locationTypeOptions,
  formId,
  showFooterActions = true,
  redirectBasePath,
  onSuccess,
  onCancel,
}: {
  initialLocationId?: string
  initialValues?: {
    locationId?: string
    code?: string
    name?: string
    subsidiaryId?: string | null
    parentLocationId?: string | null
    locationType?: string | null
    makeInventoryAvailable?: boolean
    address?: string | null
    inactive?: boolean
  }
  parentLocationOptions: SelectOption[]
  subsidiaryOptions: SelectOption[]
  locationTypeOptions: SelectOption[]
  formId?: string
  showFooterActions?: boolean
  redirectBasePath?: string
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const router = useRouter()
  const [locationId] = useState(initialValues?.locationId ?? initialLocationId ?? '')
  const [code, setCode] = useState(initialValues?.code ?? '')
  const [name, setName] = useState(initialValues?.name ?? '')
  const [subsidiaryId, setSubsidiaryId] = useState(initialValues?.subsidiaryId ?? '')
  const [parentLocationId, setParentLocationId] = useState(initialValues?.parentLocationId ?? '')
  const [locationType, setLocationType] = useState(initialValues?.locationType ?? '')
  const [makeInventoryAvailable, setMakeInventoryAvailable] = useState(initialValues?.makeInventoryAvailable ?? true)
  const [address, setAddress] = useState(initialValues?.address ?? '')
  const [inactive, setInactive] = useState(initialValues?.inactive ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          code,
          name,
          subsidiaryId,
          parentLocationId,
          locationType,
          makeInventoryAvailable,
          address,
          inactive,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? 'Create failed')
      if (redirectBasePath && body?.id) {
        router.push(`${redirectBasePath}/${body.id}`)
        router.refresh()
        return
      }
      onSuccess?.()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white'
  const inputStyle = { borderColor: 'var(--border-muted)' }

  return (
    <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
    <form id={formId} onSubmit={submitForm} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Location Id</span>
          <input value={locationId || 'Generated automatically'} readOnly disabled className={`${inputClass} opacity-80`} style={inputStyle} />
        </label>
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Code <span style={{ color: 'var(--danger)' }}>*</span></span>
          <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required className={inputClass} style={inputStyle} />
        </label>
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Name <span style={{ color: 'var(--danger)' }}>*</span></span>
          <input value={name} onChange={(event) => setName(event.target.value)} required className={inputClass} style={inputStyle} />
        </label>
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Subsidiary</span>
          <select value={subsidiaryId} onChange={(event) => setSubsidiaryId(event.target.value)} className={inputClass} style={inputStyle}>
            <option value="">None</option>
            {subsidiaryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Parent Location</span>
          <select value={parentLocationId} onChange={(event) => setParentLocationId(event.target.value)} className={inputClass} style={inputStyle}>
            <option value="">None</option>
            {parentLocationOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Location Type</span>
          <select value={locationType} onChange={(event) => setLocationType(event.target.value)} className={inputClass} style={inputStyle}>
            <option value="">None</option>
            {locationTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Inactive</span>
          <select value={inactive ? 'true' : 'false'} onChange={(event) => setInactive(event.target.value === 'true')} className={inputClass} style={inputStyle}>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-white">
        <input type="checkbox" checked={makeInventoryAvailable} onChange={(event) => setMakeInventoryAvailable(event.target.checked)} className="h-4 w-4 rounded" />
        Make Inventory Available
      </label>

      <label className="block">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Address</span>
        <textarea value={address} onChange={(event) => setAddress(event.target.value)} rows={3} className={inputClass} style={inputStyle} />
      </label>

      {error ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}

      {showFooterActions ? <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</button>
        <button type="submit" disabled={saving} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div> : null}
    </form>
    </div>
  )
}
