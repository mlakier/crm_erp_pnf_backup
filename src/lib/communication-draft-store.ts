'use client'

import type { TransactionCommunicationComposePayload } from '@/lib/transaction-communications'

export type CommunicationComposeDraft = TransactionCommunicationComposePayload & {
  returnHref: string
}

const COMMUNICATION_DRAFT_PREFIX = 'communication-draft:'

function buildCommunicationDraftKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function saveCommunicationDraft(draft: CommunicationComposeDraft) {
  const key = buildCommunicationDraftKey()
  window.sessionStorage.setItem(`${COMMUNICATION_DRAFT_PREFIX}${key}`, JSON.stringify(draft))
  return key
}

export function loadCommunicationDraft(key: string) {
  const raw = window.sessionStorage.getItem(`${COMMUNICATION_DRAFT_PREFIX}${key}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CommunicationComposeDraft
  } catch {
    return null
  }
}

export function clearCommunicationDraft(key: string) {
  window.sessionStorage.removeItem(`${COMMUNICATION_DRAFT_PREFIX}${key}`)
}
