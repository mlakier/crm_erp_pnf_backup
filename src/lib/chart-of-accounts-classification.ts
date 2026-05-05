export type ChartOfAccountsClassificationInput = {
  accountId?: string | null
  accountNumber?: string | null
  name?: string | null
  accountType?: string | null
  category?: string | null
  financialStatementCategory?: string | null
  rollforwardCategory?: string | null
  accountRole?: string | null
  parentAccountId?: string | null
  parentAccountNumber?: string | null
  parentAccountName?: string | null
  parentAccountCategory?: string | null
}

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern))
}

export function deriveAccountRole(input: ChartOfAccountsClassificationInput): string | null {
  const accountId = normalize(input.accountId || input.accountNumber)
  const name = normalize(input.name)
  const parentAccountId = normalize(input.parentAccountId || input.parentAccountNumber)
  const parentName = normalize(input.parentAccountName)
  const combinedName = [name, parentName].filter(Boolean).join(' ')
  const accountType = normalize(input.accountType)
  const category = normalize(input.category)
  const parentCategory = normalize(input.parentAccountCategory)
  const combinedCategory = [category, parentCategory].filter(Boolean).join(' ')
  const fsCategory = normalize(input.financialStatementCategory)
  const rollforwardCategory = normalize(input.rollforwardCategory) || normalize(deriveRollforwardCategory(input))

  if (accountType === 'asset' && rollforwardCategory === 'cash and cash equivalents') {
    if (
      ['1000', '1010'].includes(accountId)
      || ['1000', '1010'].includes(parentAccountId)
      || includesAny(combinedCategory, ['bank'])
      || includesAny(combinedName, ['bank', 'checking', 'savings', 'deposit', 'sweep', 'treasury'])
    ) {
      return 'Bank Account'
    }

    return 'Cash Account'
  }

  if (
    rollforwardCategory === 'accounts receivable'
    || includesAny(fsCategory, ['accounts receivable'])
    || includesAny(combinedName, ['accounts receivable', 'a/r', 'trade receivable'])
  ) {
    return 'AR Trade'
  }

  if (
    rollforwardCategory === 'accounts payable'
    || includesAny(fsCategory, ['accounts payable'])
    || includesAny(combinedName, ['accounts payable', 'a/p', 'trade payable'])
  ) {
    return 'AP Trade'
  }

  if (
    rollforwardCategory === 'deferred revenue'
    || includesAny(fsCategory, ['deferred revenue'])
    || includesAny(combinedName, ['deferred revenue', 'customer deposit', 'contract liability'])
  ) {
    return 'Deferred Revenue'
  }

  if (
    rollforwardCategory === 'prepaids and other current assets'
    || includesAny(fsCategory, ['prepaids'])
    || includesAny(combinedName, ['prepaid', 'deferred cost'])
  ) {
    return 'Prepaid Asset'
  }

  if (
    includesAny(combinedName, ['realized fx gain', 'foreign exchange gain', 'fx gain'])
    || (includesAny(fsCategory, ['fx']) && includesAny(combinedName, ['gain']))
  ) {
    return 'FX Gain'
  }

  if (
    includesAny(combinedName, ['realized fx loss', 'foreign exchange loss', 'fx loss'])
    || (includesAny(fsCategory, ['fx']) && includesAny(combinedName, ['loss']))
  ) {
    return 'FX Loss'
  }

  if (
    accountType === 'liability'
    && (
      includesAny(combinedName, ['sales tax payable', 'vat payable', 'tax payable'])
      || includesAny(fsCategory, ['tax payable'])
    )
  ) {
    return 'Tax Payable'
  }

  if (
    accountType === 'asset'
    && (
      includesAny(combinedName, ['sales tax receivable', 'vat receivable', 'tax receivable'])
      || includesAny(fsCategory, ['tax receivable'])
    )
  ) {
    return 'Tax Receivable'
  }

  return 'Not Applicable'
}

