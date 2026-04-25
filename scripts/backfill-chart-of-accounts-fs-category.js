require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const DEFAULT_VALUES = [
  'Cash',
  'Accounts Receivable',
  'Inventory',
  'Prepaids',
  'Other Current Assets',
  'Fixed Assets',
  'Accounts Payable',
  'Accrued Liabilities',
  'Deferred Revenue',
  'Debt',
  'Equity',
  'Revenue',
  'Cost of Sales',
  'Operating Expenses',
  'Depreciation',
  'Interest',
  'FX',
  'Other Income',
  'Other Expense',
]

function inferCategory(account) {
  const parts = [
    account.name,
    account.description,
    account.accountNumber,
    account.accountType,
    account.financialStatementSection,
    account.financialStatementGroup,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!parts) return null

  if (/\bcash\b|bank|checking|savings|comerica|petty cash|santander/.test(parts)) return 'Cash'
  if (/accounts receivable|\bar\b|trade receivable|receivable/.test(parts)) return 'Accounts Receivable'
  if (/inventory|stock|finished goods|raw materials|wip|work in process/.test(parts)) return 'Inventory'
  if (/prepaid|deposit|security deposit|advance payment/.test(parts)) return 'Prepaids'
  if (/fixed asset|property|plant|equipment|ppe|furniture|fixture|computer equipment|leasehold|accumulated depreciation/.test(parts)) return 'Fixed Assets'
  if (/accounts payable|\bap\b|trade payable|payable/.test(parts)) return 'Accounts Payable'
  if (/accrued|payroll liabilities|tax payable|taxes payable/.test(parts)) return 'Accrued Liabilities'
  if (/deferred revenue|unearned revenue|contract liability/.test(parts)) return 'Deferred Revenue'
  if (/debt|loan|note payable|line of credit|credit facility|mortgage/.test(parts)) return 'Debt'
  if (/equity|retained earnings|cta|capital stock|additional paid in capital|apic|owner'?s equity/.test(parts)) return 'Equity'
  if (/cost of sales|cost of goods sold|cogs/.test(parts)) return 'Cost of Sales'
  if (/depreciation|amortization/.test(parts)) return 'Depreciation'
  if (/interest/.test(parts)) return 'Interest'
  if (/foreign exchange|\bfx\b|gain\/loss on exchange|realized gain|unrealized gain/.test(parts)) return 'FX'
  if (/other income|gain on sale|miscellaneous income/.test(parts)) return 'Other Income'
  if (/other expense|miscellaneous expense|loss on sale/.test(parts)) return 'Other Expense'

  if (account.financialStatementGroup) {
    const group = account.financialStatementGroup.toLowerCase()
    if (group.includes('current asset')) return 'Other Current Assets'
    if (group.includes('revenue')) return 'Revenue'
    if (group.includes('operating expense')) return 'Operating Expenses'
  }

  if (account.accountType === 'Revenue') return 'Revenue'
  if (account.accountType === 'Expense') return 'Operating Expenses'
  if (account.accountType === 'Equity') return 'Equity'

  return null
}

async function ensureManagedListRows() {
  const key = 'COA-FS-CATEGORY'
  const count = await prisma.listOption.count({ where: { key } })
  if (count > 0) return

  await prisma.listOption.createMany({
    data: DEFAULT_VALUES.map((value, index) => ({
      key,
      listId: `LIST-${key}-${String(index + 1).padStart(4, '0')}`,
      value,
      label: value,
      sortOrder: index,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    skipDuplicates: true,
  })
}

async function main() {
  await ensureManagedListRows()

  const accounts = await prisma.chartOfAccounts.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      accountNumber: true,
      accountType: true,
      financialStatementSection: true,
      financialStatementGroup: true,
      financialStatementCategory: true,
    },
  })

  let updated = 0
  for (const account of accounts) {
    if (account.financialStatementCategory) continue
    const category = inferCategory(account)
    if (!category) continue

    await prisma.chartOfAccounts.update({
      where: { id: account.id },
      data: { financialStatementCategory: category },
    })
    updated += 1
  }

  console.log(JSON.stringify({ updated }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
