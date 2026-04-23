/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

function currencyDisplayName(code) {
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'currency' })
    return display.of(code) || code
  } catch {
    return code
  }
}

function deriveNormalBalance(accountType, category) {
  if (accountType === 'Asset' || accountType === 'Expense') return 'debit'
  if (category === 'Contra Asset' || category === 'Contra Revenue') return 'credit'
  if (accountType === 'Liability' || accountType === 'Equity' || accountType === 'Revenue') return 'credit'
  return null
}

function deriveFinancialStatementSection(accountType) {
  if (accountType === 'Asset' || accountType === 'Liability' || accountType === 'Equity') return 'Balance Sheet'
  if (accountType === 'Revenue' || accountType === 'Expense') return 'Income Statement'
  return null
}

function deriveCashFlowCategory(accountId, accountType) {
  if (accountType !== 'Asset' && accountType !== 'Liability' && accountType !== 'Equity') return null
  if (['1000', '1010'].includes(accountId)) return 'Operating'
  if (['1300', '1310'].includes(accountId)) return 'Investing'
  if (['2500', '3000'].includes(accountId)) return 'Financing'
  return 'Operating'
}

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10)

  // Ensure admin role exists
  const adminRole = await prisma.role.upsert({
    where: { roleId: 'ROLE-0001' },
    update: { name: 'admin' },
    create: { roleId: 'ROLE-0001', name: 'admin' },
  })

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      name: 'Admin',
      password: passwordHash,
      roleId: adminRole.id,
    },
    create: {
      email: 'admin@example.com',
      userId: 'USER-000001',
      name: 'Admin',
      password: passwordHash,
      roleId: adminRole.id,
    },
  })

  const currencies = [
    { code: 'USD', symbol: '$', decimals: 2, isBase: true },
    { code: 'EUR', symbol: 'EUR', decimals: 2, isBase: false },
    { code: 'GBP', symbol: 'GBP', decimals: 2, isBase: false },
  ]

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { currencyId: currency.code },
      update: {
        name: currencyDisplayName(currency.code),
        symbol: currency.symbol,
        decimals: currency.decimals,
        isBase: currency.isBase,
        active: true,
      },
      create: {
        currencyId: currency.code,
        name: currencyDisplayName(currency.code),
        symbol: currency.symbol,
        decimals: currency.decimals,
        isBase: currency.isBase,
        active: true,
      },
    })
  }

  const currencyRecords = await prisma.currency.findMany({
    where: { currencyId: { in: currencies.map((currency) => currency.code) } },
  })
  const currencyByCode = new Map(currencyRecords.map((currency) => [currency.currencyId, currency]))

  const subsidiarySeeds = [
    {
      subsidiaryId: 'SUB-001',
      name: 'Main Subsidiary',
      legalName: 'Main Subsidiary LLC',
      entityType: 'Corporation',
      defaultCurrencyCode: 'USD',
    },
    {
      subsidiaryId: 'SUB-002',
      name: 'Europe Subsidiary',
      legalName: 'Europe Subsidiary GmbH',
      entityType: 'Corporation',
      defaultCurrencyCode: 'EUR',
    },
    {
      subsidiaryId: 'SUB-003',
      name: 'UK Subsidiary',
      legalName: 'UK Subsidiary Ltd',
      entityType: 'Corporation',
      defaultCurrencyCode: 'GBP',
    },
  ]

  for (const subsidiary of subsidiarySeeds) {
    await prisma.subsidiary.upsert({
      where: { subsidiaryId: subsidiary.subsidiaryId },
      update: {
        name: subsidiary.name,
        legalName: subsidiary.legalName,
        entityType: subsidiary.entityType,
        defaultCurrencyId: currencyByCode.get(subsidiary.defaultCurrencyCode)?.id ?? null,
        functionalCurrencyId: currencyByCode.get(subsidiary.defaultCurrencyCode)?.id ?? null,
        reportingCurrencyId: currencyByCode.get('USD')?.id ?? null,
        consolidationMethod: 'full',
        retainedEarningsAccountId: null,
        active: true,
      },
      create: {
        subsidiaryId: subsidiary.subsidiaryId,
        name: subsidiary.name,
        legalName: subsidiary.legalName,
        entityType: subsidiary.entityType,
        defaultCurrencyId: currencyByCode.get(subsidiary.defaultCurrencyCode)?.id ?? null,
        functionalCurrencyId: currencyByCode.get(subsidiary.defaultCurrencyCode)?.id ?? null,
        reportingCurrencyId: currencyByCode.get('USD')?.id ?? null,
        consolidationMethod: 'full',
        retainedEarningsAccountId: null,
        active: true,
      },
    })
  }

  const subsidiaryRecords = await prisma.subsidiary.findMany({
    where: { subsidiaryId: { in: subsidiarySeeds.map((subsidiary) => subsidiary.subsidiaryId) } },
  })
  const subsidiaryByCode = new Map(subsidiaryRecords.map((subsidiary) => [subsidiary.subsidiaryId, subsidiary]))

  const chartOfAccountSeeds = [
    { accountId: '1000', name: 'Cash - Operating', accountType: 'Asset', category: 'Current Asset' },
    { accountId: '1010', name: 'Cash - Payroll', accountType: 'Asset', category: 'Current Asset' },
    { accountId: '1100', name: 'Accounts Receivable', accountType: 'Asset', category: 'Current Asset' },
    { accountId: '1110', name: 'Allowance for Doubtful Accounts', accountType: 'Asset', category: 'Contra Asset' },
    { accountId: '1200', name: 'Inventory', accountType: 'Asset', category: 'Current Asset', inventory: true },
    { accountId: '1210', name: 'Inventory - Finished Goods', accountType: 'Asset', category: 'Current Asset', inventory: true },
    { accountId: '1220', name: 'Deferred Costs', accountType: 'Asset', category: 'Current Asset' },
    { accountId: '1230', name: 'Prepaid Expenses', accountType: 'Asset', category: 'Current Asset' },
    { accountId: '1300', name: 'Fixed Assets', accountType: 'Asset', category: 'Fixed Asset' },
    { accountId: '1310', name: 'Accumulated Depreciation', accountType: 'Asset', category: 'Contra Asset' },
    { accountId: '1400', name: 'Other Assets', accountType: 'Asset', category: 'Other Asset' },
    { accountId: '2000', name: 'Accounts Payable', accountType: 'Liability', category: 'Current Liability' },
    { accountId: '2100', name: 'Accrued Expenses', accountType: 'Liability', category: 'Current Liability' },
    { accountId: '2200', name: 'Deferred Revenue', accountType: 'Liability', category: 'Current Liability' },
    { accountId: '2210', name: 'Customer Deposits', accountType: 'Liability', category: 'Current Liability' },
    { accountId: '2300', name: 'Sales Tax Payable', accountType: 'Liability', category: 'Current Liability' },
    { accountId: '2400', name: 'Payroll Liabilities', accountType: 'Liability', category: 'Current Liability' },
    { accountId: '2500', name: 'Long-Term Debt', accountType: 'Liability', category: 'Long Term Liability' },
    { accountId: '3000', name: 'Common Stock', accountType: 'Equity', category: 'Equity' },
    { accountId: '3100', name: 'Retained Earnings', accountType: 'Equity', category: 'Equity' },
    { accountId: '3200', name: 'Current Year Earnings', accountType: 'Equity', category: 'Equity' },
    { accountId: '4000', name: 'Product Revenue', accountType: 'Revenue', category: 'Operating Revenue' },
    { accountId: '4010', name: 'Service Revenue', accountType: 'Revenue', category: 'Operating Revenue' },
    { accountId: '4020', name: 'Subscription Revenue', accountType: 'Revenue', category: 'Operating Revenue' },
    { accountId: '4030', name: 'Professional Services Revenue', accountType: 'Revenue', category: 'Operating Revenue' },
    { accountId: '4040', name: 'Shipping Revenue', accountType: 'Revenue', category: 'Operating Revenue' },
    { accountId: '4050', name: 'Discounts and Allowances', accountType: 'Revenue', category: 'Contra Revenue' },
    { accountId: '5000', name: 'Cost of Goods Sold', accountType: 'Expense', category: 'Cost of Sales' },
    { accountId: '5010', name: 'Cost of Services', accountType: 'Expense', category: 'Cost of Sales' },
    { accountId: '5020', name: 'Deferred Cost Amortization', accountType: 'Expense', category: 'Cost of Sales' },
    { accountId: '5030', name: 'Inventory Adjustments', accountType: 'Expense', category: 'Cost of Sales' },
    { accountId: '6000', name: 'Payroll Expense', accountType: 'Expense', category: 'Operating Expense' },
    { accountId: '6100', name: 'Rent Expense', accountType: 'Expense', category: 'Operating Expense' },
    { accountId: '6200', name: 'Software Expense', accountType: 'Expense', category: 'Operating Expense' },
    { accountId: '6300', name: 'Marketing Expense', accountType: 'Expense', category: 'Operating Expense' },
    { accountId: '6400', name: 'Travel and Entertainment', accountType: 'Expense', category: 'Operating Expense' },
    { accountId: '6500', name: 'Office Supplies Expense', accountType: 'Expense', category: 'Operating Expense' },
    { accountId: '6600', name: 'Depreciation Expense', accountType: 'Expense', category: 'Operating Expense' },
    { accountId: '6700', name: 'Bank Fees', accountType: 'Expense', category: 'Operating Expense' },
    { accountId: '6800', name: 'Miscellaneous Expense', accountType: 'Expense', category: 'Operating Expense' },
  ]

  for (const account of chartOfAccountSeeds) {
    await prisma.chartOfAccounts.upsert({
      where: { accountId: account.accountId },
      update: {
        name: account.name,
        accountType: account.accountType,
        category: account.category,
        normalBalance: deriveNormalBalance(account.accountType, account.category),
        financialStatementSection: deriveFinancialStatementSection(account.accountType),
        financialStatementGroup: account.category ?? null,
        isPosting: !Boolean(account.summary),
        isControlAccount: ['1100', '2000', '1200', '1210', '2200'].includes(account.accountId),
        allowsManualPosting: !['1100', '2000', '1200', '1210', '2200'].includes(account.accountId),
        requiresSubledgerType:
          account.accountId === '1100'
            ? 'customer'
            : account.accountId === '2000'
              ? 'vendor'
              : account.inventory
                ? 'item'
                : null,
        cashFlowCategory: deriveCashFlowCategory(account.accountId, account.accountType),
        inventory: Boolean(account.inventory),
        active: true,
      },
      create: {
        accountId: account.accountId,
        name: account.name,
        accountType: account.accountType,
        category: account.category,
        normalBalance: deriveNormalBalance(account.accountType, account.category),
        financialStatementSection: deriveFinancialStatementSection(account.accountType),
        financialStatementGroup: account.category ?? null,
        isPosting: !Boolean(account.summary),
        isControlAccount: ['1100', '2000', '1200', '1210', '2200'].includes(account.accountId),
        allowsManualPosting: !['1100', '2000', '1200', '1210', '2200'].includes(account.accountId),
        requiresSubledgerType:
          account.accountId === '1100'
            ? 'customer'
            : account.accountId === '2000'
              ? 'vendor'
              : account.inventory
                ? 'item'
                : null,
        cashFlowCategory: deriveCashFlowCategory(account.accountId, account.accountType),
        inventory: Boolean(account.inventory),
        active: true,
      },
    })
  }

  const chartOfAccounts = await prisma.chartOfAccounts.findMany({
    where: { accountId: { in: chartOfAccountSeeds.map((account) => account.accountId) } },
  })
  const glAccountByNumber = new Map(chartOfAccounts.map((account) => [account.accountId, account]))

  const revRecTemplateSeeds = [
    { templateId: 'RRT-POINT', name: 'Point in Time Delivery', recognitionMethod: 'point_in_time', scheduleType: 'delivery' },
    { templateId: 'RRT-RATABLE-12', name: 'Ratable 12 Month', recognitionMethod: 'over_time', scheduleType: 'monthly', defaultTermMonths: 12 },
    { templateId: 'RRT-RATABLE-MONTHLY', name: 'Monthly Service', recognitionMethod: 'over_time', scheduleType: 'monthly' },
  ]

  for (const template of revRecTemplateSeeds) {
    await prisma.revRecTemplate.upsert({
      where: { templateId: template.templateId },
      update: {
        name: template.name,
        recognitionMethod: template.recognitionMethod,
        scheduleType: template.scheduleType,
        defaultTermMonths: template.defaultTermMonths ?? null,
        active: true,
      },
      create: {
        templateId: template.templateId,
        name: template.name,
        recognitionMethod: template.recognitionMethod,
        scheduleType: template.scheduleType,
        defaultTermMonths: template.defaultTermMonths ?? null,
        active: true,
      },
    })
  }

  const revRecTemplates = await prisma.revRecTemplate.findMany({
    where: { templateId: { in: revRecTemplateSeeds.map((template) => template.templateId) } },
  })
  const revRecTemplateByCode = new Map(revRecTemplates.map((template) => [template.templateId, template]))

  const departmentSeeds = [
    {
      departmentId: 'FIN',
      name: 'Finance',
      description: 'Accounting, AP, AR, and treasury operations.',
      division: 'Corporate',
      subsidiaryCode: 'SUB-001',
    },
    {
      departmentId: 'HR',
      name: 'Human Resources',
      description: 'Talent acquisition, payroll, and employee operations.',
      division: 'Corporate',
      subsidiaryCode: 'SUB-001',
    },
    {
      departmentId: 'OPS',
      name: 'Operations',
      description: 'Core operations, fulfillment, and process execution.',
      division: 'Operations',
      subsidiaryCode: 'SUB-002',
    },
    {
      departmentId: 'SALES',
      name: 'Sales',
      description: 'Pipeline management and revenue generation.',
      division: 'Commercial',
      subsidiaryCode: 'SUB-003',
    },
  ]

  for (const department of departmentSeeds) {
    await prisma.department.upsert({
      where: { departmentId: department.departmentId },
      update: {
        name: department.name,
        description: department.description,
        division: department.division,
        subsidiaryId: subsidiaryByCode.get(department.subsidiaryCode)?.id ?? null,
        active: false,
      },
      create: {
        departmentId: department.departmentId,
        name: department.name,
        description: department.description,
        division: department.division,
        subsidiaryId: subsidiaryByCode.get(department.subsidiaryCode)?.id ?? null,
        active: false,
      },
    })
  }

  const departmentRecords = await prisma.department.findMany({
    where: { departmentId: { in: departmentSeeds.map((department) => department.departmentId) } },
  })
  const departmentByCode = new Map(departmentRecords.map((department) => [department.departmentId, department]))

  const employeeSeeds = [
    {
      employeeNumber: 'EMP-0001',
      firstName: 'Ava',
      lastName: 'Morris',
      email: 'ava.morris@example.com',
      title: 'Finance Director',
      departmentCode: 'FIN',
      subsidiaryCode: 'SUB-001',
      managerEmployeeNumber: null,
    },
    {
      employeeNumber: 'EMP-0002',
      firstName: 'Noah',
      lastName: 'Patel',
      email: 'noah.patel@example.com',
      title: 'HR Manager',
      departmentCode: 'HR',
      subsidiaryCode: 'SUB-001',
      managerEmployeeNumber: null,
    },
    {
      employeeNumber: 'EMP-0003',
      firstName: 'Mia',
      lastName: 'Chen',
      email: 'mia.chen@example.com',
      title: 'Operations Lead',
      departmentCode: 'OPS',
      subsidiaryCode: 'SUB-002',
      managerEmployeeNumber: null,
    },
    {
      employeeNumber: 'EMP-0004',
      firstName: 'Liam',
      lastName: 'Brooks',
      email: 'liam.brooks@example.com',
      title: 'Sales Director',
      departmentCode: 'SALES',
      subsidiaryCode: 'SUB-003',
      managerEmployeeNumber: null,
    },
    {
      employeeNumber: 'EMP-0005',
      firstName: 'Ella',
      lastName: 'Rivera',
      email: 'ella.rivera@example.com',
      title: 'Senior Accountant',
      departmentCode: 'FIN',
      subsidiaryCode: 'SUB-001',
      managerEmployeeNumber: 'EMP-0001',
    },
    {
      employeeNumber: 'EMP-0006',
      firstName: 'James',
      lastName: 'Walker',
      email: 'james.walker@example.com',
      title: 'Account Executive',
      departmentCode: 'SALES',
      subsidiaryCode: 'SUB-003',
      managerEmployeeNumber: 'EMP-0004',
    },
  ]

  for (const employee of employeeSeeds) {
    await prisma.employee.upsert({
      where: { employeeId: employee.employeeNumber },
      update: {
        employeeId: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        title: employee.title,
        departmentId: departmentByCode.get(employee.departmentCode)?.id ?? null,
        subsidiaryId: subsidiaryByCode.get(employee.subsidiaryCode)?.id ?? null,
        active: true,
      },
      create: {
        employeeId: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        title: employee.title,
        departmentId: departmentByCode.get(employee.departmentCode)?.id ?? null,
        subsidiaryId: subsidiaryByCode.get(employee.subsidiaryCode)?.id ?? null,
        active: true,
      },
    })
  }

  const employeeRecords = await prisma.employee.findMany({
    where: { employeeId: { in: employeeSeeds.map((employee) => employee.employeeNumber) } },
  })
  const employeeByNumber = new Map(employeeRecords.map((employee) => [employee.employeeId, employee]))

  for (const employee of employeeSeeds) {
    if (!employee.managerEmployeeNumber) continue

    await prisma.employee.update({
      where: { email: employee.email },
      data: {
        managerId: employeeByNumber.get(employee.managerEmployeeNumber)?.id ?? null,
      },
    })
  }

  const managerAssignments = [
    ['FIN', 'EMP-0001'],
    ['HR', 'EMP-0002'],
    ['OPS', 'EMP-0003'],
    ['SALES', 'EMP-0004'],
  ]

  for (const [departmentCode, managerEmployeeNumber] of managerAssignments) {
    await prisma.department.update({
      where: { departmentId: departmentCode },
      data: {
        managerEmployeeId: employeeByNumber.get(managerEmployeeNumber)?.id ?? null,
      },
    })
  }

  const customerSeeds = [
    {
      customerNumber: 'CUST-000001',
      name: 'Acme Corporation',
      email: 'ap@acme.example',
      phone: '8185550101',
      address: '123 Business St, Los Angeles, CA 90001',
      industry: 'Technology',
      subsidiaryCode: 'SUB-001',
      currencyCode: 'USD',
    },
    {
      customerNumber: 'CUST-000002',
      name: 'Euro Trade Partners',
      email: 'hello@eurotrade.example',
      phone: '493012345678',
      address: '45 Alexanderplatz, Berlin 10178, Germany',
      industry: 'Manufacturing',
      subsidiaryCode: 'SUB-002',
      currencyCode: 'EUR',
    },
    {
      customerNumber: 'CUST-000003',
      name: 'Britannia Retail Group',
      email: 'finance@britannia.example',
      phone: '442079460000',
      address: '80 Strand, London WC2R 0RL, United Kingdom',
      industry: 'Retail',
      subsidiaryCode: 'SUB-003',
      currencyCode: 'GBP',
    },
  ]

  for (const customer of customerSeeds) {
    await prisma.customer.upsert({
      where: { customerId: customer.customerNumber },
      update: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        industry: customer.industry,
        subsidiaryId: subsidiaryByCode.get(customer.subsidiaryCode)?.id ?? null,
        currencyId: currencyByCode.get(customer.currencyCode)?.id ?? null,
        inactive: false,
        userId: adminUser.id,
      },
      create: {
        customerId: customer.customerNumber,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        industry: customer.industry,
        subsidiaryId: subsidiaryByCode.get(customer.subsidiaryCode)?.id ?? null,
        currencyId: currencyByCode.get(customer.currencyCode)?.id ?? null,
        inactive: false,
        userId: adminUser.id,
      },
    })
  }

  const customerRecords = await prisma.customer.findMany({
    where: { customerId: { in: customerSeeds.map((customer) => customer.customerNumber) } },
  })
  const customerByNumber = new Map(customerRecords.map((customer) => [customer.customerId, customer]))

  const contactSeeds = [
    {
      contactNumber: 'CONT-000001',
      firstName: 'Alice',
      lastName: 'Nguyen',
      email: 'alice.nguyen@acme.example',
      phone: '8185550201',
      position: 'Procurement Manager',
      customerNumber: 'CUST-000001',
    },
    {
      contactNumber: 'CONT-000002',
      firstName: 'Bruno',
      lastName: 'Schmidt',
      email: 'bruno.schmidt@eurotrade.example',
      phone: '493012300001',
      position: 'Finance Manager',
      customerNumber: 'CUST-000002',
    },
    {
      contactNumber: 'CONT-000003',
      firstName: 'Charlotte',
      lastName: 'Bennett',
      email: 'charlotte.bennett@britannia.example',
      phone: '442079460101',
      position: 'Operations Director',
      customerNumber: 'CUST-000003',
    },
  ]

  for (const contact of contactSeeds) {
    await prisma.contact.upsert({
      where: { contactNumber: contact.contactNumber },
      update: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        position: contact.position,
        customerId: customerByNumber.get(contact.customerNumber)?.id,
        active: true,
        userId: adminUser.id,
      },
      create: {
        contactNumber: contact.contactNumber,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        position: contact.position,
        customerId: customerByNumber.get(contact.customerNumber)?.id,
        active: true,
        userId: adminUser.id,
      },
    })
  }

  const vendorSeeds = [
    {
      vendorNumber: 'VEND-000001',
      name: 'Pacific Office Supply',
      email: 'orders@pacificoffice.example',
      phone: '8185550301',
      address: '250 Market St, Los Angeles, CA 90012',
      taxId: 'US-11-1111111',
      subsidiaryCode: 'SUB-001',
      currencyCode: 'USD',
    },
    {
      vendorNumber: 'VEND-000002',
      name: 'Euro Components GmbH',
      email: 'sales@eurocomponents.example',
      phone: '493012300200',
      address: '18 Friedrichstrasse, Berlin 10969, Germany',
      taxId: 'DE-22-2222222',
      subsidiaryCode: 'SUB-002',
      currencyCode: 'EUR',
    },
    {
      vendorNumber: 'VEND-000003',
      name: 'Britannia Industrial Ltd',
      email: 'procurement@britanniaindustrial.example',
      phone: '442079460303',
      address: '12 King William St, London EC4N 7HR, United Kingdom',
      taxId: 'UK-33-3333333',
      subsidiaryCode: 'SUB-003',
      currencyCode: 'GBP',
    },
  ]

  for (const vendor of vendorSeeds) {
    await prisma.vendor.upsert({
      where: { vendorNumber: vendor.vendorNumber },
      update: {
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        taxId: vendor.taxId,
        subsidiaryId: subsidiaryByCode.get(vendor.subsidiaryCode)?.id ?? null,
        currencyId: currencyByCode.get(vendor.currencyCode)?.id ?? null,
        inactive: false,
      },
      create: {
        vendorNumber: vendor.vendorNumber,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        taxId: vendor.taxId,
        subsidiaryId: subsidiaryByCode.get(vendor.subsidiaryCode)?.id ?? null,
        currencyId: currencyByCode.get(vendor.currencyCode)?.id ?? null,
        inactive: false,
      },
    })
  }

  const itemSeeds = [
    {
      itemId: 'ITM-0001',
      sku: 'SKU-0001',
      name: 'Implementation Package',
      description: 'Initial implementation services package',
      itemType: 'service',
      revenueStream: 'professional_services',
      recognitionMethod: 'point_in_time',
      recognitionTrigger: 'delivery',
      revRecTemplateCode: 'RRT-POINT',
      isDistinctPerformanceObligation: true,
      standaloneSellingPrice: 1500,
      billingType: 'one_time',
      uom: 'EA',
      listPrice: 1500,
      standardCost: 650,
      subsidiaryCode: 'SUB-001',
      currencyCode: 'USD',
      incomeAccountNumber: '4030',
      deferredRevenueAccountNumber: '2200',
      cogsExpenseAccountNumber: '5010',
      deferredCostAccountNumber: '1220',
      directRevenuePosting: true,
    },
    {
      itemId: 'ITM-0002',
      sku: 'SKU-0002',
      name: 'Analytics Subscription',
      description: 'Annual analytics platform subscription',
      itemType: 'service',
      revenueStream: 'subscription',
      recognitionMethod: 'over_time',
      recognitionTrigger: 'ratable',
      revRecTemplateCode: 'RRT-RATABLE-12',
      defaultTermMonths: 12,
      isDistinctPerformanceObligation: true,
      standaloneSellingPrice: 2400,
      billingType: 'recurring',
      uom: 'YR',
      listPrice: 2400,
      standardCost: 480,
      subsidiaryCode: 'SUB-002',
      currencyCode: 'EUR',
      incomeAccountNumber: '4020',
      deferredRevenueAccountNumber: '2200',
      cogsExpenseAccountNumber: '5010',
      deferredCostAccountNumber: '1220',
      directRevenuePosting: false,
    },
    {
      itemId: 'ITM-0003',
      sku: 'SKU-0003',
      name: 'Warehouse Scanner',
      description: 'Mobile barcode scanning device',
      itemType: 'product',
      revenueStream: 'product',
      recognitionMethod: 'point_in_time',
      recognitionTrigger: 'shipment',
      revRecTemplateCode: 'RRT-POINT',
      isDistinctPerformanceObligation: true,
      standaloneSellingPrice: 425,
      billingType: 'one_time',
      uom: 'EA',
      listPrice: 425,
      standardCost: 240,
      averageCost: 255,
      subsidiaryCode: 'SUB-003',
      currencyCode: 'GBP',
      incomeAccountNumber: '4000',
      inventoryAccountNumber: '1210',
      cogsExpenseAccountNumber: '5000',
      directRevenuePosting: false,
    },
    {
      itemId: 'ITM-0004',
      sku: 'SKU-0004',
      name: 'Support Retainer',
      description: 'Monthly support retainer',
      itemType: 'expense',
      revenueStream: 'support',
      recognitionMethod: 'over_time',
      recognitionTrigger: 'ratable',
      revRecTemplateCode: 'RRT-RATABLE-MONTHLY',
      defaultTermMonths: 1,
      isDistinctPerformanceObligation: true,
      standaloneSellingPrice: 300,
      billingType: 'recurring',
      uom: 'MO',
      listPrice: 300,
      standardCost: 90,
      subsidiaryCode: 'SUB-001',
      currencyCode: 'USD',
      cogsExpenseAccountNumber: '6800',
      directRevenuePosting: false,
    },
  ]

  for (const item of itemSeeds) {
    await prisma.item.upsert({
      where: { itemId: item.itemId },
      update: {
        sku: item.sku,
        name: item.name,
        description: item.description,
        itemType: item.itemType,
        revenueStream: item.revenueStream ?? null,
        recognitionMethod: item.recognitionMethod ?? null,
        recognitionTrigger: item.recognitionTrigger ?? null,
        defaultRevRecTemplateId: revRecTemplateByCode.get(item.revRecTemplateCode)?.id ?? null,
        defaultTermMonths: item.defaultTermMonths ?? null,
        isDistinctPerformanceObligation: item.isDistinctPerformanceObligation !== false,
        standaloneSellingPrice: item.standaloneSellingPrice ?? null,
        billingType: item.billingType ?? null,
        uom: item.uom,
        listPrice: item.listPrice,
        standardCost: item.standardCost ?? null,
        averageCost: item.averageCost ?? null,
        subsidiaryId: subsidiaryByCode.get(item.subsidiaryCode)?.id ?? null,
        currencyId: currencyByCode.get(item.currencyCode)?.id ?? null,
        incomeAccountId: glAccountByNumber.get(item.incomeAccountNumber)?.id ?? null,
        deferredRevenueAccountId: glAccountByNumber.get(item.deferredRevenueAccountNumber)?.id ?? null,
        inventoryAccountId: glAccountByNumber.get(item.inventoryAccountNumber)?.id ?? null,
        cogsExpenseAccountId: glAccountByNumber.get(item.cogsExpenseAccountNumber)?.id ?? null,
        deferredCostAccountId: glAccountByNumber.get(item.deferredCostAccountNumber)?.id ?? null,
        directRevenuePosting: Boolean(item.directRevenuePosting),
        active: true,
      },
      create: {
        itemId: item.itemId,
        sku: item.sku,
        name: item.name,
        description: item.description,
        itemType: item.itemType,
        revenueStream: item.revenueStream ?? null,
        recognitionMethod: item.recognitionMethod ?? null,
        recognitionTrigger: item.recognitionTrigger ?? null,
        defaultRevRecTemplateId: revRecTemplateByCode.get(item.revRecTemplateCode)?.id ?? null,
        defaultTermMonths: item.defaultTermMonths ?? null,
        isDistinctPerformanceObligation: item.isDistinctPerformanceObligation !== false,
        standaloneSellingPrice: item.standaloneSellingPrice ?? null,
        billingType: item.billingType ?? null,
        uom: item.uom,
        listPrice: item.listPrice,
        standardCost: item.standardCost ?? null,
        averageCost: item.averageCost ?? null,
        subsidiaryId: subsidiaryByCode.get(item.subsidiaryCode)?.id ?? null,
        currencyId: currencyByCode.get(item.currencyCode)?.id ?? null,
        incomeAccountId: glAccountByNumber.get(item.incomeAccountNumber)?.id ?? null,
        deferredRevenueAccountId: glAccountByNumber.get(item.deferredRevenueAccountNumber)?.id ?? null,
        inventoryAccountId: glAccountByNumber.get(item.inventoryAccountNumber)?.id ?? null,
        cogsExpenseAccountId: glAccountByNumber.get(item.cogsExpenseAccountNumber)?.id ?? null,
        deferredCostAccountId: glAccountByNumber.get(item.deferredCostAccountNumber)?.id ?? null,
        directRevenuePosting: Boolean(item.directRevenuePosting),
        active: true,
      },
    })
  }

  const retainedEarningsAccountId = glAccountByNumber.get('3100')?.id ?? null
  const deferredRevenueAccountId = glAccountByNumber.get('2200')?.id ?? null
  const inventoryAccountId = glAccountByNumber.get('1210')?.id ?? null

  for (const subsidiary of subsidiarySeeds) {
    await prisma.subsidiary.update({
      where: { subsidiaryId: subsidiary.subsidiaryId },
      data: {
        retainedEarningsAccountId,
        ctaAccountId: null,
        intercompanyClearingAccountId: deferredRevenueAccountId,
        dueToAccountId: deferredRevenueAccountId,
        dueFromAccountId: inventoryAccountId,
      },
    })
  }

  console.log('Seed completed: admin user plus currencies, subsidiaries, chart of accounts, rev rec templates, departments, employees, customers, contacts, vendors, and items')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
