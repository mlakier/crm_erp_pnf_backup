const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const MONEY_TOLERANCE = 0.005

function roundMoney(value) {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100
}

function formatDate(value) {
  return new Date(`${value}T00:00:00.000Z`)
}

function sumLineDebits(lines) {
  return roundMoney(
    lines.reduce((sum, line) => sum + roundMoney(line.debit ?? 0), 0),
  )
}

function formatActivityValue(value) {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value
      .map((entry) => formatActivityValue(entry))
      .filter(Boolean)
      .join(', ')
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return String(value)
}

function createFieldChangeSummary(payload) {
  return `FIELD_CHANGE:${JSON.stringify(payload)}`
}

async function logActivity(tx, { entityType, entityId, action, summary, userId = null }) {
  await tx.activity.create({
    data: {
      entityType,
      entityId,
      action,
      summary,
      userId,
    },
  })
}

async function logRecordSnapshotActivities(tx, {
  entityType,
  entityId,
  userId = null,
  context,
  action,
  fields,
}) {
  const changes = fields
    .map((field) => {
      const formattedValue = formatActivityValue(field.value)
      if (!formattedValue) return null
      return {
        entityType,
        entityId,
        action,
        userId,
        summary: createFieldChangeSummary({
          context: field.context ?? context,
          fieldName: field.fieldName,
          oldValue: action === 'delete' ? formattedValue : '',
          newValue: action === 'create' ? formattedValue : '',
        }),
      }
    })
    .filter(Boolean)

  if (!changes.length) return
  await tx.activity.createMany({ data: changes })
}

async function latestRateOnOrBefore(tx, baseCurrencyId, quoteCurrencyId, effectiveDate) {
  const direct = await tx.exchangeRate.findFirst({
    where: {
      baseCurrencyId,
      quoteCurrencyId,
      active: true,
      rateType: { in: ['spot', 'Spot'] },
      effectiveDate: { lte: effectiveDate },
    },
    orderBy: { effectiveDate: 'desc' },
    select: { rate: true, effectiveDate: true, source: true },
  })

  if (direct) {
    return {
      rate: Number(direct.rate),
      source: direct.source ?? 'exchange_rates',
      effectiveDate: direct.effectiveDate,
    }
  }

  const inverse = await tx.exchangeRate.findFirst({
    where: {
      baseCurrencyId: quoteCurrencyId,
      quoteCurrencyId: baseCurrencyId,
      active: true,
      rateType: { in: ['spot', 'Spot'] },
      effectiveDate: { lte: effectiveDate },
    },
    orderBy: { effectiveDate: 'desc' },
    select: { rate: true, effectiveDate: true, source: true },
  })

  if (inverse) {
    return {
      rate: 1 / Number(inverse.rate),
      source: inverse.source ?? 'exchange_rates',
      effectiveDate: inverse.effectiveDate,
    }
  }

  return null
}

async function translateAmount(tx, amount, fromCurrencyId, toCurrencyId, effectiveDate, triangulationCurrencyId) {
  const numericAmount = roundMoney(amount)
  if (!fromCurrencyId || !toCurrencyId) return null
  if (fromCurrencyId === toCurrencyId) return numericAmount

  const direct = await latestRateOnOrBefore(tx, fromCurrencyId, toCurrencyId, effectiveDate)
  if (direct) return roundMoney(numericAmount * direct.rate)

  if (triangulationCurrencyId && fromCurrencyId !== triangulationCurrencyId && toCurrencyId !== triangulationCurrencyId) {
    const toBase = await latestRateOnOrBefore(tx, fromCurrencyId, triangulationCurrencyId, effectiveDate)
    const fromBase = await latestRateOnOrBefore(tx, triangulationCurrencyId, toCurrencyId, effectiveDate)
    if (toBase && fromBase) {
      return roundMoney(numericAmount * toBase.rate * fromBase.rate)
    }
  }

  return null
}

async function deriveCurrencyLayers(tx, amount, transactionCurrencyId, subsidiary, effectiveDate, usdCurrencyId) {
  return {
    transactionAmount: roundMoney(amount),
    localAmount: await translateAmount(tx, amount, transactionCurrencyId, subsidiary.localCurrencyId, effectiveDate, usdCurrencyId),
    functionalAmount: await translateAmount(tx, amount, transactionCurrencyId, subsidiary.functionalCurrencyId, effectiveDate, usdCurrencyId),
    groupAmount: await translateAmount(tx, amount, transactionCurrencyId, subsidiary.groupCurrencyId, effectiveDate, usdCurrencyId),
  }
}

function proportionalAmount(totalTranslatedAmount, totalTransactionAmount, appliedTransactionAmount) {
  if (totalTranslatedAmount == null) return null
  if (!Number.isFinite(totalTransactionAmount) || Math.abs(totalTransactionAmount) <= MONEY_TOLERANCE) return null
  return roundMoney((Number(totalTranslatedAmount) / Number(totalTransactionAmount)) * Number(appliedTransactionAmount))
}

async function generateNextClearingDocumentNumber(tx) {
  const prefix = 'CLR-'
  const latest = await tx.clearingDocumentHeader.findMany({
    where: { clearingNumber: { startsWith: prefix } },
    select: { clearingNumber: true },
    orderBy: { clearingNumber: 'desc' },
    take: 200,
  })

  const maxSequence = latest.reduce((max, entry) => {
    const match = entry.clearingNumber.match(/^CLR-(\d+)$/i)
    if (!match) return max
    const next = Number.parseInt(match[1], 10)
    return Number.isFinite(next) && next > max ? next : max
  }, 0)

  return `${prefix}${maxSequence + 1}`
}

async function createClearingDocumentForApplication(tx, {
  application,
  fromOpenItem,
  toOpenItem,
  clearingType,
  automationSource,
  memo,
  createdById,
}) {
  const clearingNumber = await generateNextClearingDocumentNumber(tx)

  return tx.clearingDocumentHeader.create({
    data: {
      clearingNumber,
      clearingType,
      status: 'posted',
      subsidiaryId: fromOpenItem?.subsidiaryId ?? toOpenItem?.subsidiaryId ?? null,
      transactionCurrencyId: fromOpenItem?.transactionCurrencyId ?? toOpenItem?.transactionCurrencyId ?? null,
      localCurrencyId: fromOpenItem?.localCurrencyId ?? toOpenItem?.localCurrencyId ?? null,
      functionalCurrencyId: fromOpenItem?.functionalCurrencyId ?? toOpenItem?.functionalCurrencyId ?? null,
      groupCurrencyId: fromOpenItem?.groupCurrencyId ?? toOpenItem?.groupCurrencyId ?? null,
      clearingDate: application.applicationDate,
      postingDate: application.postingDate ?? null,
      sourceTransactionType: application.settlementTransactionType ?? null,
      sourceTransactionId: application.settlementTransactionId ?? null,
      counterpartyType: fromOpenItem?.counterpartyType ?? toOpenItem?.counterpartyType ?? null,
      counterpartyId: fromOpenItem?.counterpartyId ?? toOpenItem?.counterpartyId ?? null,
      transactionAmount: roundMoney(application.transactionAmount),
      localAmount: application.localAmount == null ? null : roundMoney(application.localAmount),
      functionalAmount: application.functionalAmount == null ? null : roundMoney(application.functionalAmount),
      groupAmount: application.groupAmount == null ? null : roundMoney(application.groupAmount),
      realizedFxLocalAmount: application.realizedFxLocalAmount == null ? null : roundMoney(application.realizedFxLocalAmount),
      realizedFxFunctionalAmount:
        application.realizedFxFunctionalAmount == null ? null : roundMoney(application.realizedFxFunctionalAmount),
      realizedFxGroupAmount:
        application.realizedFxGroupAmount == null ? null : roundMoney(application.realizedFxGroupAmount),
      memo: memo ?? null,
      autoGenerated: true,
      automationSource,
      createdById: createdById ?? null,
      lines: {
        create: [
          {
            lineNumber: 1,
            lineRole: 'source',
            fromOpenItemId: fromOpenItem?.id ?? null,
            sourceTransactionType: fromOpenItem?.sourceTransactionType ?? null,
            sourceTransactionId: fromOpenItem?.sourceTransactionId ?? null,
            sourceTransactionLineId: fromOpenItem?.sourceTransactionLineId ?? null,
            settlementTransactionType: application.settlementTransactionType ?? null,
            settlementTransactionId: application.settlementTransactionId ?? null,
            transactionAmount: roundMoney(application.transactionAmount),
            localAmount: application.localAmount == null ? null : roundMoney(application.localAmount),
            functionalAmount: application.functionalAmount == null ? null : roundMoney(application.functionalAmount),
            groupAmount: application.groupAmount == null ? null : roundMoney(application.groupAmount),
            realizedFxLocalAmount: application.realizedFxLocalAmount == null ? null : roundMoney(application.realizedFxLocalAmount),
            realizedFxFunctionalAmount:
              application.realizedFxFunctionalAmount == null ? null : roundMoney(application.realizedFxFunctionalAmount),
            realizedFxGroupAmount:
              application.realizedFxGroupAmount == null ? null : roundMoney(application.realizedFxGroupAmount),
            openItemApplicationId: application.id,
            memo: memo ?? null,
          },
          ...(toOpenItem
            ? [{
                lineNumber: 2,
                lineRole: 'target',
                toOpenItemId: toOpenItem.id,
                sourceTransactionType: toOpenItem.sourceTransactionType ?? null,
                sourceTransactionId: toOpenItem.sourceTransactionId ?? null,
                sourceTransactionLineId: toOpenItem.sourceTransactionLineId ?? null,
                settlementTransactionType: application.settlementTransactionType ?? null,
                settlementTransactionId: application.settlementTransactionId ?? null,
                transactionAmount: roundMoney(application.transactionAmount),
                localAmount: application.localAmount == null ? null : roundMoney(application.localAmount),
                functionalAmount: application.functionalAmount == null ? null : roundMoney(application.functionalAmount),
                groupAmount: application.groupAmount == null ? null : roundMoney(application.groupAmount),
                realizedFxLocalAmount: application.realizedFxLocalAmount == null ? null : roundMoney(application.realizedFxLocalAmount),
                realizedFxFunctionalAmount:
                  application.realizedFxFunctionalAmount == null ? null : roundMoney(application.realizedFxFunctionalAmount),
                realizedFxGroupAmount:
                  application.realizedFxGroupAmount == null ? null : roundMoney(application.realizedFxGroupAmount),
                openItemApplicationId: application.id,
                memo: memo ?? null,
              }]
            : []),
        ],
      },
    },
  })
}

async function createApplicationWithClearing(tx, {
  applicationData,
  fromOpenItem,
  toOpenItem,
  clearingType,
  automationSource,
  memo,
  createdById,
}) {
  const application = await tx.openItemApplication.create({
    data: applicationData,
  })

  await createClearingDocumentForApplication(tx, {
    application,
    fromOpenItem,
    toOpenItem,
    clearingType,
    automationSource,
    memo,
    createdById,
  })

  return application
}

