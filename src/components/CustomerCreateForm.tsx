'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isFieldRequired } from '@/lib/form-requirements'
import { isValidEmail } from '@/lib/validation'
import AddressModal, { parseAddress } from '@/components/AddressModal'
import type { SelectOption } from '@/lib/list-source'
import {
  defaultCustomerFormCustomization,
  CUSTOMER_FORM_FIELDS,
  type CustomerFormCustomizationConfig,
  type CustomerFormFieldKey,
} from '@/lib/customer-form-customization'

type CustomerFormCustomizationResponse = {
  config?: CustomerFormCustomizationConfig
}

export type CustomerCreateInitialValues = {
  name?: string
  email?: string | null
  phone?: string | null
  address?: string | null
  industry?: string | null
  primarySubsidiaryId?: string | null
  primaryCurrencyId?: string | null
}

type DraftCustomerContact = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  position: string
  isPrimaryForCustomer: boolean
  receivesQuotesSalesOrders: boolean
  receivesInvoices: boolean
  receivesInvoiceCc: boolean
}

function createDraftContact(index = 0): DraftCustomerContact {
  return {
    id: `contact-${Date.now()}-${index}`,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: '',
    isPrimaryForCustomer: index === 0,
    receivesQuotesSalesOrders: false,
    receivesInvoices: false,
    receivesInvoiceCc: false,
  }
}

