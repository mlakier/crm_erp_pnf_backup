const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function loadCsvRows(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8')
  return parseCsv(raw)
}

function parseCsv(raw) {
  const rows = []
  let current = ''
  let currentRow = []
  let inQuotes = false

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    const next = raw[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(current)
      current = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      currentRow.push(current)
      rows.push(currentRow)
      current = ''
      currentRow = []
      continue
    }

    current += char
  }

  if (current.length > 0 || currentRow.length > 0) {
    currentRow.push(current)
    rows.push(currentRow)
  }

  const [headerRow, ...dataRows] = rows.filter((row) => row.some((value) => String(value).length > 0))
  return dataRows.map((row) =>
    Object.fromEntries(headerRow.map((header, index) => [header, row[index] ?? '']))
  )
}

function yesNoToBool(value) {
  return String(value ?? '').trim().toLowerCase() === 'yes'
}

function normalizeSegments(name) {
  return String(name ?? '')
    .split(':')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function flattenAccountName(name) {
  const segments = normalizeSegments(name)
  return segments[segments.length - 1] ?? String(name ?? '').trim()
}

function toBroadAccountType(rawType) {
  const normalized = String(rawType ?? '').trim().toLowerCase()
  if (['accounts payable', 'credit card', 'deferred revenue', 'long term liability', 'other current liability'].includes(normalized)) {
    return 'Liability'
  }
  if (normalized === 'equity') {
    return 'Equity'
  }
  if (['income', 'other income'].includes(normalized)) {
    return 'Revenue'
  }
  if (['cost of goods sold', 'expense', 'other expense'].includes(normalized)) {
    return 'Expense'
  }
  return 'Asset'
}

function toNormalBalance(rawType) {
  const normalized = String(rawType ?? '').trim().toLowerCase()
  if (
    ['accounts payable', 'credit card', 'deferred revenue', 'equity', 'income', 'long term liability', 'other current liability', 'other income'].includes(normalized)
  ) {
    return 'credit'
  }
  return 'debit'
}

function toFsSectionAndGroup(rawType) {
  const normalized = String(rawType ?? '').trim().toLowerCase()
  if (['bank', 'accounts receivable', 'deferred expense', 'other current asset'].includes(normalized)) {
    return { section: 'Assets', group: 'Current Assets' }
  }
  if (['fixed asset', 'other asset'].includes(normalized)) {
    return { section: 'Assets', group: 'Non-Current Assets' }
  }
  if (['accounts payable', 'credit card', 'deferred revenue', 'other current liability'].includes(normalized)) {
    return { section: 'Liabilities', group: 'Current Liabilities' }
  }
  if (normalized === 'long term liability') {
    return { section: 'Liabilities', group: 'Non-Current Liabilities' }
  }
  if (normalized === 'equity') {
    return { section: 'Equity', group: 'Equity' }
  }
  if (normalized === 'income') {
    return { section: 'Revenue', group: 'Revenue' }
  }
  if (normalized === 'other income') {
    return { section: 'Other Income and Expense', group: 'Other Income and Expense' }
  }
  if (normalized === 'cost of goods sold') {
    return { section: 'Expenses', group: 'Cost of Goods Sold' }
  }
  if (['expense', 'other expense'].includes(normalized)) {
    return {
      section: normalized === 'other expense' ? 'Other Income and Expense' : 'Expenses',
      group: normalized === 'other expense' ? 'Other Income and Expense' : 'Operating Expenses',
    }
  }
  return { section: 'Assets', group: 'Current Assets' }
}

function toCashFlowCategory(rawType) {
  const normalized = String(rawType ?? '').trim().toLowerCase()
  if (['fixed asset', 'other asset'].includes(normalized)) return 'Investing'
  if (['equity', 'long term liability'].includes(normalized)) return 'Financing'
  return 'Operating'
}

function buildDescription({ leafName, rawType, summary, parentLabel }) {
  const typeText = String(rawType ?? '').trim().toLowerCase() || 'general ledger'
  if (summary) {
    return parentLabel
      ? `${leafName} summary account for the ${parentLabel} ${typeText} hierarchy.`
      : `${leafName} summary account for ${typeText} reporting.`
  }
  return parentLabel
    ? `${leafName} ${typeText} account within the ${parentLabel} hierarchy.`
    : `${leafName} ${typeText} account imported from the source chart.`
}

function deriveAccountRow(row) {
  const rawType = String(row['Account Type'] ?? '').trim()
  const fullName = String(row.Name ?? '').trim()
  const segments = normalizeSegments(fullName)
  const leafName = flattenAccountName(fullName)
  const parentPath = segments.length > 1 ? segments.slice(0, -1).join(' : ') : null
  const parentLabel = segments.length > 1 ? segments[segments.length - 2] : null
  const summary = yesNoToBool(row.Summary)
  const specialAccountType = String(row['Special Account Type'] ?? '').trim()
  const { section, group } = toFsSectionAndGroup(rawType)
  const inventory = /inventory/i.test(fullName) || specialAccountType === 'InvtAsset'
  const controlAccount = ['accounts receivable', 'accounts payable'].includes(rawType.toLowerCase()) || inventory
  const broadType = toBroadAccountType(rawType)
  const active = !yesNoToBool(row.Inactive)
  const revalueOpenBalance =
    !summary &&
    ['bank', 'accounts receivable', 'accounts payable', 'credit card', 'other current asset', 'other current liability', 'long term liability', 'deferred revenue'].includes(rawType.toLowerCase())
  const eliminateIntercoTransactions = /(intercompany|interco|due to|due from)/i.test(fullName)
  const requiresSubledgerType =
    rawType === 'Accounts Receivable'
      ? 'Customer'
      : rawType === 'Accounts Payable' || rawType === 'Credit Card'
        ? 'Vendor'
        : inventory || rawType === 'Cost of Goods Sold'
          ? 'Item'
          : null

  return {
    sourceInternalId: String(row['Internal ID'] ?? '').trim(),
    accountId: String(row.ID ?? '').trim(),
    accountNumber: String(row.Number ?? '').trim(),
    fullName,
    leafName,
    parentPath,
    rawType,
    description: String(row.Description ?? '').trim() || buildDescription({ leafName, rawType, summary, parentLabel }),
    accountType: broadType,
    normalBalance: toNormalBalance(rawType),
    financialStatementSection: section,
    financialStatementGroup: group,
    cashFlowCategory: toCashFlowCategory(rawType),
    isPosting: !summary,
    isControlAccount: controlAccount,
    allowsManualPosting: !summary && !controlAccount,
    inventory,
    revalueOpenBalance,
    eliminateIntercoTransactions,
    summary,
    active,
    requiresSubledgerType,
    category: rawType,
    includeChildren: true,
  }
}

function snapshotRefValue(account, fieldName) {
  return account?.[fieldName]?.accountId ?? null
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    throw new Error('Usage: node scripts/import-chart-of-accounts-from-csv.js <csv-path>')
  }

  const resolvedCsvPath = path.resolve(csvPath)
  const rows = loadCsvRows(resolvedCsvPath)
  const normalizedRows = rows
    .map(deriveAccountRow)
    .filter((row) => row.accountId && row.accountNumber && row.leafName)
    .sort((a, b) => {
      const depthDiff = normalizeSegments(a.fullName).length - normalizeSegments(b.fullName).length
      if (depthDiff !== 0) return depthDiff
      return a.accountNumber.localeCompare(b.accountNumber)
    })

  const subsidiary = await prisma.subsidiary.findUnique({
    where: { subsidiaryId: 'SUB-001' },
    select: { id: true, subsidiaryId: true, name: true },
  })
  if (!subsidiary) {
    throw new Error('Subsidiary SUB-001 was not found.')
  }

  const [items, subsidiaries, existingAccounts] = await Promise.all([
    prisma.item.findMany({
      select: {
        id: true,
        incomeAccount: { select: { accountId: true } },
        deferredRevenueAccount: { select: { accountId: true } },
        inventoryAccount: { select: { accountId: true } },
        cogsExpenseAccount: { select: { accountId: true } },
        deferredCostAccount: { select: { accountId: true } },
      },
    }),
    prisma.subsidiary.findMany({
      select: {
        id: true,
        retainedEarningsAccount: { select: { accountId: true } },
        ctaAccount: { select: { accountId: true } },
        intercompanyClearingAccount: { select: { accountId: true } },
        dueToAccount: { select: { accountId: true } },
        dueFromAccount: { select: { accountId: true } },
      },
    }),
    prisma.chartOfAccounts.findMany({ select: { id: true, accountId: true } }),
  ])

  const itemSnapshots = items.map((item) => ({
    id: item.id,
    incomeAccountId: snapshotRefValue(item, 'incomeAccount'),
    deferredRevenueAccountId: snapshotRefValue(item, 'deferredRevenueAccount'),
    inventoryAccountId: snapshotRefValue(item, 'inventoryAccount'),
    cogsExpenseAccountId: snapshotRefValue(item, 'cogsExpenseAccount'),
    deferredCostAccountId: snapshotRefValue(item, 'deferredCostAccount'),
  }))

  const subsidiarySnapshots = subsidiaries.map((entry) => ({
    id: entry.id,
    retainedEarningsAccountId: snapshotRefValue(entry, 'retainedEarningsAccount'),
    ctaAccountId: snapshotRefValue(entry, 'ctaAccount'),
    intercompanyClearingAccountId: snapshotRefValue(entry, 'intercompanyClearingAccount'),
    dueToAccountId: snapshotRefValue(entry, 'dueToAccount'),
    dueFromAccountId: snapshotRefValue(entry, 'dueFromAccount'),
  }))

  await prisma.$transaction(async (tx) => {
    await tx.item.updateMany({
      data: {
        incomeAccountId: null,
        deferredRevenueAccountId: null,
        inventoryAccountId: null,
        cogsExpenseAccountId: null,
        deferredCostAccountId: null,
      },
    })

    await tx.subsidiary.updateMany({
      data: {
        retainedEarningsAccountId: null,
        ctaAccountId: null,
        intercompanyClearingAccountId: null,
        dueToAccountId: null,
        dueFromAccountId: null,
      },
    })

    if (existingAccounts.length > 0) {
      await tx.chartOfAccountSubsidiary.deleteMany({})
      await tx.chartOfAccounts.deleteMany({})
    }

    const createdByPath = new Map()
    const createdByAccountId = new Map()

    for (const row of normalizedRows) {
      const parentAccount = row.parentPath ? createdByPath.get(row.parentPath) ?? null : null
      const created = await tx.chartOfAccounts.create({
        data: {
          accountId: row.accountId,
          accountNumber: row.accountNumber,
          name: row.leafName,
          description: row.description,
          accountType: row.accountType,
          normalBalance: row.normalBalance,
          financialStatementSection: row.financialStatementSection,
          financialStatementGroup: row.financialStatementGroup,
          inventory: row.inventory,
          revalueOpenBalance: row.revalueOpenBalance,
          eliminateIntercoTransactions: row.eliminateIntercoTransactions,
          summary: row.summary,
          isPosting: row.isPosting,
          isControlAccount: row.isControlAccount,
          allowsManualPosting: row.allowsManualPosting,
          requiresSubledgerType: row.requiresSubledgerType,
          cashFlowCategory: row.cashFlowCategory,
          parentAccountId: parentAccount?.id ?? null,
          includeChildren: true,
          category: row.category,
          active: row.active,
          subsidiaryAssignments: {
            create: [{ subsidiaryId: subsidiary.id }],
          },
        },
      })

      createdByPath.set(row.fullName, created)
      createdByAccountId.set(row.accountId, created.id)
    }

    for (const item of itemSnapshots) {
      await tx.item.update({
        where: { id: item.id },
        data: {
          incomeAccountId: item.incomeAccountId ? createdByAccountId.get(item.incomeAccountId) ?? null : null,
          deferredRevenueAccountId: item.deferredRevenueAccountId ? createdByAccountId.get(item.deferredRevenueAccountId) ?? null : null,
          inventoryAccountId: item.inventoryAccountId ? createdByAccountId.get(item.inventoryAccountId) ?? null : null,
          cogsExpenseAccountId: item.cogsExpenseAccountId ? createdByAccountId.get(item.cogsExpenseAccountId) ?? null : null,
          deferredCostAccountId: item.deferredCostAccountId ? createdByAccountId.get(item.deferredCostAccountId) ?? null : null,
        },
      })
    }

    for (const entry of subsidiarySnapshots) {
      await tx.subsidiary.update({
        where: { id: entry.id },
        data: {
          retainedEarningsAccountId: entry.retainedEarningsAccountId ? createdByAccountId.get(entry.retainedEarningsAccountId) ?? null : null,
          ctaAccountId: entry.ctaAccountId ? createdByAccountId.get(entry.ctaAccountId) ?? null : null,
          intercompanyClearingAccountId: entry.intercompanyClearingAccountId ? createdByAccountId.get(entry.intercompanyClearingAccountId) ?? null : null,
          dueToAccountId: entry.dueToAccountId ? createdByAccountId.get(entry.dueToAccountId) ?? null : null,
          dueFromAccountId: entry.dueFromAccountId ? createdByAccountId.get(entry.dueFromAccountId) ?? null : null,
        },
      })
    }
  })

  console.log(
    JSON.stringify(
      {
        imported: normalizedRows.length,
        subsidiary: subsidiary.subsidiaryId,
        includeChildren: true,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
