import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ListOptionsConfig,
  ListPageKey,
  LIST_OPTIONS_DEFAULTS,
  ListValueRow,
  ListValueRowsConfig,
  mergeListConfig,
  sanitizeListValues,
} from '@/lib/list-options'

type ListInputRow = {
  id?: string
  value: string
}

type ListStoreClient = Prisma.TransactionClient | typeof prisma

function getListCode(page: ListPageKey, list: string): string {
  if (page === 'customer' && list === 'industry') return 'CUST-INDUSTRY'
  if (page === 'item' && list === 'type') return 'ITEM-TYPE'
  if (page === 'lead' && list === 'source') return 'LEAD-SRC'
  if (page === 'lead' && list === 'rating') return 'LEAD-RATING'
  if (page === 'lead' && list === 'status') return 'LEAD-STATUS'
  if (page === 'opportunity' && list === 'stage') return 'OPP-STAGE'
  throw new Error(`Unsupported list ${page}.${list}`)
}

function formatListId(code: string, sequence: number): string {
  return `LIST-${code}-${String(sequence).padStart(4, '0')}`
}

function parseListIdSequence(id: string, code: string): number | null {
  const match = id.match(new RegExp(`^LIST-${code}-(\\d{4})$`))
  if (!match) return null
  const sequence = Number.parseInt(match[1], 10)
  return Number.isNaN(sequence) ? null : sequence
}

function getListDefaults(page: ListPageKey, list: string): string[] {
  const pageDefaults = LIST_OPTIONS_DEFAULTS[page] as Record<string, string[]>
  const fallback = pageDefaults[Object.keys(pageDefaults)[0] ?? ''] ?? []
  return pageDefaults[list] ?? fallback
}

function sanitizeListRows(rows: unknown, values: unknown, fallback: string[]): ListInputRow[] {
  if (Array.isArray(rows)) {
    const normalized: ListInputRow[] = []

    rows.forEach((row) => {
      if (!row || typeof row !== 'object') return
      const input = row as { id?: unknown; value?: unknown }
      const value = String(input.value ?? '').trim()
      if (!value) return

      const id = input.id === undefined || input.id === null ? undefined : String(input.id).trim()
      normalized.push({ id: id || undefined, value })
    })

    const deduped: ListInputRow[] = []
    for (const row of normalized) {
      if (!deduped.some((existing) => existing.value === row.value)) {
        deduped.push(row)
      }
    }

    if (deduped.length > 0) return deduped
  }

  return sanitizeListValues(values, fallback).map((value) => ({ value }))
}

function assignListIds(rows: ListInputRow[], currentRows: ListValueRow[], code: string) {
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

async function readListRows(
  client: ListStoreClient,
  page: ListPageKey,
  list: string
): Promise<ListValueRow[]> {
  // Unified ListOption table query
  const code = getListCode(page, list)
  const rows = await client.listOption.findMany({
    where: { key: code },
    orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
  })
  return rows.map((row) => ({ id: row.listId, value: row.value, sortOrder: row.sortOrder }))
}

async function replaceSingleList(
  tx: Prisma.TransactionClient,
  page: ListPageKey,
  list: string,
  values: unknown,
  rows: unknown
) {
  const currentRows = await readListRows(tx, page, list)
  const fallback = getListDefaults(page, list)
  const nextRows = sanitizeListRows(rows, values, fallback)
  const code = getListCode(page, list)
  const data = assignListIds(nextRows, currentRows, code)
  await tx.listOption.deleteMany({ where: { key: code } })
  await tx.listOption.createMany({ data: data.map((row) => ({
    key: code,
    listId: row.id,
    value: row.value,
    label: row.value,
    sortOrder: row.sortOrder,
    createdAt: new Date(),
    updatedAt: new Date(),
  })) })
}

async function ensureDefaults() {
  const defaults = LIST_OPTIONS_DEFAULTS

  // Ensure defaults for unified ListOption table
  const codes = [
    { code: 'CUST-INDUSTRY', values: defaults.customer.industry },
    { code: 'ITEM-TYPE', values: defaults.item.type },
    { code: 'LEAD-SRC', values: defaults.lead.source },
    { code: 'OPP-STAGE', values: defaults.opportunity.stage },
  ]
  for (const { code, values } of codes) {
    const count = await prisma.listOption.count({ where: { key: code } })
    if (count === 0) {
      await prisma.listOption.createMany({
        data: values.map((value, idx) => ({
          key: code,
          listId: formatListId(code, idx + 1),
          value,
          label: value,
          sortOrder: idx,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      })
    }
  }
}

function rowsToConfig(rows: ListValueRowsConfig): ListOptionsConfig {
  return mergeListConfig({
    customer: { industry: rows.customer.industry.map((row) => row.value) },
    item: { type: rows.item.type.map((row) => row.value) },
    lead: {
      source: rows.lead.source.map((row) => row.value),
      rating: rows.lead.rating.map((row) => row.value),
      status: rows.lead.status.map((row) => row.value),
    },
    opportunity: { stage: rows.opportunity.stage.map((row) => row.value) },
  })
}

export async function loadListOptionRows(): Promise<ListValueRowsConfig> {
  await ensureDefaults()

  const [customerIndustry, itemType, leadSource, leadRating, leadStatus, opportunityStage] = await Promise.all([
    readListRows(prisma, 'customer', 'industry'),
    readListRows(prisma, 'item', 'type'),
    readListRows(prisma, 'lead', 'source'),
    readListRows(prisma, 'lead', 'rating'),
    readListRows(prisma, 'lead', 'status'),
    readListRows(prisma, 'opportunity', 'stage'),
  ])

  return {
    customer: { industry: customerIndustry },
    item: { type: itemType },
    lead: { source: leadSource, rating: leadRating, status: leadStatus },
    opportunity: { stage: opportunityStage },
  }
}

export async function loadListOptions(): Promise<ListOptionsConfig> {
  const rows = await loadListOptionRows()
  return rowsToConfig(rows)
}

export async function saveListOptions(nextConfig: unknown): Promise<ListOptionsConfig> {
  const merged = mergeListConfig(nextConfig)

  await prisma.$transaction(async (tx) => {
    await replaceSingleList(tx, 'customer', 'industry', merged.customer.industry, undefined)
    await replaceSingleList(tx, 'item', 'type', merged.item.type, undefined)
    await replaceSingleList(tx, 'lead', 'source', merged.lead.source, undefined)
    await replaceSingleList(tx, 'opportunity', 'stage', merged.opportunity.stage, undefined)
  })

  return merged
}

export async function updateSingleList(
  page: ListPageKey,
  list: string,
  values: unknown,
  rows?: unknown
): Promise<{ config: ListOptionsConfig; rows: ListValueRowsConfig }> {
  const defaults = mergeListConfig({})[page] as Record<string, string[]>

  if (!Object.prototype.hasOwnProperty.call(defaults, list)) {
    const [config, listRows] = await Promise.all([loadListOptions(), loadListOptionRows()])
    return { config, rows: listRows }
  }

  await ensureDefaults()
  await prisma.$transaction(async (tx) => {
    await replaceSingleList(tx, page, list, values, rows)
  })

  const [config, listRows] = await Promise.all([loadListOptions(), loadListOptionRows()])
  return { config, rows: listRows }
}
