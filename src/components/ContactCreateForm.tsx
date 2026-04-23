'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFieldRequired } from '@/lib/form-requirements'
import { isValidEmail } from '@/lib/validation'
import AddressModal, { parseAddress } from '@/components/AddressModal'
import type { SelectOption } from '@/lib/list-source'
import {
  defaultContactFormCustomization,
  CONTACT_FORM_FIELDS,
  type ContactFormCustomizationConfig,
  type ContactFormFieldKey,
} from '@/lib/contact-form-customization'

type ContactFormCustomizationResponse = {
  config?: ContactFormCustomizationConfig
}

export type ContactCreateInitialValues = {
  firstName?: string
  lastName?: string
  email?: string | null
  phone?: string | null
  address?: string | null
  position?: string | null
  customerId?: string | null
  vendorId?: string | null
}

export default function ContactCreateForm({
  userId,
  customers,
  vendors,
  lockedCustomer,
  lockedVendor,
  formId,
  showFooterActions = true,
  redirectBasePath,
  inactiveOptions = [{ value: 'false', label: 'No' }],
  initialLayoutConfig,
  initialRequirements,
  sectionDescriptions,
  initialValues,
  onSuccess,
  onCancel,
}: {
  userId: string
  customers: Array<{ id: string; name: string }>
  vendors: Array<{ id: string; name: string }>
  lockedCustomer?: { id: string; name: string }
  lockedVendor?: { id: string; name: string }
  formId?: string
  showFooterActions?: boolean
  redirectBasePath?: string
  inactiveOptions?: SelectOption[]
  initialLayoutConfig?: ContactFormCustomizationConfig
  initialRequirements?: Record<string, boolean>
  sectionDescriptions?: Record<string, string>
  initialValues?: ContactCreateInitialValues
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [firstName, setFirstName] = useState(initialValues?.firstName ?? '')
  const [lastName, setLastName] = useState(initialValues?.lastName ?? '')
  const [email, setEmail] = useState(initialValues?.email ?? '')
  const [phone, setPhone] = useState(initialValues?.phone ?? '')
  const [address, setAddress] = useState(initialValues?.address ?? '')
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [position, setPosition] = useState(initialValues?.position ?? '')
  const [customerId, setCustomerId] = useState(lockedCustomer?.id ?? initialValues?.customerId ?? '')
  const [vendorId, setVendorId] = useState(lockedVendor?.id ?? initialValues?.vendorId ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(initialRequirements ?? null)
  const [layoutConfig, setLayoutConfig] = useState<ContactFormCustomizationConfig>(() => initialLayoutConfig ?? defaultContactFormCustomization())
  const router = useRouter()

  useEffect(() => {
    if (initialLayoutConfig && initialRequirements) return
    let mounted = true
    async function loadRequirements() {
      try {
        const [requirementsResponse, layoutResponse] = await Promise.all([
          fetch('/api/config/form-requirements', { cache: 'no-store' }),
          fetch('/api/config/contact-form-customization', { cache: 'no-store' }),
        ])
        const requirementsBody = await requirementsResponse.json()
        const layoutBody = (await layoutResponse.json()) as ContactFormCustomizationResponse
        if (!mounted) return
        if (requirementsResponse.ok) setRuntimeRequirements(requirementsBody?.config?.contactCreate ?? null)
        if (layoutResponse.ok && layoutBody.config) setLayoutConfig(layoutBody.config)
      } catch {
        // Keep static defaults when config API is unavailable.
      }
    }
    loadRequirements()
    return () => {
      mounted = false
    }
  }, [initialLayoutConfig, initialRequirements])

  function req(field: string): boolean {
    if (runtimeRequirements && Object.prototype.hasOwnProperty.call(runtimeRequirements, field)) {
      return Boolean(runtimeRequirements[field])
    }
    return isFieldRequired('contactCreate', field)
  }

  function requiredLabel(text: string, required: boolean) {
    if (!required) return <>{text}</>
    return (
      <>
        {text} <span style={{ color: 'var(--danger)' }}>*</span>
      </>
    )
  }

  const groupedVisibleFields = useMemo(() => {
    return layoutConfig.sections
      .map((section) => ({
        section,
        fields: CONTACT_FORM_FIELDS
          .filter((field) => {
            const config = layoutConfig.fields[field.id]
            return config?.visible !== false && config?.section === section
          })
          .sort((a, b) => {
            const left = layoutConfig.fields[a.id]
            const right = layoutConfig.fields[b.id]
            if ((left?.column ?? 1) !== (right?.column ?? 1)) return (left?.column ?? 1) - (right?.column ?? 1)
            return (left?.order ?? 0) - (right?.order ?? 0)
          }),
      }))
      .filter((group) => group.fields.length > 0)
  }, [layoutConfig])

  const formColumns = Math.min(4, Math.max(1, layoutConfig.formColumns || 2))

  function getSectionGridStyle(): React.CSSProperties {
    return { gridTemplateColumns: `repeat(${formColumns}, minmax(0, 1fr))` }
  }

  function getFieldPlacementStyle(fieldId: ContactFormFieldKey): React.CSSProperties {
    const config = layoutConfig.fields[fieldId]
    return {
      gridColumnStart: Math.min(formColumns, Math.max(1, config?.column ?? 1)),
      gridRowStart: Math.max(1, (config?.order ?? 0) + 1),
    }
  }

  function renderField(fieldId: ContactFormFieldKey) {
    switch (fieldId) {
      case 'contactNumber':
        return (
          <FieldInput label={requiredLabel('Contact ID', req('contactNumber'))} helpText="System-generated contact identifier." fieldId="contactNumber">
            <input value="Generated automatically" readOnly disabled className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'firstName':
        return (
          <FieldInput label={requiredLabel('First Name', req('firstName'))} helpText="Contact given name." fieldId="firstName">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required={req('firstName')} className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'lastName':
        return (
          <FieldInput label={requiredLabel('Last Name', req('lastName'))} helpText="Contact family name." fieldId="lastName">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required={req('lastName')} className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'email':
        return (
          <FieldInput label={requiredLabel('Email', req('email'))} helpText="Primary contact email address." fieldId="email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={req('email')} className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'phone':
        return (
          <FieldInput label={requiredLabel('Phone', req('phone'))} helpText="Primary contact phone number." fieldId="phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required={req('phone')} className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'address':
        return (
          <FieldInput label={requiredLabel('Address', req('address'))} helpText="Mailing or business address for the contact." fieldId="address">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAddressModalOpen(true)}
                className="rounded-md border px-3 py-2 text-sm font-medium"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                {address ? 'Edit Address' : 'Enter Address'}
              </button>
              <p className="text-xs" style={{ color: address ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {address ? address : 'No address saved yet'}
              </p>
            </div>
          </FieldInput>
        )
      case 'position':
        return (
          <FieldInput label={requiredLabel('Position', req('position'))} helpText="Job title or role for the contact." fieldId="position">
            <input value={position} onChange={(e) => setPosition(e.target.value)} required={req('position')} className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'customerId':
        if (lockedCustomer) {
          return (
            <FieldInput label={requiredLabel('Customer', req('customerId'))} helpText="Customer account this contact belongs to, when customer-linked." fieldId="customerId" sourceText="Customers">
              <input
                value={lockedCustomer.name}
                readOnly
                disabled
                className={inputClass}
                style={inputStyle}
              />
            </FieldInput>
          )
        }
        return (
          <FieldInput label={requiredLabel('Customer', req('customerId'))} helpText="Customer account this contact belongs to, when customer-linked." fieldId="customerId" sourceText="Customers">
            <select
              value={customerId}
              onChange={(e) => {
                const nextValue = e.target.value
                setCustomerId(nextValue)
                if (nextValue) setVendorId('')
              }}
              required={req('customerId')}
              className={inputClass}
              style={inputStyle}
            >
              <option value="" style={{ backgroundColor: 'var(--card-elevated)', color: 'var(--text-muted)' }}>
                None
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                  {customer.name}
                </option>
              ))}
            </select>
          </FieldInput>
        )
      case 'vendorId':
        if (lockedVendor) {
          return (
            <FieldInput label={requiredLabel('Vendor', req('vendorId'))} helpText="Vendor account this contact belongs to, when vendor-linked." fieldId="vendorId" sourceText="Vendors">
              <input
                value={lockedVendor.name}
                readOnly
                disabled
                className={inputClass}
                style={inputStyle}
              />
            </FieldInput>
          )
        }
        return (
          <FieldInput label={requiredLabel('Vendor', req('vendorId'))} helpText="Vendor account this contact belongs to, when vendor-linked." fieldId="vendorId" sourceText="Vendors">
            <select
              value={vendorId}
              onChange={(e) => {
                const nextValue = e.target.value
                setVendorId(nextValue)
                if (nextValue) setCustomerId('')
              }}
              required={req('vendorId')}
              className={inputClass}
              style={inputStyle}
            >
              <option value="" style={{ backgroundColor: 'var(--card-elevated)', color: 'var(--text-muted)' }}>
                None
              </option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </FieldInput>
        )
      case 'inactive':
        return (
          <FieldInput label={requiredLabel('Inactive', req('inactive'))} helpText="Marks the contact unavailable for new activity while preserving history." fieldId="inactive" sourceText="Active/Inactive">
            <select value="false" disabled className={inputClass} style={inputStyle}>
              {inactiveOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FieldInput>
        )
      default:
        return null
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (email.trim() && !isValidEmail(email)) {
        setError('Please enter a valid email address')
        setSaving(false)
        return
      }

      if (req('customerId') && !customerId) {
        setError('Please select a customer')
        setSaving(false)
        return
      }

      if (req('vendorId') && !vendorId) {
        setError('Please select a vendor')
        setSaving(false)
        return
      }

      if (!customerId && !vendorId) {
        setError('Please select either a customer or a vendor')
        setSaving(false)
        return
      }

      if (customerId && vendorId) {
        setError('A contact can only belong to one account at a time')
        setSaving(false)
        return
      }

      if (req('address') && !address.trim()) {
        setError('Address is required')
        setSaving(false)
        return
      }

      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          address,
          position,
          customerId,
          vendorId,
          userId,
          inactive: false,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body.error || 'Unable to create contact')
        setSaving(false)
        return
      }
      const createdId = String(body?.id ?? '')

      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setAddress('')
      setPosition('')
      setCustomerId('')
      setVendorId('')
      setAddressModalOpen(false)
      setSaving(false)
      if (redirectBasePath && createdId) {
        router.push(`${redirectBasePath}/${createdId}`)
        router.refresh()
        return
      }
      onSuccess?.()
      router.refresh()
    } catch {
      setError('Unable to create contact')
      setSaving(false)
    }
  }

  return (
    <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Contact details</h2>
      </div>

      <form id={formId} onSubmit={handleSubmit}>
        <div className="space-y-6">
          {groupedVisibleFields.map(({ section, fields }, index) => (
            <section
              key={section}
              className={index > 0 ? 'border-t pt-6' : ''}
              style={index > 0 ? { borderColor: 'var(--border-muted)' } : undefined}
            >
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">{section}</h3>
                {sectionDescriptions?.[section] ? (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{sectionDescriptions[section]}</p>
                ) : null}
              </div>
              <div className="grid gap-3" style={getSectionGridStyle()}>
                {fields.map((field) => <div key={field.id} style={getFieldPlacementStyle(field.id)}>{renderField(field.id)}</div>)}
              </div>
            </section>
          ))}
        </div>
        <AddressModal
          open={addressModalOpen}
          onClose={() => setAddressModalOpen(false)}
          onSave={(formatted) => {
            setAddress(formatted)
            setAddressModalOpen(false)
          }}
          initialFields={parseAddress(address)}
          zIndex={130}
        />
        {error ? <p className="mt-4 text-sm" style={{ color: 'var(--danger)' }}>{error}</p> : null}
        {showFooterActions ? (
          <div className="mt-6 flex justify-end gap-3 border-t pt-4" style={{ borderColor: 'var(--border-muted)' }}>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border px-4 py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              {saving ? 'Saving...' : 'Create Contact'}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  )
}

function FieldInput({
  label,
  children,
  helpText,
  fieldId,
  sourceText,
}: {
  label: React.ReactNode
  children: React.ReactNode
  helpText?: string
  fieldId?: string
  sourceText?: string
}) {
  return (
    <label>
      <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        <span>{label}</span>
        {helpText && fieldId ? <FieldTooltip content={buildTooltipContent(helpText, fieldId, sourceText)} /> : null}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  )
}

function buildTooltipContent(helpText: string, fieldId: string, sourceText?: string) {
  const sourceLine = sourceText ? `\nField Source: ${sourceText}` : ''
  return `${helpText}\n\nField ID: ${fieldId}\nField Type: ${sourceText ? 'list' : 'text'}${sourceLine}`
}

function FieldTooltip({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <span className="group relative inline-flex">
      <span
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border text-[10px] font-semibold"
        style={{ borderColor: 'var(--border-muted)', color: 'var(--text-muted)' }}
        aria-label={content}
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-[60] mt-2 hidden w-72 rounded-lg border px-3 py-2 text-left text-xs leading-5 shadow-xl group-hover:block"
        style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
      >
        {lines.map((line, index) => (
          <span key={`${line}-${index}`} className="block whitespace-pre-wrap">
            {line || '\u00A0'}
          </span>
        ))}
      </span>
    </span>
  )
}

const inputClass = 'block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50'
const inputStyle = { borderColor: 'var(--border-muted)' } as const