async function createJournalEntry(tx, header, lines) {
  const journal = await tx.journalEntry.create({
    data: {
      number: header.number,
      date: header.date,
      description: header.description,
      journalType: header.journalType ?? 'standard',
      status: header.status ?? 'posted',
      total: sumLineDebits(lines),
      accountingPeriodId: header.accountingPeriodId,
      sourceType: header.sourceType ?? null,
      sourceId: header.sourceId ?? null,
      isOpenItemRelevant: header.isOpenItemRelevant ?? false,
      subsidiaryId: header.subsidiaryId ?? null,
      currencyId: header.currencyId ?? null,
      userId: header.userId ?? null,
      lineItems: {
        create: lines.map((line, index) => ({
          displayOrder: index + 1,
          description: line.description ?? null,
          debit: roundMoney(line.debit ?? 0),
          credit: roundMoney(line.credit ?? 0),
          localDebit: line.localDebit == null ? null : roundMoney(line.localDebit),
          localCredit: line.localCredit == null ? null : roundMoney(line.localCredit),
          functionalDebit: line.functionalDebit == null ? null : roundMoney(line.functionalDebit),
          functionalCredit: line.functionalCredit == null ? null : roundMoney(line.functionalCredit),
          groupDebit: line.groupDebit == null ? null : roundMoney(line.groupDebit),
          groupCredit: line.groupCredit == null ? null : roundMoney(line.groupCredit),
          memo: line.memo ?? null,
          activityTypeCode: line.activityTypeCode ?? null,
          accountId: line.accountId,
          subsidiaryId: line.subsidiaryId ?? null,
          customerId: line.customerId ?? null,
          vendorId: line.vendorId ?? null,
          itemId: line.itemId ?? null,
          departmentId: line.departmentId ?? null,
          locationId: line.locationId ?? null,
          projectId: line.projectId ?? null,
          employeeId: line.employeeId ?? null,
          settlesOpenItemId: line.settlesOpenItemId ?? null,
        })),
      },
    },
    include: {
      lineItems: true,
    },
  })

  await logActivity(tx, {
    entityType: 'journal-entry',
    entityId: journal.id,
    action: 'create',
    summary: `Created journal entry ${journal.number}`,
    userId: header.userId ?? null,
  })
  await logRecordSnapshotActivities(tx, {
    entityType: 'journal-entry',
    entityId: journal.id,
    userId: header.userId ?? null,
    action: 'create',
    context: 'Journal Header',
    fields: [
      { fieldName: 'Journal Id', value: journal.number },
      { fieldName: 'Date', value: header.date },
      { fieldName: 'Description', value: header.description },
      { fieldName: 'Status', value: header.status ?? 'posted' },
      { fieldName: 'Journal Type', value: header.journalType ?? 'standard' },
      { fieldName: 'Open Item Relevant', value: header.isOpenItemRelevant ?? false },
      { fieldName: 'Subsidiary', value: header.subsidiaryId ?? null },
      { fieldName: 'Currency', value: header.currencyId ?? null },
      { fieldName: 'Accounting Period', value: header.accountingPeriodId ?? null },
      { fieldName: 'Total', value: sumLineDebits(lines) },
    ],
  })

  return journal
}

async function createOpenItemWithEntries(tx, args) {
  const openItem = await tx.openItem.create({
    data: {
      openItemNumber: args.openItemNumber,
      openItemType: args.openItemType,
      status: args.status ?? 'open',
      accountType: args.accountType,
      accountId: args.accountId,
      subsidiaryId: args.subsidiaryId,
      transactionCurrencyId: args.transactionCurrencyId,
      localCurrencyId: args.localCurrencyId,
      functionalCurrencyId: args.functionalCurrencyId,
      groupCurrencyId: args.groupCurrencyId,
      sourceTransactionType: args.sourceTransactionType,
      sourceTransactionId: args.sourceTransactionId,
      sourceNumber: args.sourceNumber,
      counterpartyType: args.counterpartyType,
      counterpartyId: args.counterpartyId,
      documentDate: args.documentDate,
      postingDate: args.postingDate,
      dueDate: args.dueDate ?? null,
      originalTransactionAmount: roundMoney(args.originalTransactionAmount),
      originalLocalAmount: args.originalLocalAmount == null ? null : roundMoney(args.originalLocalAmount),
      originalFunctionalAmount: args.originalFunctionalAmount == null ? null : roundMoney(args.originalFunctionalAmount),
      originalGroupAmount: args.originalGroupAmount == null ? null : roundMoney(args.originalGroupAmount),
      openItemEligible: true,
      isOpen: true,
      memo: args.memo ?? null,
      entries: {
        create: args.entries.map((entry, index) => ({
          entryNumber: index + 1,
          entryType: entry.entryType,
          effectiveDate: entry.effectiveDate,
          postingDate: entry.postingDate ?? null,
          accountingPeriodId: entry.accountingPeriodId ?? null,
          transactionAmount: roundMoney(entry.transactionAmount),
          localAmount: entry.localAmount == null ? null : roundMoney(entry.localAmount),
          functionalAmount: entry.functionalAmount == null ? null : roundMoney(entry.functionalAmount),
          groupAmount: entry.groupAmount == null ? null : roundMoney(entry.groupAmount),
          sourceTransactionType: entry.sourceTransactionType ?? null,
          sourceTransactionId: entry.sourceTransactionId ?? null,
          sourceTransactionLineId: entry.sourceTransactionLineId ?? null,
          sourceApplicationId: entry.sourceApplicationId ?? null,
          sourceGlLineId: entry.sourceGlLineId ?? null,
          sourceRunId: entry.sourceRunId ?? null,
          memo: entry.memo ?? null,
          createdById: entry.createdById ?? null,
        })),
      },
    },
  })

  return openItem
}

