import { prisma } from '@/lib/prisma'
import { DEFAULT_ID_SETTINGS } from '@/lib/company-preferences-definitions'
import { formatIdentifier, getNextSequenceFromValues, loadIdSetting } from '@/lib/id-settings'

export function formatJournalNumber(sequence: number, config = DEFAULT_ID_SETTINGS.journal) {
  return formatIdentifier(sequence, config)
}

export function formatIntercompanyJournalNumber(sequence: number, config = DEFAULT_ID_SETTINGS.intercompanyJournal) {
  return formatIdentifier(sequence, config)
}

async function generateNextJournalNumberBySetting(settingKey: 'journal' | 'intercompanyJournal') {
  const config = await loadIdSetting(settingKey)
  const latestEntries = await prisma.journalEntry.findMany({
    where: {
      number: {
        startsWith: config.prefix,
      },
    },
    orderBy: {
      number: 'desc',
    },
    select: {
      number: true,
    },
    take: 200,
  })

  const nextSequence = getNextSequenceFromValues(
    latestEntries.map((entry) => entry.number),
    config,
  )
  return settingKey === 'journal'
    ? formatJournalNumber(nextSequence, config)
    : formatIntercompanyJournalNumber(nextSequence, config)
}

export async function generateNextJournalNumber() {
  return generateNextJournalNumberBySetting('journal')
}

export async function generateNextIntercompanyJournalNumber() {
  return generateNextJournalNumberBySetting('intercompanyJournal')
}
