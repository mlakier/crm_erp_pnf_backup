'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import { RecordDetailSection } from '@/components/RecordDetailPanels'
import {
  clearCommunicationDraft,
  loadCommunicationDraft,
  type CommunicationComposeDraft,
} from '@/lib/communication-draft-store'

export default function CommunicationComposePageClient({
  draftKey,
}: {
  draftKey: string
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<CommunicationComposeDraft | null>(null)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [sending, setSending] = useState(false)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [attachPdf, setAttachPdf] = useState(true)

  useEffect(() => {
    const loadedDraft = loadCommunicationDraft(draftKey)
    if (!loadedDraft) {
      setLoadError('Communication draft could not be loaded. Start again from the record page.')
      return
    }

    setDraft(loadedDraft)
    setTo(loadedDraft.counterpartyEmail ?? '')
    setSubject(`${loadedDraft.documentLabel} ${loadedDraft.number}`)
    setMessage(`Please find ${loadedDraft.documentLabel} ${loadedDraft.number} for ${loadedDraft.counterpartyName}.`)
  }, [draftKey])

  const backHref = draft?.returnHref ?? '/'
  const pageTitle = useMemo(() => (draft ? `Send ${draft.documentLabel}` : 'Compose Communication'), [draft])

  async function handleSendEmail() {
    if (!draft) return
    if (!to.trim() || !subject.trim()) {
      setSubmitError('To and Subject are required.')
      return
    }

    setSending(true)
    setSubmitError('')

    try {
      const response = await fetch(draft.sendEmailEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [draft.recordIdFieldName]: draft.recordId,
          userId: draft.userId ?? null,
          to: to.trim(),
          from: draft.fromEmail ?? '',
          subject: subject.trim(),
          preview: message.trim(),
          attachPdf,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setSubmitError(body?.error || 'Unable to send communication.')
        return
      }

      clearCommunicationDraft(draftKey)
      router.push(draft.returnHref)
      router.refresh()
    } catch {
      setSubmitError('Unable to send communication.')
    } finally {
      setSending(false)
    }
  }

  return (
    <RecordDetailPageShell
      backHref={backHref}
      backLabel="<- Back to Record"
      meta={draft?.number ?? 'Communication Draft'}
      title={pageTitle}
      badge={
        draft ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {draft.counterpartyName}
          </p>
        ) : null
      }
    >
      <RecordDetailSection title="Compose Email" count={draft ? 1 : 0} summary={draft?.documentLabel}>
        {loadError ? (
          <div className="px-6 py-5">
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {loadError}
            </p>
            <div className="mt-4">
              <Link
                href={backHref}
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                Return
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5 px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  To
                </span>
                <input
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Subject
                </span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Message
                </span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={10}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white"
                  style={{ borderColor: 'var(--border-muted)' }}
                />
              </label>
            </div>

            <label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={attachPdf}
                onChange={(event) => setAttachPdf(event.target.checked)}
              />
              Attach PDF
            </label>

            {submitError ? (
              <p className="text-sm" style={{ color: 'var(--danger)' }}>
                {submitError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={backHref}
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sending || !draft}
                className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                {sending ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        )}
      </RecordDetailSection>
    </RecordDetailPageShell>
  )
}