async function seedValidationPack(tx) {
  const adminUser = await tx.user.findFirst({
    where: { userId: 'USER-00001' },
    select: { id: true },
  })
  if (!adminUser) {
    throw new Error('Admin user USER-00001 not found.')
  }

  const currencies = await tx.currency.findMany({
    where: { code: { in: ['USD', 'EUR', 'GBP'] } },
    select: { id: true, code: true },
  })
  const currencyByCode = Object.fromEntries(currencies.map((currency) => [currency.code, currency]))

  const april2026 = await tx.accountingPeriod.findFirst({
    where: { name: 'April 2026', subsidiaryId: null },
    select: { id: true, name: true, startDate: true, endDate: true },
  })
  if (!april2026) {
    throw new Error('Global accounting period April 2026 not found.')
  }

  const subsidiaries = await tx.subsidiary.findMany({
    where: { subsidiaryId: { in: ['SUB-003', 'SUB-004', 'SUB-007'] } },
    select: {
      id: true,
      subsidiaryId: true,
      name: true,
      localCurrencyId: true,
      functionalCurrencyId: true,
      groupCurrencyId: true,
    },
  })
  const subsidiaryByCode = Object.fromEntries(subsidiaries.map((subsidiary) => [subsidiary.subsidiaryId, subsidiary]))

  const customers = await tx.customer.findMany({
    where: { name: { contains: 'Britannia Retail Group', mode: 'insensitive' } },
    select: { id: true, customerId: true, name: true },
  })
  const vendors = await tx.vendor.findMany({
    where: { name: { contains: 'Britannia Industrial Ltd', mode: 'insensitive' } },
    select: { id: true, vendorNumber: true, name: true },
  })
  const items = await tx.item.findMany({
    where: { itemId: { in: ['ITEM-000001'] } },
    select: { id: true, itemId: true, name: true },
  })

  const accounts = await tx.chartOfAccounts.findMany({
    where: {
      id: {
        in: [
          'cmoby754b00ged9m941wkivl5',
          'cmoby754u00hud9m98ezuau8m',
          'cmoby754y00i6d9m9nb1xq4av',
          'cmoby750a0056d9m9jnatua3m',
          'cmoby750p0062d9m9079ydl5u',
          'cmoby752400a6d9m9h9omekcj',
          'cmoby752h00bad9m9d29fkdgl',
          'cmoby75ao00zyd9m9mcl6ddcl',
          'cmoby75bv013qd9m9k8b9x8wr',
        ],
      },
    },
    select: { id: true, accountId: true, accountNumber: true, name: true },
  })
  const accountById = Object.fromEntries(accounts.map((account) => [account.id, account]))

  const customer = customers[0]
  const vendor = vendors[0]
  const item = items[0]
  const usd = currencyByCode.USD
  const eur = currencyByCode.EUR
  const gbp = currencyByCode.GBP
  const sub003 = subsidiaryByCode['SUB-003']
  const sub004 = subsidiaryByCode['SUB-004']
  const sub007 = subsidiaryByCode['SUB-007']

  if (!customer || !vendor || !item || !usd || !eur || !gbp || !sub003 || !sub004 || !sub007) {
    throw new Error('Validation pack prerequisites are missing (customer, vendor, item, currencies, or subsidiaries).')
  }

  const BANK_USD = 'cmoby754b00ged9m941wkivl5'
  const BANK_EUR = 'cmoby754u00hud9m98ezuau8m'
  const BANK_GBP = 'cmoby754y00i6d9m9nb1xq4av'
  const AR_TRADE = 'cmoby750a0056d9m9jnatua3m'
  const PREPAID = 'cmoby750p0062d9m9079ydl5u'
  const AP_TRADE = 'cmoby752400a6d9m9h9omekcj'
  const DEFERRED_REVENUE = 'cmoby752h00bad9m9d29fkdgl'
  const OTHER_FACILITIES_EXPENSE = 'cmoby75ao00zyd9m9mcl6ddcl'
  const REVENUE = 'cmoby75bv013qd9m9k8b9x8wr'

  const invoiceDate = formatDate('2026-04-10')
  const receiptDate = formatDate('2026-04-24')
  const creditMemoDate = formatDate('2026-04-29')
  const customerOverpaymentDate = formatDate('2026-05-01')
  const customerRefundDate = formatDate('2026-05-04')
  const billDate = formatDate('2026-04-08')
  const paymentDate = formatDate('2026-04-24')
  const billCreditDate = formatDate('2026-04-29')
  const prepaidAddDate = formatDate('2026-04-05')
  const prepaidReleaseDate = formatDate('2026-04-30')
  const deferredAddDate = formatDate('2026-04-07')
  const deferredReleaseDate = formatDate('2026-04-30')

  const invoiceTotal = 1000
  const receiptApplied = 400
  const creditMemoApplied = roundMoney(invoiceTotal - receiptApplied)
  const customerOverpaymentAmount = 150
  const customerRefundAmount = 50
  const billTotal = 600
  const paymentApplied = 250
  const billCreditApplied = roundMoney(billTotal - paymentApplied)
  const prepaidAddition = 1200
  const prepaidRelease = 200
  const deferredAddition = 900
  const deferredRelease = 300

  const invoiceOriginal = await deriveCurrencyLayers(tx, invoiceTotal, gbp.id, sub007, invoiceDate, usd.id)
  const receiptSettlement = await deriveCurrencyLayers(tx, receiptApplied, gbp.id, sub007, receiptDate, usd.id)
  const creditMemoSettlement = await deriveCurrencyLayers(tx, creditMemoApplied, gbp.id, sub007, creditMemoDate, usd.id)
  const customerOverpaymentLayers = await deriveCurrencyLayers(tx, customerOverpaymentAmount, gbp.id, sub007, customerOverpaymentDate, usd.id)
  const customerRefundSettlement = await deriveCurrencyLayers(tx, customerRefundAmount, gbp.id, sub007, customerRefundDate, usd.id)
  const billOriginal = await deriveCurrencyLayers(tx, billTotal, gbp.id, sub007, billDate, usd.id)
  const paymentSettlement = await deriveCurrencyLayers(tx, paymentApplied, gbp.id, sub007, paymentDate, usd.id)
  const billCreditSettlement = await deriveCurrencyLayers(tx, billCreditApplied, gbp.id, sub007, billCreditDate, usd.id)
  const prepaidAddLayers = await deriveCurrencyLayers(tx, prepaidAddition, usd.id, sub004, prepaidAddDate, usd.id)
  const prepaidReleaseLayers = await deriveCurrencyLayers(tx, prepaidRelease, usd.id, sub004, prepaidReleaseDate, usd.id)
  const deferredAddLayers = await deriveCurrencyLayers(tx, deferredAddition, eur.id, sub003, deferredAddDate, usd.id)
  const deferredReleaseLayers = await deriveCurrencyLayers(tx, deferredRelease, eur.id, sub003, deferredReleaseDate, usd.id)

  const invoiceCarriedSettlement = {
    localAmount: proportionalAmount(invoiceOriginal.localAmount, invoiceOriginal.transactionAmount, receiptApplied),
    functionalAmount: proportionalAmount(invoiceOriginal.functionalAmount, invoiceOriginal.transactionAmount, receiptApplied),
    groupAmount: proportionalAmount(invoiceOriginal.groupAmount, invoiceOriginal.transactionAmount, receiptApplied),
  }
  const billCarriedSettlement = {
    localAmount: proportionalAmount(billOriginal.localAmount, billOriginal.transactionAmount, paymentApplied),
    functionalAmount: proportionalAmount(billOriginal.functionalAmount, billOriginal.transactionAmount, paymentApplied),
    groupAmount: proportionalAmount(billOriginal.groupAmount, billOriginal.transactionAmount, paymentApplied),
  }
  const invoiceCarriedCredit = {
    localAmount: proportionalAmount(invoiceOriginal.localAmount, invoiceOriginal.transactionAmount, creditMemoApplied),
    functionalAmount: proportionalAmount(invoiceOriginal.functionalAmount, invoiceOriginal.transactionAmount, creditMemoApplied),
    groupAmount: proportionalAmount(invoiceOriginal.groupAmount, invoiceOriginal.transactionAmount, creditMemoApplied),
  }
  const billCarriedCredit = {
    localAmount: proportionalAmount(billOriginal.localAmount, billOriginal.transactionAmount, billCreditApplied),
    functionalAmount: proportionalAmount(billOriginal.functionalAmount, billOriginal.transactionAmount, billCreditApplied),
    groupAmount: proportionalAmount(billOriginal.groupAmount, billOriginal.transactionAmount, billCreditApplied),
  }
  const customerReceiptCarriedRefund = {
    localAmount: proportionalAmount(customerOverpaymentLayers.localAmount, customerOverpaymentLayers.transactionAmount, customerRefundAmount),
    functionalAmount: proportionalAmount(customerOverpaymentLayers.functionalAmount, customerOverpaymentLayers.transactionAmount, customerRefundAmount),
    groupAmount: proportionalAmount(customerOverpaymentLayers.groupAmount, customerOverpaymentLayers.transactionAmount, customerRefundAmount),
  }

  const invoiceRealizedFunctional = roundMoney(
    (receiptSettlement.functionalAmount ?? 0) - (invoiceCarriedSettlement.functionalAmount ?? 0),
  )
  const invoiceRealizedGroup = roundMoney(
    (receiptSettlement.groupAmount ?? 0) - (invoiceCarriedSettlement.groupAmount ?? 0),
  )
  const billRealizedFunctional = roundMoney(
    (paymentSettlement.functionalAmount ?? 0) - (billCarriedSettlement.functionalAmount ?? 0),
  )
  const billRealizedGroup = roundMoney(
    (paymentSettlement.groupAmount ?? 0) - (billCarriedSettlement.groupAmount ?? 0),
  )
  const creditMemoRealizedFunctional = roundMoney(
    (creditMemoSettlement.functionalAmount ?? 0) - (invoiceCarriedCredit.functionalAmount ?? 0),
  )
  const creditMemoRealizedGroup = roundMoney(
    (creditMemoSettlement.groupAmount ?? 0) - (invoiceCarriedCredit.groupAmount ?? 0),
  )
  const customerRefundRealizedFunctional = roundMoney(
    (customerRefundSettlement.functionalAmount ?? 0) - (customerReceiptCarriedRefund.functionalAmount ?? 0),
  )
  const customerRefundRealizedGroup = roundMoney(
    (customerRefundSettlement.groupAmount ?? 0) - (customerReceiptCarriedRefund.groupAmount ?? 0),
  )
  const billCreditRealizedFunctional = roundMoney(
    (billCreditSettlement.functionalAmount ?? 0) - (billCarriedCredit.functionalAmount ?? 0),
  )
  const billCreditRealizedGroup = roundMoney(
    (billCreditSettlement.groupAmount ?? 0) - (billCarriedCredit.groupAmount ?? 0),
  )

  const invoice = await tx.invoice.create({
    data: {
      number: 'INV-VAL-202604-001',
      status: 'open',
      total: invoiceTotal,
      dueDate: formatDate('2026-05-10'),
      customerId: customer.id,
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
      userId: adminUser.id,
      lineItems: {
        create: [
          {
            description: 'Validation pack GBP invoice',
            quantity: 1,
            unitPrice: invoiceTotal,
            lineTotal: invoiceTotal,
            itemId: item.id,
          },
        ],
      },
    },
  })
  await logActivity(tx, {
    entityType: 'invoice',
    entityId: invoice.id,
    action: 'create',
    summary: `Created invoice ${invoice.number}`,
    userId: adminUser.id,
  })
  await logRecordSnapshotActivities(tx, {
    entityType: 'invoice',
    entityId: invoice.id,
    userId: adminUser.id,
    action: 'create',
    context: 'Invoice',
    fields: [
      { fieldName: 'Invoice #', value: invoice.number },
      { fieldName: 'Customer', value: customer.customerId },
      { fieldName: 'Status', value: invoice.status },
      { fieldName: 'Total', value: invoiceTotal },
      { fieldName: 'Currency', value: gbp.code },
      { fieldName: 'Subsidiary', value: sub007.subsidiaryId },
      { fieldName: 'Due Date', value: formatDate('2026-05-10') },
    ],
  })

  const invoiceJournal = await createJournalEntry(
    tx,
    {
      number: 'JE-VAL-202604-001',
      date: invoiceDate,
      description: 'Validation pack GBP invoice posting',
      accountingPeriodId: april2026.id,
      sourceType: 'invoice',
      sourceId: invoice.id,
      isOpenItemRelevant: true,
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
      userId: adminUser.id,
    },
    [
      {
        description: 'Accounts receivable',
        debit: invoiceTotal,
        credit: 0,
        localDebit: invoiceOriginal.localAmount,
        localCredit: 0,
        functionalDebit: invoiceOriginal.functionalAmount,
        functionalCredit: 0,
        groupDebit: invoiceOriginal.groupAmount,
        groupCredit: 0,
        memo: invoice.number,
        activityTypeCode: 'ar_addition',
        accountId: AR_TRADE,
        subsidiaryId: sub007.id,
        customerId: customer.id,
      },
      {
        description: 'Revenue recognition',
        debit: 0,
        credit: invoiceTotal,
        localDebit: 0,
        localCredit: invoiceOriginal.localAmount,
        functionalDebit: 0,
        functionalCredit: invoiceOriginal.functionalAmount,
        groupDebit: 0,
        groupCredit: invoiceOriginal.groupAmount,
        memo: invoice.number,
        activityTypeCode: 'revenue_recognition',
        accountId: REVENUE,
        subsidiaryId: sub007.id,
        customerId: customer.id,
      },
    ],
  )

  const arOpenItem = await createOpenItemWithEntries(tx, {
    openItemNumber: 'OI-VAL-202604-AR-001',
    openItemType: 'accounts_receivable',
    accountType: 'Asset',
    accountId: AR_TRADE,
    subsidiaryId: sub007.id,
    transactionCurrencyId: gbp.id,
    localCurrencyId: sub007.localCurrencyId,
    functionalCurrencyId: sub007.functionalCurrencyId,
    groupCurrencyId: sub007.groupCurrencyId,
    sourceTransactionType: 'invoice',
    sourceTransactionId: invoice.id,
    sourceNumber: invoice.number,
    counterpartyType: 'customer',
    counterpartyId: customer.id,
    documentDate: invoiceDate,
    postingDate: invoiceDate,
    dueDate: formatDate('2026-05-10'),
    originalTransactionAmount: invoiceTotal,
    originalLocalAmount: invoiceOriginal.localAmount,
    originalFunctionalAmount: invoiceOriginal.functionalAmount,
    originalGroupAmount: invoiceOriginal.groupAmount,
    memo: 'Validation pack GBP invoice open item',
    entries: [
      {
        entryType: 'original',
        effectiveDate: invoiceDate,
        postingDate: invoiceDate,
        accountingPeriodId: april2026.id,
        transactionAmount: invoiceTotal,
        localAmount: invoiceOriginal.localAmount,
        functionalAmount: invoiceOriginal.functionalAmount,
        groupAmount: invoiceOriginal.groupAmount,
        sourceTransactionType: 'invoice',
        sourceTransactionId: invoice.id,
        sourceGlLineId: invoiceJournal.lineItems[0].id,
        memo: invoice.number,
        createdById: adminUser.id,
      },
    ],
  })

  const receipt = await tx.cashReceipt.create({
    data: {
      number: 'IR-VAL-202604-001',
      status: 'posted',
      amount: receiptApplied,
      date: receiptDate,
      method: 'wire',
      reference: 'VAL-AR-SETTLEMENT-001',
      bankAccountId: BANK_GBP,
      fxRateType: 'spot',
      fxRateSource: 'validation_pack',
      fxEffectiveDate: receiptDate,
      invoiceId: invoice.id,
      applications: {
        create: [{ invoiceId: invoice.id, appliedAmount: receiptApplied }],
      },
    },
  })
  await logActivity(tx, {
    entityType: 'invoice-receipt',
    entityId: receipt.id,
    action: 'create',
    summary: `Created invoice receipt ${receipt.number}`,
    userId: adminUser.id,
  })
  await logRecordSnapshotActivities(tx, {
    entityType: 'invoice-receipt',
    entityId: receipt.id,
    userId: adminUser.id,
    action: 'create',
    context: 'Invoice Receipt',
    fields: [
      { fieldName: 'Receipt #', value: receipt.number },
      { fieldName: 'Invoice', value: invoice.number },
      { fieldName: 'Status', value: receipt.status },
      { fieldName: 'Amount', value: receiptApplied },
      { fieldName: 'Currency', value: gbp.code },
      { fieldName: 'Receipt Date', value: receiptDate },
      { fieldName: 'Method', value: 'wire' },
    ],
  })

  const receiptOpenItem = await createOpenItemWithEntries(tx, {
    openItemNumber: 'OI-VAL-202604-AR-RCPT-001',
    openItemType: 'customer_receipt',
    accountType: 'Asset',
    accountId: BANK_GBP,
    subsidiaryId: sub007.id,
    transactionCurrencyId: gbp.id,
    localCurrencyId: sub007.localCurrencyId,
    functionalCurrencyId: sub007.functionalCurrencyId,
    groupCurrencyId: sub007.groupCurrencyId,
    sourceTransactionType: 'invoice-receipt',
    sourceTransactionId: receipt.id,
    sourceNumber: receipt.number,
    counterpartyType: 'customer',
    counterpartyId: customer.id,
    documentDate: receiptDate,
    postingDate: receiptDate,
    originalTransactionAmount: receiptApplied,
    originalLocalAmount: receiptSettlement.localAmount,
    originalFunctionalAmount: receiptSettlement.functionalAmount,
    originalGroupAmount: receiptSettlement.groupAmount,
    memo: 'Validation pack GBP invoice receipt open item',
    entries: [
      {
        entryType: 'original',
        effectiveDate: receiptDate,
        postingDate: receiptDate,
        accountingPeriodId: april2026.id,
        transactionAmount: receiptApplied,
        localAmount: receiptSettlement.localAmount,
        functionalAmount: receiptSettlement.functionalAmount,
        groupAmount: receiptSettlement.groupAmount,
        sourceTransactionType: 'invoice-receipt',
        sourceTransactionId: receipt.id,
        memo: receipt.number,
        createdById: adminUser.id,
      },
    ],
  })

  const invoiceApplication = await createApplicationWithClearing(tx, {
    applicationData: {
      applicationNumber: 'OIA-VAL-202604-AR-001',
      applicationType: 'invoice_receipt_application',
      status: 'posted',
      fromOpenItemId: receiptOpenItem.id,
      toOpenItemId: arOpenItem.id,
      settlementTransactionType: 'invoice-receipt',
      settlementTransactionId: receipt.id,
      applicationDate: receiptDate,
      postingDate: receiptDate,
      transactionAmount: receiptApplied,
      localAmount: receiptSettlement.localAmount,
      functionalAmount: receiptSettlement.functionalAmount,
      groupAmount: receiptSettlement.groupAmount,
      realizedFxLocalAmount: 0,
      realizedFxFunctionalAmount: invoiceRealizedFunctional,
      realizedFxGroupAmount: invoiceRealizedGroup,
      memo: receipt.number,
      createdById: adminUser.id,
    },
    fromOpenItem: receiptOpenItem,
    toOpenItem: arOpenItem,
    clearingType: 'invoice_receipt_application',
    automationSource: 'validation_pack',
    memo: receipt.number,
    createdById: adminUser.id,
  })

  await tx.openItemEntry.create({
    data: {
      openItemId: receiptOpenItem.id,
      entryNumber: 2,
      entryType: 'settlement',
      effectiveDate: receiptDate,
      postingDate: receiptDate,
      accountingPeriodId: april2026.id,
      transactionAmount: -receiptApplied,
      localAmount: receiptSettlement.localAmount == null ? null : -receiptSettlement.localAmount,
      functionalAmount: receiptSettlement.functionalAmount == null ? null : -receiptSettlement.functionalAmount,
      groupAmount: receiptSettlement.groupAmount == null ? null : -receiptSettlement.groupAmount,
      sourceTransactionType: 'invoice-receipt',
      sourceTransactionId: receipt.id,
      sourceApplicationId: invoiceApplication.id,
      memo: receipt.number,
      createdById: adminUser.id,
    },
  })
  await tx.openItemEntry.create({
    data: {
      openItemId: arOpenItem.id,
      entryNumber: 2,
      entryType: 'settlement',
      effectiveDate: receiptDate,
      postingDate: receiptDate,
      accountingPeriodId: april2026.id,
      transactionAmount: -receiptApplied,
      localAmount: invoiceCarriedSettlement.localAmount == null ? null : -invoiceCarriedSettlement.localAmount,
      functionalAmount: invoiceCarriedSettlement.functionalAmount == null ? null : -invoiceCarriedSettlement.functionalAmount,
      groupAmount: invoiceCarriedSettlement.groupAmount == null ? null : -invoiceCarriedSettlement.groupAmount,
      sourceTransactionType: 'invoice-receipt',
      sourceTransactionId: receipt.id,
      sourceApplicationId: invoiceApplication.id,
      memo: receipt.number,
      createdById: adminUser.id,
    },
  })

  await tx.openItem.update({
    where: { id: receiptOpenItem.id },
    data: {
      status: 'closed',
      isOpen: false,
      closedAt: receiptDate,
      closedById: adminUser.id,
    },
  })

  const invoiceReceiptLines = [
    {
      description: 'Cash receipt',
      debit: receiptApplied,
      credit: 0,
      localDebit: receiptSettlement.localAmount,
      localCredit: 0,
      functionalDebit: receiptSettlement.functionalAmount,
      functionalCredit: 0,
      groupDebit: receiptSettlement.groupAmount,
      groupCredit: 0,
      memo: receipt.number,
      activityTypeCode: 'cash_receipt',
      accountId: BANK_GBP,
      subsidiaryId: sub007.id,
      customerId: customer.id,
    },
    {
      description: 'Accounts receivable settlement',
      debit: 0,
      credit: receiptApplied,
      localDebit: 0,
      localCredit: invoiceCarriedSettlement.localAmount,
      functionalDebit: 0,
      functionalCredit: invoiceCarriedSettlement.functionalAmount,
      groupDebit: 0,
      groupCredit: invoiceCarriedSettlement.groupAmount,
      memo: receipt.number,
      activityTypeCode: 'ar_settlement',
      accountId: AR_TRADE,
      subsidiaryId: sub007.id,
      customerId: customer.id,
      settlesOpenItemId: arOpenItem.id,
    },
  ]

  if (Math.abs(invoiceRealizedFunctional) > MONEY_TOLERANCE || Math.abs(invoiceRealizedGroup) > MONEY_TOLERANCE) {
    const companySetup = require('../config/company-setup-settings.json')
    const fxGainAccountId = companySetup.realizedFxGainAccountId
    const fxLossAccountId = companySetup.realizedFxLossAccountId
    const gain = invoiceRealizedFunctional >= 0 || invoiceRealizedGroup >= 0
    invoiceReceiptLines.push({
      description: gain ? 'Realized FX gain' : 'Realized FX loss',
      debit: 0,
      credit: 0,
      localDebit: 0,
      localCredit: 0,
      functionalDebit: invoiceRealizedFunctional < 0 ? Math.abs(invoiceRealizedFunctional) : 0,
      functionalCredit: invoiceRealizedFunctional > 0 ? invoiceRealizedFunctional : 0,
      groupDebit: invoiceRealizedGroup < 0 ? Math.abs(invoiceRealizedGroup) : 0,
      groupCredit: invoiceRealizedGroup > 0 ? invoiceRealizedGroup : 0,
      memo: receipt.number,
      activityTypeCode: invoiceRealizedFunctional >= 0 ? 'fx_realized_gain' : 'fx_realized_loss',
      accountId: invoiceRealizedFunctional >= 0 ? fxGainAccountId : fxLossAccountId,
      subsidiaryId: sub007.id,
      customerId: customer.id,
    })
  }

  await createJournalEntry(
    tx,
    {
      number: 'JE-VAL-202604-002',
      date: receiptDate,
      description: 'Validation pack GBP invoice receipt',
      accountingPeriodId: april2026.id,
      sourceType: 'invoice-receipt',
      sourceId: receipt.id,
      isOpenItemRelevant: false,
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
      userId: adminUser.id,
    },
    invoiceReceiptLines,
  )

  await tx.documentRelationship.create({
    data: {
      sourceRecordType: 'invoice-receipt',
      sourceRecordId: receipt.id,
      targetRecordType: 'invoice',
      targetRecordId: invoice.id,
      relationshipType: 'settles',
      autoGenerated: true,
      automationSource: 'validation_pack',
    },
  })

  const creditMemo = await tx.creditMemo.create({
    data: {
      number: 'CM-VAL-202604-001',
      status: 'applied',
      total: creditMemoApplied,
      date: creditMemoDate,
      reason: 'Validation remainder credit memo',
      notes: 'Validation pack GBP credit memo clearing remaining invoice balance',
      customerId: customer.id,
      invoiceId: invoice.id,
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
      userId: adminUser.id,
      lineItems: {
        create: [
          {
            description: 'Validation pack GBP credit memo',
            quantity: 1,
            unitPrice: creditMemoApplied,
            lineTotal: creditMemoApplied,
            itemId: item.id,
          },
        ],
      },
    },
  })
  await logActivity(tx, {
    entityType: 'credit-memo',
    entityId: creditMemo.id,
    action: 'create',
    summary: `Created credit memo ${creditMemo.number}`,
    userId: adminUser.id,
  })
  await logRecordSnapshotActivities(tx, {
    entityType: 'credit-memo',
    entityId: creditMemo.id,
    userId: adminUser.id,
    action: 'create',
    context: 'Credit Memo',
    fields: [
      { fieldName: 'Credit Memo #', value: creditMemo.number },
      { fieldName: 'Invoice', value: invoice.number },
      { fieldName: 'Customer', value: customer.customerId },
      { fieldName: 'Status', value: creditMemo.status },
      { fieldName: 'Total', value: creditMemoApplied },
      { fieldName: 'Currency', value: gbp.code },
      { fieldName: 'Date', value: creditMemoDate },
      { fieldName: 'Reason', value: creditMemo.reason },
    ],
  })

  const creditMemoJournalLines = [
    {
      description: 'Revenue reduction',
      debit: creditMemoApplied,
      credit: 0,
      localDebit: creditMemoSettlement.localAmount,
      localCredit: 0,
      functionalDebit: creditMemoSettlement.functionalAmount,
      functionalCredit: 0,
      groupDebit: creditMemoSettlement.groupAmount,
      groupCredit: 0,
      memo: creditMemo.number,
      activityTypeCode: 'revenue_recognition',
      accountId: REVENUE,
      subsidiaryId: sub007.id,
      customerId: customer.id,
    },
    {
      description: 'Accounts receivable credit',
      debit: 0,
      credit: creditMemoApplied,
      localDebit: 0,
      localCredit: creditMemoSettlement.localAmount,
      functionalDebit: 0,
      functionalCredit: creditMemoSettlement.functionalAmount,
      groupDebit: 0,
      groupCredit: creditMemoSettlement.groupAmount,
      memo: creditMemo.number,
      activityTypeCode: 'ar_settlement',
      accountId: AR_TRADE,
      subsidiaryId: sub007.id,
      customerId: customer.id,
    },
  ]

  if (Math.abs(creditMemoRealizedFunctional) > MONEY_TOLERANCE || Math.abs(creditMemoRealizedGroup) > MONEY_TOLERANCE) {
    const companySetup = require('../config/company-setup-settings.json')
    const fxGainAccountId = companySetup.realizedFxGainAccountId
    const fxLossAccountId = companySetup.realizedFxLossAccountId
    creditMemoJournalLines.push({
      description: creditMemoRealizedFunctional >= 0 ? 'Realized FX gain' : 'Realized FX loss',
      debit: 0,
      credit: 0,
      localDebit: 0,
      localCredit: 0,
      functionalDebit: creditMemoRealizedFunctional < 0 ? Math.abs(creditMemoRealizedFunctional) : 0,
      functionalCredit: creditMemoRealizedFunctional > 0 ? creditMemoRealizedFunctional : 0,
      groupDebit: creditMemoRealizedGroup < 0 ? Math.abs(creditMemoRealizedGroup) : 0,
      groupCredit: creditMemoRealizedGroup > 0 ? creditMemoRealizedGroup : 0,
      memo: creditMemo.number,
      activityTypeCode: creditMemoRealizedFunctional >= 0 ? 'fx_realized_gain' : 'fx_realized_loss',
      accountId: creditMemoRealizedFunctional >= 0 ? fxGainAccountId : fxLossAccountId,
      subsidiaryId: sub007.id,
      customerId: customer.id,
    })
  }

  const creditMemoJournal = await createJournalEntry(
    tx,
    {
      number: 'JE-VAL-202604-009',
      date: creditMemoDate,
      description: 'Validation pack GBP credit memo',
      accountingPeriodId: april2026.id,
      sourceType: 'credit-memo',
      sourceId: creditMemo.id,
      isOpenItemRelevant: true,
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
      userId: adminUser.id,
    },
    creditMemoJournalLines,
  )

  const creditMemoOpenItem = await createOpenItemWithEntries(tx, {
    openItemNumber: 'OI-VAL-202604-AR-CM-001',
    openItemType: 'credit_memo',
    accountType: 'Asset',
    accountId: AR_TRADE,
    subsidiaryId: sub007.id,
    transactionCurrencyId: gbp.id,
    localCurrencyId: sub007.localCurrencyId,
    functionalCurrencyId: sub007.functionalCurrencyId,
    groupCurrencyId: sub007.groupCurrencyId,
    sourceTransactionType: 'credit-memo',
    sourceTransactionId: creditMemo.id,
    sourceNumber: creditMemo.number,
    counterpartyType: 'customer',
    counterpartyId: customer.id,
    documentDate: creditMemoDate,
    postingDate: creditMemoDate,
    dueDate: creditMemoDate,
    originalTransactionAmount: creditMemoApplied,
    originalLocalAmount: creditMemoSettlement.localAmount,
    originalFunctionalAmount: creditMemoSettlement.functionalAmount,
    originalGroupAmount: creditMemoSettlement.groupAmount,
    memo: 'Validation pack GBP credit memo open item',
    entries: [
      {
        entryType: 'original',
        effectiveDate: creditMemoDate,
        postingDate: creditMemoDate,
        accountingPeriodId: april2026.id,
        transactionAmount: creditMemoApplied,
        localAmount: creditMemoSettlement.localAmount,
        functionalAmount: creditMemoSettlement.functionalAmount,
        groupAmount: creditMemoSettlement.groupAmount,
        sourceTransactionType: 'credit-memo',
        sourceTransactionId: creditMemo.id,
        sourceGlLineId: creditMemoJournal.lineItems[1].id,
        memo: creditMemo.number,
        createdById: adminUser.id,
      },
    ],
  })

  const creditMemoApplication = await createApplicationWithClearing(tx, {
    applicationData: {
      applicationNumber: 'OIA-VAL-202604-AR-002',
      applicationType: 'credit_memo_application',
      status: 'posted',
      fromOpenItemId: creditMemoOpenItem.id,
      toOpenItemId: arOpenItem.id,
      settlementTransactionType: 'credit-memo',
      settlementTransactionId: creditMemo.id,
      applicationDate: creditMemoDate,
      postingDate: creditMemoDate,
      transactionAmount: creditMemoApplied,
      localAmount: creditMemoSettlement.localAmount,
      functionalAmount: creditMemoSettlement.functionalAmount,
      groupAmount: creditMemoSettlement.groupAmount,
      realizedFxLocalAmount: 0,
      realizedFxFunctionalAmount: creditMemoRealizedFunctional,
      realizedFxGroupAmount: creditMemoRealizedGroup,
      memo: creditMemo.number,
      createdById: adminUser.id,
    },
    fromOpenItem: creditMemoOpenItem,
    toOpenItem: arOpenItem,
    clearingType: 'credit_memo_application',
    automationSource: 'validation_pack',
    memo: creditMemo.number,
    createdById: adminUser.id,
  })

  await tx.openItemEntry.create({
    data: {
      openItemId: creditMemoOpenItem.id,
      entryNumber: 2,
      entryType: 'settlement',
      effectiveDate: creditMemoDate,
      postingDate: creditMemoDate,
      accountingPeriodId: april2026.id,
      transactionAmount: -creditMemoApplied,
      localAmount: creditMemoSettlement.localAmount == null ? null : -creditMemoSettlement.localAmount,
      functionalAmount: creditMemoSettlement.functionalAmount == null ? null : -creditMemoSettlement.functionalAmount,
      groupAmount: creditMemoSettlement.groupAmount == null ? null : -creditMemoSettlement.groupAmount,
      sourceTransactionType: 'credit-memo',
      sourceTransactionId: creditMemo.id,
      sourceApplicationId: creditMemoApplication.id,
      memo: creditMemo.number,
      createdById: adminUser.id,
    },
  })

  await tx.openItemEntry.create({
    data: {
      openItemId: arOpenItem.id,
      entryNumber: 3,
      entryType: 'settlement',
      effectiveDate: creditMemoDate,
      postingDate: creditMemoDate,
      accountingPeriodId: april2026.id,
      transactionAmount: -creditMemoApplied,
      localAmount: invoiceCarriedCredit.localAmount == null ? null : -invoiceCarriedCredit.localAmount,
      functionalAmount: invoiceCarriedCredit.functionalAmount == null ? null : -invoiceCarriedCredit.functionalAmount,
      groupAmount: invoiceCarriedCredit.groupAmount == null ? null : -invoiceCarriedCredit.groupAmount,
      sourceTransactionType: 'credit-memo',
      sourceTransactionId: creditMemo.id,
      sourceApplicationId: creditMemoApplication.id,
      memo: creditMemo.number,
      createdById: adminUser.id,
    },
  })

  await tx.openItem.updateMany({
    where: { id: { in: [arOpenItem.id, creditMemoOpenItem.id] } },
    data: {
      status: 'closed',
      isOpen: false,
      closedAt: creditMemoDate,
      closedById: adminUser.id,
    },
  })

  await tx.invoice.update({
    where: { id: invoice.id },
    data: { status: 'paid' },
  })

  await tx.documentRelationship.create({
    data: {
      sourceRecordType: 'credit-memo',
      sourceRecordId: creditMemo.id,
      targetRecordType: 'invoice',
      targetRecordId: invoice.id,
      relationshipType: 'settles',
      autoGenerated: true,
      automationSource: 'validation_pack',
    },
  })

  const bill = await tx.bill.create({
    data: {
      number: 'BILL-VAL-202604-001',
      vendorBillNumber: 'VAL-GB-BILL-001',
      vendorBillDate: billDate,
      vendorId: vendor.id,
      total: billTotal,
      date: billDate,
      dueDate: formatDate('2026-05-08'),
      status: 'received',
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
      userId: adminUser.id,
      lineItems: {
        create: [
          {
            description: 'Validation pack GBP vendor bill',
            quantity: 1,
            unitPrice: billTotal,
            lineTotal: billTotal,
            expenseAccountId: OTHER_FACILITIES_EXPENSE,
          },
        ],
      },
    },
  })
  await logActivity(tx, {
    entityType: 'bill',
    entityId: bill.id,
    action: 'create',
    summary: `Created bill ${bill.number}`,
    userId: adminUser.id,
  })
  await logRecordSnapshotActivities(tx, {
    entityType: 'bill',
    entityId: bill.id,
    userId: adminUser.id,
    action: 'create',
    context: 'Bill',
    fields: [
      { fieldName: 'Bill #', value: bill.number },
      { fieldName: 'Vendor Bill No', value: bill.vendorBillNumber },
      { fieldName: 'Vendor', value: vendor.vendorNumber ?? vendor.name },
      { fieldName: 'Status', value: bill.status },
      { fieldName: 'Total', value: billTotal },
      { fieldName: 'Currency', value: gbp.code },
      { fieldName: 'Bill Date', value: billDate },
      { fieldName: 'Due Date', value: formatDate('2026-05-08') },
    ],
  })

  const billJournal = await createJournalEntry(
    tx,
    {
      number: 'JE-VAL-202604-003',
      date: billDate,
      description: 'Validation pack GBP bill posting',
      accountingPeriodId: april2026.id,
      sourceType: 'bill',
      sourceId: bill.id,
      isOpenItemRelevant: true,
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
      userId: adminUser.id,
    },
    [
      {
        description: 'Expense recognition',
        debit: billTotal,
        credit: 0,
        localDebit: billOriginal.localAmount,
        localCredit: 0,
        functionalDebit: billOriginal.functionalAmount,
        functionalCredit: 0,
        groupDebit: billOriginal.groupAmount,
        groupCredit: 0,
        memo: bill.number,
        activityTypeCode: 'expense_recognition',
        accountId: OTHER_FACILITIES_EXPENSE,
        subsidiaryId: sub007.id,
        vendorId: vendor.id,
      },
      {
        description: 'Accounts payable',
        debit: 0,
        credit: billTotal,
        localDebit: 0,
        localCredit: billOriginal.localAmount,
        functionalDebit: 0,
        functionalCredit: billOriginal.functionalAmount,
        groupDebit: 0,
        groupCredit: billOriginal.groupAmount,
        memo: bill.number,
        activityTypeCode: 'ap_addition',
        accountId: AP_TRADE,
        subsidiaryId: sub007.id,
        vendorId: vendor.id,
      },
    ],
  )

  const apOpenItem = await createOpenItemWithEntries(tx, {
    openItemNumber: 'OI-VAL-202604-AP-001',
    openItemType: 'accounts_payable',
    accountType: 'Liability',
    accountId: AP_TRADE,
    subsidiaryId: sub007.id,
    transactionCurrencyId: gbp.id,
    localCurrencyId: sub007.localCurrencyId,
    functionalCurrencyId: sub007.functionalCurrencyId,
    groupCurrencyId: sub007.groupCurrencyId,
    sourceTransactionType: 'bill',
    sourceTransactionId: bill.id,
    sourceNumber: bill.number,
    counterpartyType: 'vendor',
    counterpartyId: vendor.id,
    documentDate: billDate,
    postingDate: billDate,
    dueDate: formatDate('2026-05-08'),
    originalTransactionAmount: billTotal,
    originalLocalAmount: billOriginal.localAmount,
    originalFunctionalAmount: billOriginal.functionalAmount,
    originalGroupAmount: billOriginal.groupAmount,
    memo: 'Validation pack GBP bill open item',
    entries: [
      {
        entryType: 'original',
        effectiveDate: billDate,
        postingDate: billDate,
        accountingPeriodId: april2026.id,
        transactionAmount: billTotal,
        localAmount: billOriginal.localAmount,
        functionalAmount: billOriginal.functionalAmount,
        groupAmount: billOriginal.groupAmount,
        sourceTransactionType: 'bill',
        sourceTransactionId: bill.id,
        sourceGlLineId: billJournal.lineItems[1].id,
        memo: bill.number,
        createdById: adminUser.id,
      },
    ],
  })

  const billPayment = await tx.billPayment.create({
    data: {
      number: 'BP-VAL-202604-001',
      amount: paymentApplied,
      date: paymentDate,
      method: 'wire',
      reference: 'VAL-AP-SETTLEMENT-001',
      status: 'cleared',
      vendorId: vendor.id,
      billId: bill.id,
      bankAccountId: BANK_GBP,
      fxRateType: 'spot',
      fxRateSource: 'validation_pack',
      fxEffectiveDate: paymentDate,
      applications: {
        create: [{ billId: bill.id, appliedAmount: paymentApplied }],
      },
    },
  })
  await logActivity(tx, {
    entityType: 'bill-payment',
    entityId: billPayment.id,
    action: 'create',
    summary: `Created bill payment ${billPayment.number}`,
    userId: adminUser.id,
  })
  await logRecordSnapshotActivities(tx, {
    entityType: 'bill-payment',
    entityId: billPayment.id,
    userId: adminUser.id,
    action: 'create',
    context: 'Bill Payment',
    fields: [
      { fieldName: 'Bill Payment #', value: billPayment.number },
      { fieldName: 'Bill', value: bill.number },
      { fieldName: 'Vendor', value: vendor.vendorNumber ?? vendor.name },
      { fieldName: 'Status', value: billPayment.status },
      { fieldName: 'Amount', value: paymentApplied },
      { fieldName: 'Currency', value: gbp.code },
      { fieldName: 'Date', value: paymentDate },
      { fieldName: 'Method', value: 'wire' },
    ],
  })

  const paymentOpenItem = await createOpenItemWithEntries(tx, {
    openItemNumber: 'OI-VAL-202604-AP-PMT-001',
    openItemType: 'vendor_payment',
    accountType: 'Liability',
    accountId: BANK_GBP,
    subsidiaryId: sub007.id,
    transactionCurrencyId: gbp.id,
    localCurrencyId: sub007.localCurrencyId,
    functionalCurrencyId: sub007.functionalCurrencyId,
    groupCurrencyId: sub007.groupCurrencyId,
    sourceTransactionType: 'bill-payment',
    sourceTransactionId: billPayment.id,
    sourceNumber: billPayment.number,
    counterpartyType: 'vendor',
    counterpartyId: vendor.id,
    documentDate: paymentDate,
    postingDate: paymentDate,
    originalTransactionAmount: paymentApplied,
    originalLocalAmount: paymentSettlement.localAmount,
    originalFunctionalAmount: paymentSettlement.functionalAmount,
    originalGroupAmount: paymentSettlement.groupAmount,
    memo: 'Validation pack GBP bill payment open item',
    entries: [
      {
        entryType: 'original',
        effectiveDate: paymentDate,
        postingDate: paymentDate,
        accountingPeriodId: april2026.id,
        transactionAmount: paymentApplied,
        localAmount: paymentSettlement.localAmount,
        functionalAmount: paymentSettlement.functionalAmount,
        groupAmount: paymentSettlement.groupAmount,
        sourceTransactionType: 'bill-payment',
        sourceTransactionId: billPayment.id,
        memo: billPayment.number,
        createdById: adminUser.id,
      },
    ],
  })

  const billApplication = await createApplicationWithClearing(tx, {
    applicationData: {
      applicationNumber: 'OIA-VAL-202604-AP-001',
      applicationType: 'bill_payment_application',
      status: 'posted',
      fromOpenItemId: paymentOpenItem.id,
      toOpenItemId: apOpenItem.id,
      settlementTransactionType: 'bill-payment',
      settlementTransactionId: billPayment.id,
      applicationDate: paymentDate,
      postingDate: paymentDate,
      transactionAmount: paymentApplied,
      localAmount: paymentSettlement.localAmount,
      functionalAmount: paymentSettlement.functionalAmount,
      groupAmount: paymentSettlement.groupAmount,
      realizedFxLocalAmount: 0,
      realizedFxFunctionalAmount: billRealizedFunctional,
      realizedFxGroupAmount: billRealizedGroup,
      memo: billPayment.number,
      createdById: adminUser.id,
    },
    fromOpenItem: paymentOpenItem,
    toOpenItem: apOpenItem,
    clearingType: 'bill_payment_application',
    automationSource: 'validation_pack',
    memo: billPayment.number,
    createdById: adminUser.id,
  })

  await tx.openItemEntry.create({
    data: {
      openItemId: paymentOpenItem.id,
      entryNumber: 2,
      entryType: 'settlement',
      effectiveDate: paymentDate,
      postingDate: paymentDate,
      accountingPeriodId: april2026.id,
      transactionAmount: -paymentApplied,
      localAmount: paymentSettlement.localAmount == null ? null : -paymentSettlement.localAmount,
      functionalAmount: paymentSettlement.functionalAmount == null ? null : -paymentSettlement.functionalAmount,
      groupAmount: paymentSettlement.groupAmount == null ? null : -paymentSettlement.groupAmount,
      sourceTransactionType: 'bill-payment',
      sourceTransactionId: billPayment.id,
      sourceApplicationId: billApplication.id,
      memo: billPayment.number,
      createdById: adminUser.id,
    },
  })
  await tx.openItemEntry.create({
    data: {
      openItemId: apOpenItem.id,
      entryNumber: 2,
      entryType: 'settlement',
      effectiveDate: paymentDate,
      postingDate: paymentDate,
      accountingPeriodId: april2026.id,
      transactionAmount: -paymentApplied,
      localAmount: billCarriedSettlement.localAmount == null ? null : -billCarriedSettlement.localAmount,
      functionalAmount: billCarriedSettlement.functionalAmount == null ? null : -billCarriedSettlement.functionalAmount,
      groupAmount: billCarriedSettlement.groupAmount == null ? null : -billCarriedSettlement.groupAmount,
      sourceTransactionType: 'bill-payment',
      sourceTransactionId: billPayment.id,
      sourceApplicationId: billApplication.id,
      memo: billPayment.number,
      createdById: adminUser.id,
    },
  })

  await tx.openItem.update({
    where: { id: paymentOpenItem.id },
    data: {
      status: 'closed',
      isOpen: false,
      closedAt: paymentDate,
      closedById: adminUser.id,
    },
  })

  const billPaymentLines = [
    {
      description: 'Accounts payable settlement',
      debit: paymentApplied,
      credit: 0,
      localDebit: billCarriedSettlement.localAmount,
      localCredit: 0,
      functionalDebit: billCarriedSettlement.functionalAmount,
      functionalCredit: 0,
      groupDebit: billCarriedSettlement.groupAmount,
      groupCredit: 0,
      memo: billPayment.number,
      activityTypeCode: 'ap_settlement',
      accountId: AP_TRADE,
      subsidiaryId: sub007.id,
      vendorId: vendor.id,
      settlesOpenItemId: apOpenItem.id,
    },
    {
      description: 'Cash disbursement',
      debit: 0,
      credit: paymentApplied,
      localDebit: 0,
      localCredit: paymentSettlement.localAmount,
      functionalDebit: 0,
      functionalCredit: paymentSettlement.functionalAmount,
      groupDebit: 0,
      groupCredit: paymentSettlement.groupAmount,
      memo: billPayment.number,
      activityTypeCode: 'cash_disbursement',
      accountId: BANK_GBP,
      subsidiaryId: sub007.id,
      vendorId: vendor.id,
    },
  ]

  if (Math.abs(billRealizedFunctional) > MONEY_TOLERANCE || Math.abs(billRealizedGroup) > MONEY_TOLERANCE) {
    const companySetup = require('../config/company-setup-settings.json')
    const fxGainAccountId = companySetup.realizedFxGainAccountId
    const fxLossAccountId = companySetup.realizedFxLossAccountId
    billPaymentLines.push({
      description: billRealizedFunctional >= 0 ? 'Realized FX gain' : 'Realized FX loss',
      debit: 0,
      credit: 0,
      localDebit: 0,
      localCredit: 0,
      functionalDebit: billRealizedFunctional < 0 ? Math.abs(billRealizedFunctional) : 0,
      functionalCredit: billRealizedFunctional > 0 ? billRealizedFunctional : 0,
      groupDebit: billRealizedGroup < 0 ? Math.abs(billRealizedGroup) : 0,
      groupCredit: billRealizedGroup > 0 ? billRealizedGroup : 0,
      memo: billPayment.number,
      activityTypeCode: billRealizedFunctional >= 0 ? 'fx_realized_gain' : 'fx_realized_loss',
      accountId: billRealizedFunctional >= 0 ? fxGainAccountId : fxLossAccountId,
      subsidiaryId: sub007.id,
      vendorId: vendor.id,
    })
  }

  await createJournalEntry(
    tx,
    {
      number: 'JE-VAL-202604-004',
      date: paymentDate,
      description: 'Validation pack GBP bill payment',
      accountingPeriodId: april2026.id,
      sourceType: 'bill-payment',
      sourceId: billPayment.id,
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
      userId: adminUser.id,
    },
    billPaymentLines,
  )

  const billCredit = await tx.billCredit.create({
    data: {
      number: 'BC-VAL-202604-001',
      status: 'applied',
      total: billCreditApplied,
      date: billCreditDate,
      reason: 'Validation remainder bill credit',
      notes: 'Validation pack GBP bill credit clearing remaining vendor bill balance',
      vendorId: vendor.id,
      billId: bill.id,
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
      userId: adminUser.id,
      lineItems: {
        create: [
          {
            description: 'Validation pack GBP bill credit',
            quantity: 1,
            unitPrice: billCreditApplied,
            lineTotal: billCreditApplied,
            itemId: item.id,
          },
        ],
      },
    },
  })
  await logActivity(tx, {
    entityType: 'bill-credit',
    entityId: billCredit.id,
    action: 'create',
    summary: `Created bill credit ${billCredit.number}`,
    userId: adminUser.id,
  })
  await logRecordSnapshotActivities(tx, {
    entityType: 'bill-credit',
    entityId: billCredit.id,
    userId: adminUser.id,
    action: 'create',
    context: 'Bill Credit',
    fields: [
      { fieldName: 'Bill Credit #', value: billCredit.number },
      { fieldName: 'Bill', value: bill.number },
      { fieldName: 'Vendor', value: vendor.vendorNumber ?? vendor.name },
      { fieldName: 'Status', value: billCredit.status },
      { fieldName: 'Total', value: billCreditApplied },
      { fieldName: 'Currency', value: gbp.code },
      { fieldName: 'Date', value: billCreditDate },
      { fieldName: 'Reason', value: billCredit.reason },
    ],
  })

  const billCreditJournalLines = [
    {
      description: 'Accounts payable credit',
      debit: billCreditApplied,
      credit: 0,
      localDebit: billCreditSettlement.localAmount,
      localCredit: 0,
      functionalDebit: billCreditSettlement.functionalAmount,
      functionalCredit: 0,
      groupDebit: billCreditSettlement.groupAmount,
      groupCredit: 0,
      memo: billCredit.number,
      activityTypeCode: 'ap_settlement',
      accountId: AP_TRADE,
      subsidiaryId: sub007.id,
      vendorId: vendor.id,
    },
    {
      description: 'Expense reversal',
      debit: 0,
      credit: billCreditApplied,
      localDebit: 0,
      localCredit: billCreditSettlement.localAmount,
      functionalDebit: 0,
      functionalCredit: billCreditSettlement.functionalAmount,
      groupDebit: 0,
      groupCredit: billCreditSettlement.groupAmount,
      memo: billCredit.number,
      activityTypeCode: 'expense_recognition',
      accountId: OTHER_FACILITIES_EXPENSE,
      subsidiaryId: sub007.id,
      vendorId: vendor.id,
    },
  ]

  if (Math.abs(billCreditRealizedFunctional) > MONEY_TOLERANCE || Math.abs(billCreditRealizedGroup) > MONEY_TOLERANCE) {
    const companySetup = require('../config/company-setup-settings.json')
    const fxGainAccountId = companySetup.realizedFxGainAccountId
    const fxLossAccountId = companySetup.realizedFxLossAccountId
    billCreditJournalLines.push({
      description: billCreditRealizedFunctional >= 0 ? 'Realized FX gain' : 'Realized FX loss',
      debit: 0,
      credit: 0,
      localDebit: 0,
      localCredit: 0,
      functionalDebit: billCreditRealizedFunctional < 0 ? Math.abs(billCreditRealizedFunctional) : 0,
      functionalCredit: billCreditRealizedFunctional > 0 ? billCreditRealizedFunctional : 0,
      groupDebit: billCreditRealizedGroup < 0 ? Math.abs(billCreditRealizedGroup) : 0,
      groupCredit: billCreditRealizedGroup > 0 ? billCreditRealizedGroup : 0,
      memo: billCredit.number,
      activityTypeCode: billCreditRealizedFunctional >= 0 ? 'fx_realized_gain' : 'fx_realized_loss',
      accountId: billCreditRealizedFunctional >= 0 ? fxGainAccountId : fxLossAccountId,
      subsidiaryId: sub007.id,
      vendorId: vendor.id,
    })
  }

  const billCreditJournal = await createJournalEntry(
    tx,
    {
      number: 'JE-VAL-202604-010',
      date: billCreditDate,
      description: 'Validation pack GBP bill credit',
      accountingPeriodId: april2026.id,
      sourceType: 'bill-credit',
      sourceId: billCredit.id,
      isOpenItemRelevant: true,
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
      userId: adminUser.id,
    },
    billCreditJournalLines,
  )

  const billCreditOpenItem = await createOpenItemWithEntries(tx, {
    openItemNumber: 'OI-VAL-202604-AP-BC-001',
    openItemType: 'bill_credit',
    accountType: 'Liability',
    accountId: AP_TRADE,
    subsidiaryId: sub007.id,
    transactionCurrencyId: gbp.id,
    localCurrencyId: sub007.localCurrencyId,
    functionalCurrencyId: sub007.functionalCurrencyId,
    groupCurrencyId: sub007.groupCurrencyId,
    sourceTransactionType: 'bill-credit',
    sourceTransactionId: billCredit.id,
    sourceNumber: billCredit.number,
    counterpartyType: 'vendor',
    counterpartyId: vendor.id,
    documentDate: billCreditDate,
    postingDate: billCreditDate,
    dueDate: billCreditDate,
    originalTransactionAmount: billCreditApplied,
    originalLocalAmount: billCreditSettlement.localAmount,
    originalFunctionalAmount: billCreditSettlement.functionalAmount,
    originalGroupAmount: billCreditSettlement.groupAmount,
    memo: 'Validation pack GBP bill credit open item',
    entries: [
      {
        entryType: 'original',
        effectiveDate: billCreditDate,
        postingDate: billCreditDate,
        accountingPeriodId: april2026.id,
        transactionAmount: billCreditApplied,
        localAmount: billCreditSettlement.localAmount,
        functionalAmount: billCreditSettlement.functionalAmount,
        groupAmount: billCreditSettlement.groupAmount,
        sourceTransactionType: 'bill-credit',
        sourceTransactionId: billCredit.id,
        sourceGlLineId: billCreditJournal.lineItems[0].id,
        memo: billCredit.number,
        createdById: adminUser.id,
      },
    ],
  })

  const billCreditApplication = await createApplicationWithClearing(tx, {
    applicationData: {
      applicationNumber: 'OIA-VAL-202604-AP-002',
      applicationType: 'bill_credit_application',
      status: 'posted',
      fromOpenItemId: billCreditOpenItem.id,
      toOpenItemId: apOpenItem.id,
      settlementTransactionType: 'bill-credit',
      settlementTransactionId: billCredit.id,
      applicationDate: billCreditDate,
      postingDate: billCreditDate,
      transactionAmount: billCreditApplied,
      localAmount: billCreditSettlement.localAmount,
      functionalAmount: billCreditSettlement.functionalAmount,
      groupAmount: billCreditSettlement.groupAmount,
      realizedFxLocalAmount: 0,
      realizedFxFunctionalAmount: billCreditRealizedFunctional,
      realizedFxGroupAmount: billCreditRealizedGroup,
      memo: billCredit.number,
      createdById: adminUser.id,
    },
    fromOpenItem: billCreditOpenItem,
    toOpenItem: apOpenItem,
    clearingType: 'bill_credit_application',
    automationSource: 'validation_pack',
    memo: billCredit.number,
    createdById: adminUser.id,
  })

  await tx.openItemEntry.create({
    data: {
      openItemId: billCreditOpenItem.id,
      entryNumber: 2,
      entryType: 'settlement',
      effectiveDate: billCreditDate,
      postingDate: billCreditDate,
      accountingPeriodId: april2026.id,
      transactionAmount: -billCreditApplied,
      localAmount: billCreditSettlement.localAmount == null ? null : -billCreditSettlement.localAmount,
      functionalAmount: billCreditSettlement.functionalAmount == null ? null : -billCreditSettlement.functionalAmount,
      groupAmount: billCreditSettlement.groupAmount == null ? null : -billCreditSettlement.groupAmount,
      sourceTransactionType: 'bill-credit',
      sourceTransactionId: billCredit.id,
      sourceApplicationId: billCreditApplication.id,
      memo: billCredit.number,
      createdById: adminUser.id,
    },
  })

  await tx.openItemEntry.create({
    data: {
      openItemId: apOpenItem.id,
      entryNumber: 3,
      entryType: 'settlement',
      effectiveDate: billCreditDate,
      postingDate: billCreditDate,
      accountingPeriodId: april2026.id,
      transactionAmount: -billCreditApplied,
      localAmount: billCarriedCredit.localAmount == null ? null : -billCarriedCredit.localAmount,
      functionalAmount: billCarriedCredit.functionalAmount == null ? null : -billCarriedCredit.functionalAmount,
      groupAmount: billCarriedCredit.groupAmount == null ? null : -billCarriedCredit.groupAmount,
      sourceTransactionType: 'bill-credit',
      sourceTransactionId: billCredit.id,
      sourceApplicationId: billCreditApplication.id,
      memo: billCredit.number,
      createdById: adminUser.id,
    },
  })

  await tx.openItem.updateMany({
    where: { id: { in: [apOpenItem.id, billCreditOpenItem.id] } },
    data: {
      status: 'closed',
      isOpen: false,
      closedAt: billCreditDate,
      closedById: adminUser.id,
    },
  })

  await tx.bill.update({
    where: { id: bill.id },
    data: { status: 'paid' },
  })

  await tx.documentRelationship.create({
    data: {
      sourceRecordType: 'bill-credit',
      sourceRecordId: billCredit.id,
      targetRecordType: 'bill',
      targetRecordId: bill.id,
      relationshipType: 'settles',
      autoGenerated: true,
      automationSource: 'validation_pack',
    },
  })

  await tx.documentRelationship.create({
    data: {
      sourceRecordType: 'bill-payment',
      sourceRecordId: billPayment.id,
      targetRecordType: 'bill',
      targetRecordId: bill.id,
      relationshipType: 'settles',
      autoGenerated: true,
      automationSource: 'validation_pack',
    },
  })

  const customerOverpaymentReceipt = await tx.cashReceipt.create({
    data: {
      number: 'IR-VAL-202605-OVERPAY-001',
      status: 'posted',
      overpaymentHandling: 'refund_pending',
      amount: customerOverpaymentAmount,
      date: customerOverpaymentDate,
      method: 'wire',
      reference: 'VAL-AR-OVERPAY-001',
      bankAccountId: BANK_GBP,
      fxRateType: 'spot',
      fxRateSource: 'validation_pack',
      fxEffectiveDate: customerOverpaymentDate,
      invoiceId: invoice.id,
    },
  })
  await logActivity(tx, {
    entityType: 'invoice-receipt',
    entityId: customerOverpaymentReceipt.id,
    action: 'create',
    summary: `Created invoice receipt ${customerOverpaymentReceipt.number}`,
    userId: adminUser.id,
  })
  await logRecordSnapshotActivities(tx, {
    entityType: 'invoice-receipt',
    entityId: customerOverpaymentReceipt.id,
    userId: adminUser.id,
    action: 'create',
    context: 'Invoice Receipt',
    fields: [
      { fieldName: 'Receipt #', value: customerOverpaymentReceipt.number },
      { fieldName: 'Invoice', value: invoice.number },
      { fieldName: 'Status', value: customerOverpaymentReceipt.status },
      { fieldName: 'Amount', value: customerOverpaymentAmount },
      { fieldName: 'Currency', value: gbp.code },
      { fieldName: 'Receipt Date', value: customerOverpaymentDate },
      { fieldName: 'Method', value: 'wire' },
      { fieldName: 'Overpayment Handling', value: 'refund_pending' },
    ],
  })

  await createJournalEntry(
    tx,
    {
      number: 'JE-VAL-202605-011',
      date: customerOverpaymentDate,
      description: 'Validation pack GBP customer overpayment receipt',
      accountingPeriodId: april2026.id,
      sourceType: 'invoice-receipt',
      sourceId: customerOverpaymentReceipt.id,
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
      userId: adminUser.id,
    },
    [
      {
        description: 'Cash receipt overpayment',
        debit: customerOverpaymentAmount,
        credit: 0,
        localDebit: customerOverpaymentLayers.localAmount,
        localCredit: 0,
        functionalDebit: customerOverpaymentLayers.functionalAmount,
        functionalCredit: 0,
        groupDebit: customerOverpaymentLayers.groupAmount,
        groupCredit: 0,
        memo: customerOverpaymentReceipt.number,
        activityTypeCode: 'cash_receipt',
        accountId: BANK_GBP,
        subsidiaryId: sub007.id,
        customerId: customer.id,
      },
      {
        description: 'Accounts receivable overpayment',
        debit: 0,
        credit: customerOverpaymentAmount,
        localDebit: 0,
        localCredit: customerOverpaymentLayers.localAmount,
        functionalDebit: 0,
        functionalCredit: customerOverpaymentLayers.functionalAmount,
        groupDebit: 0,
        groupCredit: customerOverpaymentLayers.groupAmount,
        memo: customerOverpaymentReceipt.number,
        activityTypeCode: 'ar_settlement',
        accountId: AR_TRADE,
        subsidiaryId: sub007.id,
        customerId: customer.id,
      },
    ],
  )

  const customerReceiptOpenItem = await createOpenItemWithEntries(tx, {
    openItemNumber: 'OI-VAL-202605-AR-OVERPAY-001',
    openItemType: 'customer_receipt',
    accountType: 'Asset',
    accountId: BANK_GBP,
    subsidiaryId: sub007.id,
    transactionCurrencyId: gbp.id,
    localCurrencyId: sub007.localCurrencyId,
    functionalCurrencyId: sub007.functionalCurrencyId,
    groupCurrencyId: sub007.groupCurrencyId,
    sourceTransactionType: 'invoice-receipt',
    sourceTransactionId: customerOverpaymentReceipt.id,
    sourceNumber: customerOverpaymentReceipt.number,
    counterpartyType: 'customer',
    counterpartyId: customer.id,
    documentDate: customerOverpaymentDate,
    postingDate: customerOverpaymentDate,
    originalTransactionAmount: customerOverpaymentAmount,
    originalLocalAmount: customerOverpaymentLayers.localAmount,
    originalFunctionalAmount: customerOverpaymentLayers.functionalAmount,
    originalGroupAmount: customerOverpaymentLayers.groupAmount,
    memo: 'Validation pack GBP customer overpayment receipt open item',
    entries: [
      {
        entryType: 'original',
        effectiveDate: customerOverpaymentDate,
        postingDate: customerOverpaymentDate,
        accountingPeriodId: april2026.id,
        transactionAmount: customerOverpaymentAmount,
        localAmount: customerOverpaymentLayers.localAmount,
        functionalAmount: customerOverpaymentLayers.functionalAmount,
        groupAmount: customerOverpaymentLayers.groupAmount,
        sourceTransactionType: 'invoice-receipt',
        sourceTransactionId: customerOverpaymentReceipt.id,
        memo: customerOverpaymentReceipt.number,
        createdById: adminUser.id,
      },
    ],
  })

  const customerRefund = await tx.customerRefund.create({
    data: {
      number: 'CRF-VAL-202605-001',
      status: 'processed',
      amount: customerRefundAmount,
      date: customerRefundDate,
      method: 'wire',
      reference: 'VAL-AR-REFUND-001',
      notes: 'Validation pack GBP customer refund sourced from overpayment receipt.',
      bankAccountId: BANK_GBP,
      customerId: customer.id,
      cashReceiptId: customerOverpaymentReceipt.id,
      userId: adminUser.id,
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
    },
  })
  await logActivity(tx, {
    entityType: 'customer-refund',
    entityId: customerRefund.id,
    action: 'create',
    summary: `Created customer refund ${customerRefund.number}`,
    userId: adminUser.id,
  })
  await logRecordSnapshotActivities(tx, {
    entityType: 'customer-refund',
    entityId: customerRefund.id,
    userId: adminUser.id,
    action: 'create',
    context: 'Customer Refund',
    fields: [
      { fieldName: 'Customer Refund #', value: customerRefund.number },
      { fieldName: 'Customer', value: customer.customerId },
      { fieldName: 'Invoice Receipt', value: customerOverpaymentReceipt.number },
      { fieldName: 'Status', value: customerRefund.status },
      { fieldName: 'Amount', value: customerRefundAmount },
      { fieldName: 'Currency', value: gbp.code },
      { fieldName: 'Refund Date', value: customerRefundDate },
      { fieldName: 'Method', value: 'wire' },
    ],
  })

  const customerRefundJournalLines = [
    {
      description: 'Accounts receivable refund',
      debit: customerRefundAmount,
      credit: 0,
      localDebit: customerReceiptCarriedRefund.localAmount,
      localCredit: 0,
      functionalDebit: customerReceiptCarriedRefund.functionalAmount,
      functionalCredit: 0,
      groupDebit: customerReceiptCarriedRefund.groupAmount,
      groupCredit: 0,
      memo: customerRefund.number,
      activityTypeCode: 'ar_settlement',
      accountId: AR_TRADE,
      subsidiaryId: sub007.id,
      customerId: customer.id,
    },
    {
      description: 'Cash disbursement',
      debit: 0,
      credit: customerRefundAmount,
      localDebit: 0,
      localCredit: customerRefundSettlement.localAmount,
      functionalDebit: 0,
      functionalCredit: customerRefundSettlement.functionalAmount,
      groupDebit: 0,
      groupCredit: customerRefundSettlement.groupAmount,
      memo: customerRefund.number,
      activityTypeCode: 'cash_disbursement',
      accountId: BANK_GBP,
      subsidiaryId: sub007.id,
      customerId: customer.id,
    },
  ]

  if (Math.abs(customerRefundRealizedFunctional) > MONEY_TOLERANCE || Math.abs(customerRefundRealizedGroup) > MONEY_TOLERANCE) {
    const companySetup = require('../config/company-setup-settings.json')
    const fxGainAccountId = companySetup.realizedFxGainAccountId
    const fxLossAccountId = companySetup.realizedFxLossAccountId
    customerRefundJournalLines.push({
      description: customerRefundRealizedFunctional >= 0 ? 'Realized FX gain' : 'Realized FX loss',
      debit: 0,
      credit: 0,
      localDebit: 0,
      localCredit: 0,
      functionalDebit: customerRefundRealizedFunctional < 0 ? Math.abs(customerRefundRealizedFunctional) : 0,
      functionalCredit: customerRefundRealizedFunctional > 0 ? customerRefundRealizedFunctional : 0,
      groupDebit: customerRefundRealizedGroup < 0 ? Math.abs(customerRefundRealizedGroup) : 0,
      groupCredit: customerRefundRealizedGroup > 0 ? customerRefundRealizedGroup : 0,
      memo: customerRefund.number,
      activityTypeCode: customerRefundRealizedFunctional >= 0 ? 'fx_realized_gain' : 'fx_realized_loss',
      accountId: customerRefundRealizedFunctional >= 0 ? fxGainAccountId : fxLossAccountId,
      subsidiaryId: sub007.id,
      customerId: customer.id,
    })
  }

  await createJournalEntry(
    tx,
    {
      number: 'JE-VAL-202605-012',
      date: customerRefundDate,
      description: 'Validation pack GBP customer refund',
      accountingPeriodId: april2026.id,
      sourceType: 'customer-refund',
      sourceId: customerRefund.id,
      isOpenItemRelevant: true,
      subsidiaryId: sub007.id,
      currencyId: gbp.id,
      userId: adminUser.id,
    },
    customerRefundJournalLines,
  )

  const customerRefundOpenItem = await createOpenItemWithEntries(tx, {
    openItemNumber: 'OI-VAL-202605-AR-REF-001',
    openItemType: 'customer_refund',
    accountType: 'Asset',
    accountId: BANK_GBP,
    subsidiaryId: sub007.id,
    transactionCurrencyId: gbp.id,
    localCurrencyId: sub007.localCurrencyId,
    functionalCurrencyId: sub007.functionalCurrencyId,
    groupCurrencyId: sub007.groupCurrencyId,
    sourceTransactionType: 'customer-refund',
    sourceTransactionId: customerRefund.id,
    sourceNumber: customerRefund.number,
    counterpartyType: 'customer',
    counterpartyId: customer.id,
    documentDate: customerRefundDate,
    postingDate: customerRefundDate,
    dueDate: customerRefundDate,
    originalTransactionAmount: customerRefundAmount,
    originalLocalAmount: customerRefundSettlement.localAmount,
    originalFunctionalAmount: customerRefundSettlement.functionalAmount,
    originalGroupAmount: customerRefundSettlement.groupAmount,
    memo: 'Validation pack GBP customer refund open item',
    entries: [
      {
        entryType: 'original',
        effectiveDate: customerRefundDate,
        postingDate: customerRefundDate,
        accountingPeriodId: april2026.id,
        transactionAmount: customerRefundAmount,
        localAmount: customerRefundSettlement.localAmount,
        functionalAmount: customerRefundSettlement.functionalAmount,
        groupAmount: customerRefundSettlement.groupAmount,
        sourceTransactionType: 'customer-refund',
        sourceTransactionId: customerRefund.id,
        memo: customerRefund.number,
        createdById: adminUser.id,
      },
    ],
  })

  const customerRefundApplication = await createApplicationWithClearing(tx, {
    applicationData: {
      applicationNumber: 'OIA-VAL-202605-AR-003',
      applicationType: 'customer_refund_application',
      status: 'posted',
      fromOpenItemId: customerRefundOpenItem.id,
      toOpenItemId: customerReceiptOpenItem.id,
      settlementTransactionType: 'customer-refund',
      settlementTransactionId: customerRefund.id,
      applicationDate: customerRefundDate,
      postingDate: customerRefundDate,
      transactionAmount: customerRefundAmount,
      localAmount: customerRefundSettlement.localAmount,
      functionalAmount: customerRefundSettlement.functionalAmount,
      groupAmount: customerRefundSettlement.groupAmount,
      realizedFxLocalAmount: 0,
      realizedFxFunctionalAmount: customerRefundRealizedFunctional,
      realizedFxGroupAmount: customerRefundRealizedGroup,
      memo: customerRefund.number,
      createdById: adminUser.id,
    },
    fromOpenItem: customerRefundOpenItem,
    toOpenItem: customerReceiptOpenItem,
    clearingType: 'customer_refund_application',
    automationSource: 'validation_pack',
    memo: customerRefund.number,
    createdById: adminUser.id,
  })

  await tx.openItemEntry.create({
    data: {
      openItemId: customerRefundOpenItem.id,
      entryNumber: 2,
      entryType: 'settlement',
      effectiveDate: customerRefundDate,
      postingDate: customerRefundDate,
      accountingPeriodId: april2026.id,
      transactionAmount: -customerRefundAmount,
      localAmount: customerRefundSettlement.localAmount == null ? null : -customerRefundSettlement.localAmount,
      functionalAmount: customerRefundSettlement.functionalAmount == null ? null : -customerRefundSettlement.functionalAmount,
      groupAmount: customerRefundSettlement.groupAmount == null ? null : -customerRefundSettlement.groupAmount,
      sourceTransactionType: 'customer-refund',
      sourceTransactionId: customerRefund.id,
      sourceApplicationId: customerRefundApplication.id,
      memo: customerRefund.number,
      createdById: adminUser.id,
    },
  })
  await tx.openItemEntry.create({
    data: {
      openItemId: customerReceiptOpenItem.id,
      entryNumber: 2,
      entryType: 'settlement',
      effectiveDate: customerRefundDate,
      postingDate: customerRefundDate,
      accountingPeriodId: april2026.id,
      transactionAmount: -customerRefundAmount,
      localAmount: customerReceiptCarriedRefund.localAmount == null ? null : -customerReceiptCarriedRefund.localAmount,
      functionalAmount: customerReceiptCarriedRefund.functionalAmount == null ? null : -customerReceiptCarriedRefund.functionalAmount,
      groupAmount: customerReceiptCarriedRefund.groupAmount == null ? null : -customerReceiptCarriedRefund.groupAmount,
      sourceTransactionType: 'customer-refund',
      sourceTransactionId: customerRefund.id,
      sourceApplicationId: customerRefundApplication.id,
      memo: customerRefund.number,
      createdById: adminUser.id,
    },
  })

  await tx.openItem.update({
    where: { id: customerRefundOpenItem.id },
    data: {
      status: 'closed',
      isOpen: false,
      closedAt: customerRefundDate,
      closedById: adminUser.id,
    },
  })

  await tx.documentRelationship.create({
    data: {
      sourceRecordType: 'customer-refund',
      sourceRecordId: customerRefund.id,
      targetRecordType: 'invoice-receipt',
      targetRecordId: customerOverpaymentReceipt.id,
      relationshipType: 'settles',
      autoGenerated: true,
      automationSource: 'validation_pack',
    },
  })

  const prepaidAddJournal = await createJournalEntry(
    tx,
    {
      number: 'JE-VAL-202604-005',
      date: prepaidAddDate,
      description: 'Validation pack prepaid addition',
      accountingPeriodId: april2026.id,
      subsidiaryId: sub004.id,
      currencyId: usd.id,
      userId: adminUser.id,
    },
    [
      {
        description: 'Prepaid asset addition',
        debit: prepaidAddition,
        credit: 0,
        localDebit: prepaidAddLayers.localAmount,
        localCredit: 0,
        functionalDebit: prepaidAddLayers.functionalAmount,
        functionalCredit: 0,
        groupDebit: prepaidAddLayers.groupAmount,
        groupCredit: 0,
        memo: 'Validation prepaid addition',
        activityTypeCode: 'prepaid_addition',
        accountId: PREPAID,
        subsidiaryId: sub004.id,
      },
      {
        description: 'Cash funding',
        debit: 0,
        credit: prepaidAddition,
        localDebit: 0,
        localCredit: prepaidAddLayers.localAmount,
        functionalDebit: 0,
        functionalCredit: prepaidAddLayers.functionalAmount,
        groupDebit: 0,
        groupCredit: prepaidAddLayers.groupAmount,
        memo: 'Validation prepaid addition',
        activityTypeCode: 'cash_disbursement',
        accountId: BANK_USD,
        subsidiaryId: sub004.id,
      },
    ],
  )

  const prepaidReleaseJournal = await createJournalEntry(
    tx,
    {
      number: 'JE-VAL-202604-006',
      date: prepaidReleaseDate,
      description: 'Validation pack prepaid amortization release',
      accountingPeriodId: april2026.id,
      subsidiaryId: sub004.id,
      currencyId: usd.id,
      userId: adminUser.id,
    },
    [
      {
        description: 'Expense recognition from prepaid',
        debit: prepaidRelease,
        credit: 0,
        localDebit: prepaidReleaseLayers.localAmount,
        localCredit: 0,
        functionalDebit: prepaidReleaseLayers.functionalAmount,
        functionalCredit: 0,
        groupDebit: prepaidReleaseLayers.groupAmount,
        groupCredit: 0,
        memo: 'Validation prepaid release',
        activityTypeCode: 'expense_recognition',
        accountId: OTHER_FACILITIES_EXPENSE,
        subsidiaryId: sub004.id,
      },
      {
        description: 'Prepaid release',
        debit: 0,
        credit: prepaidRelease,
        localDebit: 0,
        localCredit: prepaidReleaseLayers.localAmount,
        functionalDebit: 0,
        functionalCredit: prepaidReleaseLayers.functionalAmount,
        groupDebit: 0,
        groupCredit: prepaidReleaseLayers.groupAmount,
        memo: 'Validation prepaid release',
        activityTypeCode: 'amortization_release',
        accountId: PREPAID,
        subsidiaryId: sub004.id,
      },
    ],
  )

  const deferredAddJournal = await createJournalEntry(
    tx,
    {
      number: 'JE-VAL-202604-007',
      date: deferredAddDate,
      description: 'Validation pack deferred revenue addition',
      accountingPeriodId: april2026.id,
      subsidiaryId: sub003.id,
      currencyId: eur.id,
      userId: adminUser.id,
    },
    [
      {
        description: 'Cash receipt against deferred revenue',
        debit: deferredAddition,
        credit: 0,
        localDebit: deferredAddLayers.localAmount,
        localCredit: 0,
        functionalDebit: deferredAddLayers.functionalAmount,
        functionalCredit: 0,
        groupDebit: deferredAddLayers.groupAmount,
        groupCredit: 0,
        memo: 'Validation deferred revenue addition',
        activityTypeCode: 'cash_receipt',
        accountId: BANK_EUR,
        subsidiaryId: sub003.id,
      },
      {
        description: 'Deferred revenue addition',
        debit: 0,
        credit: deferredAddition,
        localDebit: 0,
        localCredit: deferredAddLayers.localAmount,
        functionalDebit: 0,
        functionalCredit: deferredAddLayers.functionalAmount,
        groupDebit: 0,
        groupCredit: deferredAddLayers.groupAmount,
        memo: 'Validation deferred revenue addition',
        activityTypeCode: 'deferred_revenue_addition',
        accountId: DEFERRED_REVENUE,
        subsidiaryId: sub003.id,
      },
    ],
  )

  const deferredReleaseJournal = await createJournalEntry(
    tx,
    {
      number: 'JE-VAL-202604-008',
      date: deferredReleaseDate,
      description: 'Validation pack deferred revenue release',
      accountingPeriodId: april2026.id,
      subsidiaryId: sub003.id,
      currencyId: eur.id,
      userId: adminUser.id,
    },
    [
      {
        description: 'Deferred revenue release',
        debit: deferredRelease,
        credit: 0,
        localDebit: deferredReleaseLayers.localAmount,
        localCredit: 0,
        functionalDebit: deferredReleaseLayers.functionalAmount,
        functionalCredit: 0,
        groupDebit: deferredReleaseLayers.groupAmount,
        groupCredit: 0,
        memo: 'Validation deferred revenue release',
        activityTypeCode: 'revenue_recognition',
        accountId: DEFERRED_REVENUE,
        subsidiaryId: sub003.id,
      },
      {
        description: 'Revenue recognition',
        debit: 0,
        credit: deferredRelease,
        localDebit: 0,
        localCredit: deferredReleaseLayers.localAmount,
        functionalDebit: 0,
        functionalCredit: deferredReleaseLayers.functionalAmount,
        groupDebit: 0,
        groupCredit: deferredReleaseLayers.groupAmount,
        memo: 'Validation deferred revenue release',
        activityTypeCode: 'revenue_recognition',
        accountId: REVENUE,
        subsidiaryId: sub003.id,
      },
    ],
  )

  await tx.documentRelationship.createMany({
    data: [
      {
        sourceRecordType: 'journal',
        sourceRecordId: prepaidAddJournal.id,
        targetRecordType: 'journal',
        targetRecordId: prepaidReleaseJournal.id,
        relationshipType: 'amortizes',
        autoGenerated: true,
        automationSource: 'validation_pack',
      },
      {
        sourceRecordType: 'journal',
        sourceRecordId: prepaidReleaseJournal.id,
        targetRecordType: 'journal',
        targetRecordId: prepaidAddJournal.id,
        relationshipType: 'amortization_of',
        autoGenerated: true,
        automationSource: 'validation_pack',
      },
      {
        sourceRecordType: 'journal',
        sourceRecordId: deferredAddJournal.id,
        targetRecordType: 'journal',
        targetRecordId: deferredReleaseJournal.id,
        relationshipType: 'revenue_recognition_for',
        autoGenerated: true,
        automationSource: 'validation_pack',
      },
      {
        sourceRecordType: 'journal',
        sourceRecordId: deferredReleaseJournal.id,
        targetRecordType: 'journal',
        targetRecordId: deferredAddJournal.id,
        relationshipType: 'deferred_from',
        autoGenerated: true,
        automationSource: 'validation_pack',
      },
    ],
  })

  return {
    accountingPeriod: april2026.name,
    created: {
      invoice: invoice.number,
      cashReceipt: receipt.number,
      overpaymentReceipt: customerOverpaymentReceipt.number,
      customerRefund: customerRefund.number,
      bill: bill.number,
      billPayment: billPayment.number,
      creditMemo: creditMemo.number,
      billCredit: billCredit.number,
      journals: [
        'JE-VAL-202604-001',
        'JE-VAL-202604-002',
        'JE-VAL-202604-003',
        'JE-VAL-202604-004',
        'JE-VAL-202604-009',
        'JE-VAL-202604-010',
        'JE-VAL-202605-011',
        'JE-VAL-202605-012',
        'JE-VAL-202604-005',
        'JE-VAL-202604-006',
        'JE-VAL-202604-007',
        'JE-VAL-202604-008',
      ],
      openItems: [
        arOpenItem.openItemNumber,
        receiptOpenItem.openItemNumber,
        creditMemoOpenItem.openItemNumber,
        customerReceiptOpenItem.openItemNumber,
        customerRefundOpenItem.openItemNumber,
        apOpenItem.openItemNumber,
        paymentOpenItem.openItemNumber,
        billCreditOpenItem.openItemNumber,
      ],
    },
    references: {
      customer: customer.customerId,
      vendor: vendor.vendorNumber ?? vendor.name,
      subsidiaries: [sub003.subsidiaryId, sub004.subsidiaryId, sub007.subsidiaryId],
      accountIds: Object.values(accountById).map((account) => account.accountId),
    },
    nextValidation: [
      'Run FX revaluation for April 2026 and subsidiary SUB-007 to test unrealized FX on the remaining GBP AR/AP balances.',
      'Open /rollforwards and test Prepaids, Deferred Revenue, Accounts Receivable, and Accounts Payable movement buckets for April 2026.',
      'Validate the cleared trios: invoice + partial receipt + credit memo, and bill + partial payment + bill credit.',
      'Validate the customer overpayment + customer refund clearing pair and confirm the source receipt remains open for the residual balance.',
    ],
  }
}

async function main() {
  const existingTransactions =
    (await prisma.invoice.count()) +
    (await prisma.bill.count()) +
    (await prisma.journalEntry.count()) +
    (await prisma.cashReceipt.count()) +
    (await prisma.billPayment.count())

  if (existingTransactions > 0) {
    throw new Error('Transaction history is not empty. Run the reset script first to load the validation pack into a clean transaction layer.')
  }

  const summary = await prisma.$transaction((tx) => seedValidationPack(tx))
  console.log('Loaded multi-currency validation pack:')
  console.log(JSON.stringify(summary, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
