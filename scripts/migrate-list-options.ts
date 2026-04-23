// One-time migration script: Move legacy list option data to ListOption table
// Run with: npx ts-node scripts/migrate-list-options.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type LegacyListRow = {
  value: string
  sortOrder: number | null
  createdAt: Date | null
  updatedAt: Date | null
}

type LegacyListDelegate = {
  findMany(args: { orderBy: Array<Record<string, 'asc'>> }): Promise<LegacyListRow[]>
}

const legacyPrisma = prisma as unknown as Record<string, LegacyListDelegate>

const LIST_MAPPINGS = [
  {
    table: 'customerIndustryOption',
    key: 'CUST-IND',
    page: 'customer',
    list: 'industry',
    code: 'CUST-IND',
  },
  {
    table: 'itemTypeOption',
    key: 'ITEM-TYPE',
    page: 'item',
    list: 'type',
    code: 'ITEM-TYPE',
  },
  {
    table: 'leadSourceOption',
    key: 'LEAD-SRC',
    page: 'lead',
    list: 'source',
    code: 'LEAD-SRC',
  },
  {
    table: 'leadRatingOption',
    key: 'LEAD-RAT',
    page: 'lead',
    list: 'rating',
    code: 'LEAD-RAT',
  },
  {
    table: 'opportunityStageOption',
    key: 'OPP-STAGE',
    page: 'opportunity',
    list: 'stage',
    code: 'OPP-STAGE',
  },
]

function formatListId(code: string, sequence: number) {
  return `LIST-${code}-${String(sequence).padStart(4, '0')}`
}

async function migrate() {
  for (const mapping of LIST_MAPPINGS) {
    const rows = await legacyPrisma[mapping.table].findMany({ orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }] })
    if (!rows.length) continue
    const data = rows.map((row, idx) => ({
      key: mapping.key,
      listId: formatListId(mapping.code, idx + 1),
      value: row.value,
      label: row.value,
      sortOrder: row.sortOrder ?? idx,
      createdAt: row.createdAt ?? new Date(),
      updatedAt: row.updatedAt ?? new Date(),
    }))
    await prisma.listOption.createMany({ data })
    console.log(`Migrated ${rows.length} rows from ${mapping.table} to ListOption`)
  }
}

migrate().then(() => prisma.$disconnect())