export function deriveRollforwardCategory(input: ChartOfAccountsClassificationInput): string | null {
  const accountId = normalize(input.accountId || input.accountNumber)
  const name = normalize(input.name)
  const parentAccountId = normalize(input.parentAccountId || input.parentAccountNumber)
  const parentName = normalize(input.parentAccountName)
  const combinedName = [name, parentName].filter(Boolean).join(' ')
  const accountType = normalize(input.accountType)
  const category = normalize(input.category)
  const parentCategory = normalize(input.parentAccountCategory)
  const combinedCategory = [category, parentCategory].filter(Boolean).join(' ')
  const fsCategory = normalize(input.financialStatementCategory)

  if (includesAny(combinedName, ['intercompany']) || includesAny(category, ['intercompany'])) {
    return 'Intercompany'
  }

  if (
    includesAny(combinedName, ['fx revaluation', 'foreign exchange revaluation', 'unrealized fx'])
    || includesAny(category, ['fx'])
    || includesAny(fsCategory, ['fx'])
  ) {
    return 'FX Revaluation'
  }

  if (includesAny(combinedName, ['accounts receivable', 'a/r']) || accountId === '1100' || parentAccountId === '1100' || includesAny(fsCategory, ['accounts receivable'])) {
    return 'Accounts Receivable'
  }

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
  ) {
    return 'Cash and Cash Equivalents'
  }

  if (includesAny(combinedName, ['inventory']) || includesAny(fsCategory, ['inventory'])) {
    return 'Inventory'
  }

  if (
    accountType === 'asset'
    && (
      includesAny(combinedName, ['accrued revenue', 'unbilled receivable', 'contract asset'])
      || includesAny(fsCategory, ['contract assets'])
    )
  ) {
    return 'Other Assets'
  }

  if (includesAny(combinedName, ['prepaid', 'deferred cost']) || includesAny(category, ['current asset']) && includesAny(fsCategory, ['prepaids'])) {
    return 'Prepaids and Other Current Assets'
  }

  if (includesAny(combinedName, ['fixed asset', 'property', 'equipment']) || includesAny(category, ['fixed asset']) || includesAny(fsCategory, ['fixed assets'])) {
    return 'Fixed Assets'
  }

  if (
    includesAny(combinedName, ['accumulated depreciation', 'accumulated amortization'])
    || includesAny(category, ['contra asset'])
    || accountId === '1310'
  ) {
    return 'Accumulated Depreciation and Amortization'
  }

  if (includesAny(combinedName, ['accounts payable', 'a/p']) || accountId === '2000' || parentAccountId === '2000' || includesAny(fsCategory, ['accounts payable'])) {
    return 'Accounts Payable'
  }

  if (includesAny(combinedName, ['accrued']) || accountId === '2100' || includesAny(fsCategory, ['accrued'])) {
    return 'Accrued Expenses'
  }

  if (includesAny(combinedName, ['deferred revenue', 'customer deposit']) || ['2200', '2210'].includes(accountId) || includesAny(fsCategory, ['deferred revenue'])) {
    return 'Deferred Revenue'
  }

  if (
    accountType === 'liability'
    && (
      includesAny(combinedName, ['deferred tax', 'income tax payable', 'sales tax payable', 'vat payable', 'tax payable'])
      || includesAny(fsCategory, ['tax payable', 'deferred tax'])
    )
  ) {
    return 'Other Liabilities'
  }

  if (includesAny(combinedName, ['debt', 'loan', 'note payable']) || accountId === '2500' || includesAny(fsCategory, ['debt'])) {
    return 'Debt'
  }

  if (accountType === 'equity' || includesAny(fsCategory, ['equity'])) {
    return 'Equity'
  }

  if (accountType === 'asset') {
    return includesAny(category, ['other asset', 'deferred tax']) || includesAny(fsCategory, ['other current assets', 'deferred tax'])
      ? 'Other Assets'
      : 'Not Applicable'
  }

  if (accountType === 'liability') {
    return includesAny(category, ['other liability', 'long term liability', 'deferred tax']) ? 'Other Liabilities' : 'Not Applicable'
  }

  return 'Not Applicable'
}

export function isCashBankPostingAccount(input: ChartOfAccountsClassificationInput) {
  const accountRole = normalize(input.accountRole)
  if (accountRole === 'bank account' || accountRole === 'cash account') return true

  const accountType = normalize(input.accountType)
  if (accountType !== 'asset') return false

  const rollforwardCategory = normalize(input.rollforwardCategory)
  if (rollforwardCategory === 'cash and cash equivalents') return true

  const derivedCategory = deriveRollforwardCategory(input)
  if (normalize(derivedCategory) === 'cash and cash equivalents') return true

  const accountId = normalize(input.accountId || input.accountNumber)
  const parentAccountId = normalize(input.parentAccountId || input.parentAccountNumber)
  if (['1000', '1010'].includes(accountId) || ['1000', '1010'].includes(parentAccountId)) return true

  const combinedCategory = [normalize(input.category), normalize(input.parentAccountCategory)].filter(Boolean).join(' ')
  if (includesAny(combinedCategory, ['bank'])) return true

  const combinedName = [normalize(input.name), normalize(input.parentAccountName)].filter(Boolean).join(' ')
  if (includesAny(combinedName, ['bank', 'checking'])) return true
  if (includesAny(combinedName, ['cash']) && !includesAny(combinedCategory, ['accounts receivable'])) return true

  return false
}
