'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import { fmtPhone } from '@/lib/format'
import { isValidEmail } from '@/lib/validation'

type VendorContact = {
  id: string
  contactNumber: string | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  position: string | null
}

type DraftContact = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  position: string
}

function createDraftContact(): DraftContact {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: '',
  }
}

export default function VendorContactsSection({
  vendorId,
  userId,
  contacts,
}: {
  vendorId: string
  userId: string | null
  contacts: VendorContact[]
}) {
  const router = useRouter()
  const [savingDraftId, setSavingDraftId] = useState<string | null>(null)
  const [errorsByDraftId, setErrorsByDraftId] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<DraftContact[]>([])

  function addDraft() {
    setDrafts((previousDrafts) => [...previousDrafts, createDraftContact()])
  }

  function updateDraft(draftId: string, updates: Partial<DraftContact>) {
    setDrafts((previousDrafts) =>
      previousDrafts.map((draft) => (draft.id === draftId ? { ...draft, ...updates } : draft))
    )
  }

  function cancelDraft(draftId: string) {
    setDrafts((previousDrafts) => previousDrafts.filter((draft) => draft.id !== draftId))
    setErrorsByDraftId((previousErrors) => {
      const nextErrors = { ...previousErrors }
      delete nextErrors[draftId]
      return nextErrors
    })
  }

  function setDraftError(draftId: string, error: string) {
    setErrorsByDraftId((previousErrors) => ({ ...previousErrors, [draftId]: error }))
  }

  async function saveDraft(draft: DraftContact) {
    setDraftError(draft.id, '')
    if (!userId) {
      setDraftError(draft.id, 'A user is required to create contacts')
      return
    }
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setDraftError(draft.id, 'First name and last name are required')
      return
    }
    if (draft.email.trim() && !isValidEmail(draft.email)) {
      setDraftError(draft.id, 'Please enter a valid contact email address')
      return
    }

    setSavingDraftId(draft.id)
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          customerId: null,
          vendorId,
          userId,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setDraftError(draft.id, body?.error ?? 'Unable to create contact')
        return
      }
      cancelDraft(draft.id)
      router.refresh()
    } catch {
      setDraftError(draft.id, 'Unable to create contact')
    } finally {
      setSavingDraftId(null)
    }
  }

  const isAdding = drafts.length > 0

  return (
    <RecordDetailSection
      title="Contacts"
      count={contacts.length}
      actions={
        <button
          type="button"
          onClick={addDraft}
          className="rounded-md border px-3 py-1.5 text-sm font-medium"
          style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
        >
          Add Contact
        </button>
      }
    >
      {contacts.length === 0 && !isAdding ? (
        <RecordDetailEmptyState message="No contacts yet" />
      ) : (
        <table className="min-w-full">
          <thead>
            <tr>
              <RecordDetailHeaderCell>Contact #</RecordDetailHeaderCell>
              <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
              <RecordDetailHeaderCell>Email</RecordDetailHeaderCell>
              <RecordDetailHeaderCell>Phone</RecordDetailHeaderCell>
              <RecordDetailHeaderCell>Position</RecordDetailHeaderCell>
              {isAdding ? <RecordDetailHeaderCell>Actions</RecordDetailHeaderCell> : null}
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id} id={`contact-${contact.id}`} tabIndex={-1} className="focus:outline-none transition-shadow">
                <RecordDetailCell>
                  <Link href={`/contacts/${contact.id}`} style={{ color: 'var(--accent-primary-strong)' }} className="hover:underline">
                    {contact.contactNumber ?? 'Pending'}
                  </Link>
                </RecordDetailCell>
                <RecordDetailCell>{contact.firstName} {contact.lastName}</RecordDetailCell>
                <RecordDetailCell>{contact.email ?? '-'}</RecordDetailCell>
                <RecordDetailCell>{fmtPhone(contact.phone)}</RecordDetailCell>
                <RecordDetailCell>{contact.position ?? '-'}</RecordDetailCell>
                {isAdding ? <RecordDetailCell /> : null}
              </tr>
            ))}
            {drafts.map((draft, index) => (
              <tr key={draft.id} style={{ borderTop: contacts.length > 0 || index > 0 ? '1px solid var(--border-muted)' : undefined }}>
                <RecordDetailCell>Pending</RecordDetailCell>
                <RecordDetailCell>
                  <div className="grid min-w-56 grid-cols-2 gap-2">
                    <input
                      value={draft.firstName}
                      onChange={(event) => updateDraft(draft.id, { firstName: event.target.value })}
                      placeholder="First"
                      className={inputClass}
                      style={inputStyle}
                    />
                    <input
                      value={draft.lastName}
                      onChange={(event) => updateDraft(draft.id, { lastName: event.target.value })}
                      placeholder="Last"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                </RecordDetailCell>
                <RecordDetailCell>
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(event) => updateDraft(draft.id, { email: event.target.value })}
                    className={inputClass}
                    style={inputStyle}
                  />
                </RecordDetailCell>
                <RecordDetailCell>
                  <input
                    value={draft.phone}
                    onChange={(event) => updateDraft(draft.id, { phone: event.target.value })}
                    className={inputClass}
                    style={inputStyle}
                  />
                </RecordDetailCell>
                <RecordDetailCell>
                  <input
                    value={draft.position}
                    onChange={(event) => updateDraft(draft.id, { position: event.target.value })}
                    className={inputClass}
                    style={inputStyle}
                  />
                </RecordDetailCell>
                <RecordDetailCell>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveDraft(draft)}
                      disabled={savingDraftId === draft.id}
                      className="rounded-md px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                    >
                      {savingDraftId === draft.id ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelDraft(draft.id)}
                      className="rounded-md border px-2.5 py-1 text-xs"
                      style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </RecordDetailCell>
              </tr>
            ))}
            {Object.entries(errorsByDraftId).map(([draftId, error]) => error ? (
              <tr key={`draft-error-${draftId}`}>
                <td colSpan={6} className="px-4 py-2">
                  <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
                </td>
              </tr>
            ) : null)}
          </tbody>
        </table>
      )}
    </RecordDetailSection>
  )
}

const inputClass = 'block w-full rounded-md border bg-transparent px-2 py-1.5 text-sm text-white'
const inputStyle = { borderColor: 'var(--border-muted)' } as const
