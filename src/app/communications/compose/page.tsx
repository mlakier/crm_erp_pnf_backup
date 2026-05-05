import { connection } from 'next/server'
import CommunicationComposePageClient from '@/components/CommunicationComposePageClient'

export const runtime = 'nodejs'

export default async function CommunicationComposePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>
}) {
  await connection()
  const { draft } = await searchParams

  return <CommunicationComposePageClient draftKey={draft ?? ''} />
}
