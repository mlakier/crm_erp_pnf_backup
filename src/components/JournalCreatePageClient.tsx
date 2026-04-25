'use client'

import type { ComponentProps } from 'react'
import JournalEntryDetailClient from '@/components/JournalEntryDetailClient'

export default function JournalCreatePageClient(
  props: ComponentProps<typeof JournalEntryDetailClient>,
) {
  return <JournalEntryDetailClient {...props} />
}