export default function CustomerCreateForm({
  ownerUserId,
  subsidiaries,
  currencies,
  industryOptions,
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
  ownerUserId: string
  subsidiaries: Array<{ id: string; subsidiaryId: string; name: string }>
  currencies: Array<{ id: string; currencyId: string; code?: string; name: string }>
  industryOptions: SelectOption[]
  formId?: string
  showFooterActions?: boolean
  redirectBasePath?: string
  inactiveOptions?: SelectOption[]
  initialLayoutConfig?: CustomerFormCustomizationConfig
  initialRequirements?: Record<string, boolean>
  sectionDescriptions?: Record<string, string>
  initialValues?: CustomerCreateInitialValues
  onSuccess?: () => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [email, setEmail] = useState(initialValues?.email ?? '')
  const [phone, setPhone] = useState(initialValues?.phone ?? '')
  const [address, setAddress] = useState(initialValues?.address ?? '')
  const [industry, setIndustry] = useState(initialValues?.industry ?? '')
  const [primarySubsidiaryId, setPrimarySubsidiaryId] = useState(initialValues?.primarySubsidiaryId ?? '')
  const [primaryCurrencyId, setPrimaryCurrencyId] = useState(initialValues?.primaryCurrencyId ?? '')
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [contacts, setContacts] = useState<DraftCustomerContact[]>(() => [createDraftContact(0)])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [runtimeRequirements, setRuntimeRequirements] = useState<Record<string, boolean> | null>(initialRequirements ?? null)
  const [layoutConfig, setLayoutConfig] = useState<CustomerFormCustomizationConfig>(() => initialLayoutConfig ?? defaultCustomerFormCustomization())
  const router = useRouter()

  useEffect(() => {
    if (initialLayoutConfig && initialRequirements) return
    let mounted = true
    async function loadRequirements() {
      try {
        const [requirementsResponse, layoutResponse] = await Promise.all([
          fetch('/api/config/form-requirements', { cache: 'no-store' }),
          fetch('/api/config/customer-form-customization', { cache: 'no-store' }),
        ])
        const requirementsBody = await requirementsResponse.json()
        const layoutBody = (await layoutResponse.json()) as CustomerFormCustomizationResponse
        if (!mounted) return
        if (requirementsResponse.ok) setRuntimeRequirements(requirementsBody?.config?.customerCreate ?? null)
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
    return isFieldRequired('customerCreate', field)
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
        fields: CUSTOMER_FORM_FIELDS
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

  function getFieldPlacementStyle(fieldId: CustomerFormFieldKey): React.CSSProperties {
    const config = layoutConfig.fields[fieldId]
    return {
      gridColumnStart: Math.min(formColumns, Math.max(1, config?.column ?? 1)),
      gridRowStart: Math.max(1, (config?.order ?? 0) + 1),
    }
  }

  function renderField(fieldId: CustomerFormFieldKey) {
    switch (fieldId) {
      case 'customerId':
        return (
          <FieldInput label={requiredLabel('Customer ID', req('customerId'))} helpText="System-generated customer identifier." fieldId="customerId">
            <input value="Generated automatically" readOnly disabled className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'name':
        return (
          <FieldInput label={requiredLabel('Name', req('name'))} helpText="Primary customer or account name." fieldId="name">
            <input value={name} onChange={(e) => setName(e.target.value)} required={req('name')} className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'email':
        return (
          <FieldInput label={requiredLabel('Email', req('email'))} helpText="Primary customer email address." fieldId="email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={req('email')} className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'phone':
        return (
          <FieldInput label={requiredLabel('Phone', req('phone'))} helpText="Primary customer phone number." fieldId="phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required={req('phone')} className={inputClass} style={inputStyle} />
          </FieldInput>
        )
      case 'address':
        return (
          <FieldInput label={requiredLabel('Billing Address', req('address'))} helpText="Main billing address for the customer." fieldId="address">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAddressModalOpen(true)}
                className="rounded-md border px-3 py-2 text-sm font-medium"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                {address ? 'Edit Address' : 'Enter Address'}
              </button>
              <p className="text-xs" style={{ color: address ? 'var(--text-secondary)' : 'var(--danger)' }}>
                {address ? address : 'No validated address saved yet'}
              </p>
            </div>
          </FieldInput>
        )
      case 'industry':
        return (
          <FieldInput label={requiredLabel('Industry', req('industry'))} helpText="Customer industry or segment classification." fieldId="industry" sourceText="Customer Industry">
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} required={req('industry')} className={inputClass} style={inputStyle}>
              <option value="">None</option>
              {industryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </FieldInput>
        )
      case 'primarySubsidiaryId':
        return (
          <FieldInput label={requiredLabel('Primary Subsidiary', req('primarySubsidiaryId'))} helpText="Default subsidiary context for this customer." fieldId="primarySubsidiaryId" sourceText="Subsidiaries">
            <select value={primarySubsidiaryId} onChange={(e) => setPrimarySubsidiaryId(e.target.value)} required={req('primarySubsidiaryId')} className={inputClass} style={inputStyle}>
              <option value="" style={{ backgroundColor: 'var(--card-elevated)', color: 'var(--text-muted)' }}>None</option>
              {subsidiaries.map((subsidiary) => (
                <option key={subsidiary.id} value={subsidiary.id} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                  {subsidiary.subsidiaryId} - {subsidiary.name}
                </option>
              ))}
            </select>
          </FieldInput>
        )
      case 'primaryCurrencyId':
        return (
          <FieldInput label={requiredLabel('Primary Currency', req('primaryCurrencyId'))} helpText="Default transaction currency for this customer." fieldId="primaryCurrencyId" sourceText="Currencies">
            <select value={primaryCurrencyId} onChange={(e) => setPrimaryCurrencyId(e.target.value)} required={req('primaryCurrencyId')} className={inputClass} style={inputStyle}>
              <option value="" style={{ backgroundColor: 'var(--card-elevated)', color: 'var(--text-muted)' }}>None</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id} style={{ backgroundColor: 'var(--card-elevated)', color: '#ffffff' }}>
                  {currency.code ?? currency.currencyId} - {currency.name}
                </option>
              ))}
            </select>
          </FieldInput>
        )
      case 'inactive':
        return (
          <FieldInput label={requiredLabel('Inactive', req('inactive'))} helpText="Marks the customer unavailable for new activity while preserving history." fieldId="inactive" sourceText="Active/Inactive">
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

  function updateContact(contactId: string, updates: Partial<DraftCustomerContact>) {
    setContacts((previousContacts) =>
      previousContacts.map((contact) => {
        if (contact.id !== contactId) return contact
        return { ...contact, ...updates }
      })
    )
  }

  function setPrimaryContact(contactId: string) {
    setContacts((previousContacts) =>
      previousContacts.map((contact) => ({
        ...contact,
        isPrimaryForCustomer: contact.id === contactId,
      }))
    )
  }

  function addContact() {
    setContacts((previousContacts) => [...previousContacts, createDraftContact(previousContacts.length)])
  }

  function removeContact(contactId: string) {
    setContacts((previousContacts) => {
      if (previousContacts.length <= 1) return previousContacts
      const nextContacts = previousContacts.filter((contact) => contact.id !== contactId)
      if (!nextContacts.some((contact) => contact.isPrimaryForCustomer)) {
        nextContacts[0] = { ...nextContacts[0], isPrimaryForCustomer: true }
      }
      return nextContacts
    })
  }

  function getSubmittableContacts() {
    const submittableContacts = contacts.filter((contact) =>
      contact.firstName.trim() ||
      contact.lastName.trim() ||
      contact.email.trim() ||
      contact.phone.trim() ||
      contact.position.trim()
    )

    if (submittableContacts.length > 0 && !submittableContacts.some((contact) => contact.isPrimaryForCustomer)) {
      return submittableContacts.map((contact, index) => ({
        ...contact,
        isPrimaryForCustomer: index === 0,
      }))
    }

    return submittableContacts
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (email.trim() && !isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    const submittableContacts = getSubmittableContacts()
    const invalidContactEmail = submittableContacts.find((contact) => contact.email.trim() && !isValidEmail(contact.email))
    if (invalidContactEmail) {
      setError('Please enter a valid contact email address')
      return
    }

    if (req('address') && !address.trim()) {
      setError('Address is required. Click Address and save a validated address.')
      return
    }

    if (req('primaryContact') && submittableContacts.length < 1) {
      setError('At least one contact is required')
      return
    }

    const primaryContact = submittableContacts.find((contact) => contact.isPrimaryForCustomer) ?? submittableContacts[0]
    if (req('primaryContact') && req('contactFirstName') && !primaryContact?.firstName.trim()) {
      setError('Primary contact first name is required')
      return
    }

    if (req('primaryContact') && req('contactLastName') && !primaryContact?.lastName.trim()) {
      setError('Primary contact last name is required')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          address,
          industry,
          primarySubsidiaryId,
          primaryCurrencyId,
          inactive: false,
          userId: ownerUserId,
          contacts: submittableContacts.map((contact) => ({
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            position: contact.position,
            isPrimaryForCustomer: contact.isPrimaryForCustomer,
            receivesQuotesSalesOrders: contact.receivesQuotesSalesOrders,
            receivesInvoices: contact.receivesInvoices,
            receivesInvoiceCc: contact.receivesInvoiceCc,
          })),
        }),
      })

      const body = await response.json()

      if (!response.ok) {
        setError(body.error || 'Unable to create customer')
        setSaving(false)
        return
      }
      const createdId = String(body?.id ?? '')

      setName('')
      setEmail('')
      setPhone('')
      setAddress('')
      setIndustry('')
      setPrimarySubsidiaryId('')
      setPrimaryCurrencyId('')
      setContacts([createDraftContact(0)])
      setSaving(false)
      if (redirectBasePath && createdId) {
        router.push(`${redirectBasePath}/${createdId}`)
        router.refresh()
        return
      }
      onSuccess?.()
      router.refresh()
    } catch {
      setError('Unable to create customer')
      setSaving(false)
    }
  }

  return (
    <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Customer details</h2>
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

          <section className="border-t pt-6" style={{ borderColor: 'var(--border-muted)' }}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
              <h3 className="text-sm font-semibold text-white">Primary Contact</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                {req('primaryContact') ? 'At least one contact is required. Choose one primary contact for customer-level routing.' : 'Add one or more contacts and choose one primary contact for customer-level routing.'}
              </p>
              </div>
              <button
                type="button"
                onClick={addContact}
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                Add Contact
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-muted)' }}>
              <table className="min-w-[1120px] w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <ContactHeaderCell>Primary</ContactHeaderCell>
                    <ContactHeaderCell>{requiredLabel('First Name', req('contactFirstName'))}</ContactHeaderCell>
                    <ContactHeaderCell>{requiredLabel('Last Name', req('contactLastName'))}</ContactHeaderCell>
                    <ContactHeaderCell>Email</ContactHeaderCell>
                    <ContactHeaderCell>Phone</ContactHeaderCell>
                    <ContactHeaderCell>Position</ContactHeaderCell>
                    <ContactHeaderCell>Quote/SO</ContactHeaderCell>
                    <ContactHeaderCell>Invoice</ContactHeaderCell>
                    <ContactHeaderCell>Invoice CC</ContactHeaderCell>
                    <ContactHeaderCell>Actions</ContactHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact, index) => (
                    <tr key={contact.id} style={index < contacts.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}>
                      <ContactBodyCell className="text-center">
                        <input
                          type="radio"
                          name="primaryCustomerContact"
                          checked={contact.isPrimaryForCustomer}
                          onChange={() => setPrimaryContact(contact.id)}
                          className="h-4 w-4"
                          aria-label={`Make contact ${index + 1} primary`}
                        />
                      </ContactBodyCell>
                      <ContactBodyCell>
                        <input
                          value={contact.firstName}
                          onChange={(e) => updateContact(contact.id, { firstName: e.target.value })}
                          required={req('contactFirstName') && contact.isPrimaryForCustomer}
                          className={tableInputClass}
                          style={inputStyle}
                        />
                      </ContactBodyCell>
                      <ContactBodyCell>
                        <input
                          value={contact.lastName}
                          onChange={(e) => updateContact(contact.id, { lastName: e.target.value })}
                          required={req('contactLastName') && contact.isPrimaryForCustomer}
                          className={tableInputClass}
                          style={inputStyle}
                        />
                      </ContactBodyCell>
                      <ContactBodyCell>
                        <input
                          type="email"
                          value={contact.email}
                          onChange={(e) => updateContact(contact.id, { email: e.target.value })}
                          className={tableInputClass}
                          style={inputStyle}
                        />
                      </ContactBodyCell>
                      <ContactBodyCell>
                        <input
                          value={contact.phone}
                          onChange={(e) => updateContact(contact.id, { phone: e.target.value })}
                          className={tableInputClass}
                          style={inputStyle}
                        />
                      </ContactBodyCell>
                      <ContactBodyCell>
                        <input
                          value={contact.position}
                          onChange={(e) => updateContact(contact.id, { position: e.target.value })}
                          className={tableInputClass}
                          style={inputStyle}
                        />
                      </ContactBodyCell>
                      <ContactBodyCell className="text-center">
                        <input
                          type="checkbox"
                          checked={contact.receivesQuotesSalesOrders}
                          onChange={(e) => updateContact(contact.id, { receivesQuotesSalesOrders: e.target.checked })}
                          className="h-4 w-4"
                          aria-label={`Contact ${index + 1} receives quotes and sales orders`}
                        />
                      </ContactBodyCell>
                      <ContactBodyCell className="text-center">
                        <input
                          type="checkbox"
                          checked={contact.receivesInvoices}
                          onChange={(e) => updateContact(contact.id, { receivesInvoices: e.target.checked })}
                          className="h-4 w-4"
                          aria-label={`Contact ${index + 1} receives invoices`}
                        />
                      </ContactBodyCell>
                      <ContactBodyCell className="text-center">
                        <input
                          type="checkbox"
                          checked={contact.receivesInvoiceCc}
                          onChange={(e) => updateContact(contact.id, { receivesInvoiceCc: e.target.checked })}
                          className="h-4 w-4"
                          aria-label={`Contact ${index + 1} receives invoice copies`}
                        />
                      </ContactBodyCell>
                      <ContactBodyCell>
                        <button
                          type="button"
                          onClick={() => removeContact(contact.id)}
                          disabled={contacts.length <= 1}
                          className="rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                        >
                          Remove
                        </button>
                      </ContactBodyCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
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
              {saving ? 'Saving...' : 'Create Customer'}
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

function ContactHeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
      {children}
    </th>
  )
}

function ContactBodyCell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-2 align-middle ${className}`.trim()} style={{ color: 'var(--text-secondary)' }}>
      {children}
    </td>
  )
}

const inputClass = 'block w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50'
const tableInputClass = 'block w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white'
const inputStyle = { borderColor: 'var(--border-muted)' } as const
