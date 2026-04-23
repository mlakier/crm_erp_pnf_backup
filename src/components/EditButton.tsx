'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { isValidEmail } from '@/lib/validation'
import AddressModal, { parseAddress } from '@/components/AddressModal'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'

export interface EditField {
  name: string
  label: string
  value: string
  type?: 'text' | 'number' | 'date' | 'email' | 'select' | 'checkbox' | 'address'
  multiple?: boolean
  options?: Array<{ value: string; label: string }>
  placeholder?: string
}

export default function EditButton({
  resource,
  endpoint,
  id,
  fields,
}: {
  resource?: string
  endpoint?: string
  id: string
  fields: EditField[]
}) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.value]))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dismissPrompt, setDismissPrompt] = useState('')
  const [addressFieldBeingEdited, setAddressFieldBeingEdited] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const masterDataDetailRoutes: Record<string, string> = {
    'chart-of-accounts': '/chart-of-accounts',
    subsidiaries: '/subsidiaries',
    items: '/items',
    customers: '/customers',
    vendors: '/vendors',
    employees: '/employees',
    departments: '/departments',
    currencies: '/currencies',
    locations: '/locations',
    roles: '/roles',
    contacts: '/contacts',
    users: '/users',
  }

  const detailBasePath = resource ? masterDataDetailRoutes[resource] : undefined
  const useFullPageDetail = Boolean(detailBasePath && pathname === detailBasePath)

  useEffect(() => { setMounted(true) }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    for (const field of fields) {
      const isEmailField = field.type === 'email' || field.name.toLowerCase().includes('email')
      if (!isEmailField) continue

      const value = (values[field.name] ?? '').trim()
      if (value && !isValidEmail(value)) {
        setError(`${field.label} is not a valid email address`)
        setSaving(false)
        return
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    try {
      const updateEndpoint = endpoint ?? (resource ? `/api/${resource}` : null)
      if (!updateEndpoint) {
        setError('Unable to save changes')
        setSaving(false)
        return
      }

      const res = await fetch(`${updateEndpoint}?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        signal: controller.signal,
      })
      if (!res.ok) {
        const raw = await res.text()
        try {
          const body = JSON.parse(raw) as { error?: string }
          setError(body?.error || 'Failed to save')
        } catch {
          setError(raw || 'Failed to save')
        }
        return
      }
      setOpen(false)
      setDismissPrompt('')
      router.refresh()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Save timed out. Please try again.')
        return
      }
      setError('Failed to save')
    } finally {
      clearTimeout(timeout)
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (useFullPageDetail && detailBasePath) {
            router.push(`${detailBasePath}/${id}`)
            return
          }
          setValues(Object.fromEntries(fields.map((f) => [f.name, f.value])))
          setDismissPrompt('')
          setOpen(true)
        }}
        className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
        style={{ backgroundColor: 'var(--accent-primary-strong)' }}
      >
        {useFullPageDetail ? 'Open' : 'Edit'}
      </button>
      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDismissPrompt('Use Save changes to keep updates or Cancel to discard.')
            }
          }}
        >
          <div
            className="relative w-full max-w-md rounded-xl border p-6 shadow-xl"
            style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}
          >
            <h3 className="mb-4 text-base font-semibold text-white">Edit record</h3>
            {dismissPrompt ? <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{dismissPrompt}</p> : null}
            <form onSubmit={handleSubmit} className="space-y-3">
              {fields.map((f) => (
                <div key={f.name}>
                  <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                  {f.type === 'checkbox' ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`field-${f.name}`}
                        checked={values[f.name] === 'true'}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [f.name]: e.target.checked ? 'true' : 'false' }))
                        }
                        className="h-4 w-4 rounded"
                      />
                      <label htmlFor={`field-${f.name}`} className="text-sm text-white">{f.placeholder ?? f.label}</label>
                    </div>
                  ) : f.type === 'address' ? (
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAddressFieldBeingEdited(f.name)}
                        className="rounded-md border px-3 py-2 text-sm font-medium"
                        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                      >
                        {values[f.name] ? 'Edit Address' : 'Enter Address'}
                      </button>
                      <p className="text-xs" style={{ color: values[f.name] ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                        {values[f.name] ? values[f.name] : 'No address saved yet'}
                      </p>
                    </div>
                  ) : f.type === 'select' ? (
                    f.multiple ? (
                      <div className="mt-1">
                        <MultiSelectDropdown
                          value={splitMultiValue(values[f.name] ?? '')}
                          options={f.options ?? []}
                          placeholder={f.placeholder ?? 'Select options'}
                          onChange={(next) =>
                            setValues((prev) => ({
                              ...prev,
                              [f.name]: next.join(','),
                            }))
                          }
                        />
                      </div>
                    ) : (
                      <select
                        value={values[f.name]}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [f.name]: e.target.value,
                          }))
                        }
                        className="mt-1 block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white shadow-sm focus:outline-none"
                        style={{ borderColor: 'var(--border-muted)' }}
                      >
                        <option value="" style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                          {f.placeholder ?? 'Select option'}
                        </option>
                        {(f.options ?? []).map((option) => (
                          <option
                            key={`${f.name}-${option.value}`}
                            value={option.value}
                            style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )
                  ) : (
                    <input
                      type={f.type ?? 'text'}
                      value={values[f.name]}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [f.name]: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-md border bg-transparent px-3 py-1.5 text-sm text-white shadow-sm focus:outline-none"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  )}
                </div>
              ))}
              {error ? <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDismissPrompt('')
                    setOpen(false)
                  }}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
            <AddressModal
              open={addressFieldBeingEdited !== null}
              onClose={() => setAddressFieldBeingEdited(null)}
              onSave={(formattedAddress) => {
                const fieldName = addressFieldBeingEdited
                if (!fieldName) return
                const parsed = parseAddress(formattedAddress)
                setValues((prev) => {
                  const next = { ...prev, [fieldName]: formattedAddress }
                  if (Object.prototype.hasOwnProperty.call(next, 'country')) {
                    next.country = parsed.country
                  }
                  return next
                })
                setAddressFieldBeingEdited(null)
              }}
              initialFields={parseAddress(addressFieldBeingEdited ? values[addressFieldBeingEdited] ?? '' : '')}
              zIndex={130}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

function splitMultiValue(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}
