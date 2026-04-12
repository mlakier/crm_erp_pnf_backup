import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { ListOrderMode, ListPageKey, ListValueRow, sanitizeListOrderMode, sanitizeListValues } from '@/lib/list-options'

type CustomListRecord = {
  id: string
  label: string
  pages: ListPageKey[]
  code: string
  orderMode: ListOrderMode
  rows: ListValueRow[]
}

type CustomListState = {
  lists: CustomListRecord[]
}

type ListInputRow = {
  id?: string
  value: string
}

const CUSTOM_LISTS_FILE = path.join(process.cwd(), 'config', 'custom-lists.json')

function formatListId(code: string, sequence: number): string {
  return `LIST-${code}-${String(sequence).padStart(4, '0')}`
}

function parseListIdSequence(id: string, code: string): number | null {
  const match = id.match(new RegExp(`^LIST-${code}-(\\d{4})$`))
  if (!match) return null
  const sequence = Number.parseInt(match[1], 10)
  return Number.isNaN(sequence) ? null : sequence
}

function sanitizeCode(label: string): string {
  const upper = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return upper || 'CUSTOM'
}

async function ensureStateFile() {
  await fs.mkdir(path.dirname(CUSTOM_LISTS_FILE), { recursive: true })

  try {
    await fs.access(CUSTOM_LISTS_FILE)
  } catch {
    const initial: CustomListState = { lists: [] }
    await fs.writeFile(CUSTOM_LISTS_FILE, JSON.stringify(initial, null, 2), 'utf8')
  }
}

async function readState(): Promise<CustomListState> {
  await ensureStateFile()

  try {
    const raw = await fs.readFile(CUSTOM_LISTS_FILE, 'utf8')
    const parsed = JSON.parse(raw) as { lists?: unknown }

    if (!Array.isArray(parsed.lists)) {
      return { lists: [] }
    }

    const lists = parsed.lists
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const list = entry as {
          id?: unknown
          label?: unknown
          pages?: unknown
          page?: unknown
          code?: unknown
          orderMode?: unknown
          rows?: unknown
        }

        const id = String(list.id ?? '').trim()
        const label = String(list.label ?? '').trim()
        if (!id || !label) return null

        const pagesRaw = Array.isArray(list.pages) ? list.pages : []
        const pages = pagesRaw
          .map((value) => String(value ?? '').trim())
          .filter((value): value is ListPageKey => (
            value === 'customer' || value === 'item' || value === 'lead' || value === 'opportunity'
          ))

        const code = sanitizeCode(String(list.code ?? label))
        const orderMode = sanitizeListOrderMode(list.orderMode, 'table')
        const rows = sanitizeRows(list.rows, [], code)

        return {
          id,
          label,
          pages,
          code,
          orderMode,
          rows,
        } as CustomListRecord
      })
      .filter((entry): entry is CustomListRecord => entry !== null)

    return { lists }
  } catch {
    return { lists: [] }
  }
}

async function writeState(state: CustomListState) {
  await ensureStateFile()
  await fs.writeFile(CUSTOM_LISTS_FILE, JSON.stringify(state, null, 2), 'utf8')
}

function sanitizeRows(rows: unknown, values: unknown, code: string): ListValueRow[] {
  const fallback = sanitizeListValues(values, [])

  const normalizedInput: ListInputRow[] = []

  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      if (!row || typeof row !== 'object') return
      const input = row as { id?: unknown; value?: unknown }
      const value = String(input.value ?? '').trim()
      if (!value) return

      const id = input.id === undefined || input.id === null ? undefined : String(input.id).trim()
      normalizedInput.push({ id: id || undefined, value })
    })
  } else {
    fallback.forEach((value) => {
      normalizedInput.push({ value })
    })
  }

  const deduped: ListInputRow[] = []
  for (const row of normalizedInput) {
    if (!deduped.some((existing) => existing.value === row.value)) {
      deduped.push(row)
    }
  }

  return deduped.map((row, sortOrder) => ({
    id: row.id && parseListIdSequence(row.id, code) !== null ? row.id : formatListId(code, sortOrder + 1),
    value: row.value,
    sortOrder,
  }))
}

function assignIds(rows: ListInputRow[], currentRows: ListValueRow[], code: string): ListValueRow[] {
  const validCurrentSequences = currentRows
    .map((row) => parseListIdSequence(row.id, code))
    .filter((sequence): sequence is number => sequence !== null)

  const validInputSequences = rows
    .map((row) => (row.id ? parseListIdSequence(row.id, code) : null))
    .filter((sequence): sequence is number => sequence !== null)

  let nextSequence = Math.max(0, ...validCurrentSequences, ...validInputSequences) + 1
  const assigned = new Set<number>()

  const currentByValue = new Map<string, ListValueRow>()
  for (const row of currentRows) {
    if (!currentByValue.has(row.value)) {
      currentByValue.set(row.value, row)
    }
  }

  return rows.map((row, sortOrder) => {
    let sequence: number | null = null

    if (row.id) {
      const parsed = parseListIdSequence(row.id, code)
      if (parsed !== null && !assigned.has(parsed)) {
        sequence = parsed
      }
    }

    if (sequence === null) {
      const byValue = currentByValue.get(row.value)
      if (byValue) {
        const parsed = parseListIdSequence(byValue.id, code)
        if (parsed !== null && !assigned.has(parsed)) {
          sequence = parsed
        }
      }
    }

    if (sequence === null) {
      while (assigned.has(nextSequence)) {
        nextSequence += 1
      }
      sequence = nextSequence
      nextSequence += 1
    }

    assigned.add(sequence)

    return {
      id: formatListId(code, sequence),
      value: row.value,
      sortOrder,
    }
  })
}

function toCustomListSummary(list: CustomListRecord) {
  return {
    id: list.id,
    key: `custom:${list.id}`,
    label: list.label,
    pages: list.pages,
    code: list.code,
  }
}

export async function loadCustomListState() {
  const state = await readState()

  const customLists = state.lists.map(toCustomListSummary)
  const customRows: Record<string, ListValueRow[]> = {}
  const customOrderConfig: Record<string, ListOrderMode> = {}

  for (const list of state.lists) {
    customRows[list.id] = [...list.rows].sort((a, b) => a.sortOrder - b.sortOrder)
    customOrderConfig[list.id] = list.orderMode
  }

  return { customLists, customRows, customOrderConfig }
}

export async function createCustomList(input: { label: string }) {
  const label = input.label.trim()
  if (!label) {
    throw new Error('List name is required')
  }

  const state = await readState()
  const alreadyExists = state.lists.some((list) => list.label.toLowerCase() === label.toLowerCase())

  if (alreadyExists) {
    throw new Error('A list with this name already exists')
  }

  const code = sanitizeCode(label)
  const record: CustomListRecord = {
    id: randomUUID(),
    label,
    pages: [],
    code,
    orderMode: 'table',
    rows: [],
  }

  state.lists.push(record)
  await writeState(state)

  return loadCustomListState()
}

export async function updateCustomList(input: {
  id: string
  values: unknown
  rows: unknown
  orderMode: unknown
}) {
  const state = await readState()
  const target = state.lists.find((list) => list.id === input.id)

  if (!target) {
    throw new Error('Custom list not found')
  }

  const normalizedRows: ListInputRow[] = sanitizeRows(input.rows, input.values, target.code).map((row) => ({
    id: row.id,
    value: row.value,
  }))

  target.rows = assignIds(normalizedRows, target.rows, target.code)
  target.orderMode = sanitizeListOrderMode(input.orderMode, target.orderMode)

  await writeState(state)

  return loadCustomListState()
}
