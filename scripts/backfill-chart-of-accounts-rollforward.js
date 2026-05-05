const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

function includesAny(value, patterns) {
  return patterns.some((pattern) => value.includes(pattern))
}

function deriveRollforwardCategory(account) {
  const accountId = normalize(account.accountId || account.accountNumber)
  const name = normalize(account.name)
  const parentAccountId = normalize(account.parentAccount?.accountId || account.parentAccount?.accountNumber)
  const parentName = normalize(account.parentAccount?.name)
  const combinedName = [name, parentName].filter(Boolean).join(' ')
  const accountType = normalize(account.accountType)
  const category = normalize(account.category)
  const parentCategory = normalize(account.parentAccount?.category)
  const combinedCategory = [category, parentCategory].filter(Boolean).join(' ')
  const fsCategory = normalize(account.financialStatementCategory)

  if (includesAny(combinedName, ['intercompany']) || includesAny(category, ['intercompany'])) return 'Intercompany'
  if (includesAny(combinedName, ['fx revaluation', 'foreign exchange revaluation', 'unrealized fx']) || includesAny(category, ['fx']) || includesAny(fsCategory, ['fx'])) return 'FX Revaluation'
  if (includesAny(combinedName, ['accounts receivable', 'a/r']) || accountId === '1100' || parentAccountId === '1100' || includesAny(fsCategory, ['accounts receivable'])) return 'Accounts Receivable'
  if (
    accountType === 'asset'
    && (
      ['1000', '1010'].includes(accountId)
      || ['1000', '1010'].includes(parentAccountId)
      || includesAny(combinedCategory, ['bank'])
      || includesAny(combinedName, ['bank', 'checking'])
      || (includesAny(combinedName, ['cash']) && !includesAny(combinedCategory, ['accounts receivable']))
      || includesAny(fsCategory, ['cash'])
    )
  ) return 'Cash and Cash Equivalents'
  if (includesAny(combinedName, ['inventory']) || includesAny(fsCategory, ['inventory'])) return 'Inventory'
  if (
    accountType === 'asset'
    && (
      includesAny(combinedName, ['accrued revenue', 'unbilled receivable', 'contract asset'])
      || includesAny(fsCategory, ['contract assets'])
    )
  ) return 'Other Assets'
  if (includesAny(combinedName, ['prepaid', 'deferred cost']) || (includesAny(category, ['current asset']) && includesAny(fsCategory, ['prepaids']))) return 'Prepaids and Other Current Assets'
  if (includesAny(combinedName, ['fixed asset', 'property', 'equipment']) || includesAny(category, ['fixed asset']) || includesAny(fsCategory, ['fixed assets'])) return 'Fixed Assets'
  if (includesAny(combinedName, ['accumulated depreciation', 'accumulated amortization']) || includesAny(category, ['contra asset']) || accountId === '1310') return 'Accumulated Depreciation and Amortization'
  if (includesAny(combinedName, ['accounts payable', 'a/p']) || accountId === '2000' || parentAccountId === '2000' || includesAny(fsCategory, ['accounts payable'])) return 'Accounts Payable'
  if (includesAny(combinedName, ['accrued']) || accountId === '2100' || includesAny(fsCategory, ['accrued'])) return 'Accrued Expenses'
  if (includesAny(combinedName, ['deferred revenue', 'customer deposit']) || ['2200', '2210'].includes(accountId) || includesAny(fsCategory, ['deferred revenue'])) return 'Deferred Revenue'
  if (
    accountType === 'liability'
    && (
      includesAny(combinedName, ['deferred tax', 'income tax payable', 'sales tax payable', 'vat payable', 'tax payable'])
      || includesAny(fsCategory, ['tax payable', 'deferred tax'])
    )
  ) return 'Other Liabilities'
  if (includesAny(combinedName, ['debt', 'loan', 'note payable']) || accountId === '2500' || includesAny(fsCategory, ['debt'])) return 'Debt'
  if (accountType === 'equity' || includesAny(fsCategory, ['equity'])) return 'Equity'
  if (accountType === 'asset') return includesAny(category, ['other asset', 'deferred tax']) || includesAny(fsCategory, ['other current assets', 'deferred tax']) ? 'Other Assets' : 'Not Applicable'
  if (accountType === 'liability') return includesAny(category, ['other liability', 'long term liability', 'deferred tax']) ? 'Other Liabilities' : 'Not Applicable'
  return 'Not Applicable'
}

async function main() {
  const accounts = await prisma.chartOfAccounts.findMany({
    select: {
      id: true,
      accountId: true,
      accountNumber: true,
      name: true,
      accountType: true,
      category: true,
      financialStatementCategory: true,
      rollforwardCategory: true,
      parentAccount: {
        select: {
          accountId: true,
          accountNumber: true,
          name: true,
          category: true,
        },
      },
    },
  })

  let updated = 0
  for (const account of accounts) {
    const derived = deriveRollforwardCategory(account)
    if ((account.rollforwardCategory ?? '') === derived) continue
    await prisma.chartOfAccounts.update({
      where: { id: account.id },
      data: { rollforwardCategory: derived },
    })
    updated += 1
  }

  console.log(`Backfilled rollforward category on ${updated} chart of accounts rows.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
