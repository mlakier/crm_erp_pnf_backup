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

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      name: 'Admin',
      password: passwordHash,
      role: 'admin',
    },
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      password: passwordHash,
      role: 'admin',
    },
  })

  const currencies = [
    { code: 'USD', symbol: '$', decimals: 2, isBase: true },
    { code: 'EUR', symbol: 'EUR', decimals: 2, isBase: false },
    { code: 'GBP', symbol: 'GBP', decimals: 2, isBase: false },
  ]

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {
        name: currencyDisplayName(currency.code),
        symbol: currency.symbol,
        decimals: currency.decimals,
        isBase: currency.isBase,
        active: true,
      },
      create: {
        code: currency.code,
        name: currencyDisplayName(currency.code),
        symbol: currency.symbol,
        decimals: currency.decimals,
        isBase: currency.isBase,
        active: true,
      },
    })
  }

  const currencyRecords = await prisma.currency.findMany({
    where: { code: { in: currencies.map((currency) => currency.code) } },
  })
  const currencyByCode = new Map(currencyRecords.map((currency) => [currency.code, currency]))

  const subsidiarySeeds = [
    {
      code: 'SUB-001',
      name: 'Main Subsidiary',
      legalName: 'Main Subsidiary LLC',
      entityType: 'Corporation',
      defaultCurrencyCode: 'USD',
    },
    {
      code: 'SUB-002',
      name: 'Europe Subsidiary',
      legalName: 'Europe Subsidiary GmbH',
      entityType: 'Corporation',
      defaultCurrencyCode: 'EUR',
    },
    {
      code: 'SUB-003',
      name: 'UK Subsidiary',
      legalName: 'UK Subsidiary Ltd',
      entityType: 'Corporation',
      defaultCurrencyCode: 'GBP',
    },
  ]

  for (const subsidiary of subsidiarySeeds) {
    await prisma.entity.upsert({
      where: { code: subsidiary.code },
      update: {
        name: subsidiary.name,
        legalName: subsidiary.legalName,
        entityType: subsidiary.entityType,
        defaultCurrencyId: currencyByCode.get(subsidiary.defaultCurrencyCode)?.id ?? null,
        active: true,
      },
      create: {
        code: subsidiary.code,
        name: subsidiary.name,
        legalName: subsidiary.legalName,
        entityType: subsidiary.entityType,
        defaultCurrencyId: currencyByCode.get(subsidiary.defaultCurrencyCode)?.id ?? null,
        active: true,
      },
    })
  }

  const subsidiaryRecords = await prisma.entity.findMany({
    where: { code: { in: subsidiarySeeds.map((subsidiary) => subsidiary.code) } },
  })
  const subsidiaryByCode = new Map(subsidiaryRecords.map((subsidiary) => [subsidiary.code, subsidiary]))

  const departmentSeeds = [
    {
      code: 'FIN',
      name: 'Finance',
      description: 'Accounting, AP, AR, and treasury operations.',
      division: 'Corporate',
      subsidiaryCode: 'SUB-001',
    },
    {
      code: 'HR',
      name: 'Human Resources',
      description: 'Talent acquisition, payroll, and employee operations.',
      division: 'Corporate',
      subsidiaryCode: 'SUB-001',
    },
    {
      code: 'OPS',
      name: 'Operations',
      description: 'Core operations, fulfillment, and process execution.',
      division: 'Operations',
      subsidiaryCode: 'SUB-002',
    },
    {
      code: 'SALES',
      name: 'Sales',
      description: 'Pipeline management and revenue generation.',
      division: 'Commercial',
      subsidiaryCode: 'SUB-003',
    },
  ]

  for (const department of departmentSeeds) {
    await prisma.department.upsert({
      where: { code: department.code },
      update: {
        name: department.name,
        description: department.description,
        division: department.division,
        entityId: subsidiaryByCode.get(department.subsidiaryCode)?.id ?? null,
        active: false,
      },
      create: {
        code: department.code,
        name: department.name,
        description: department.description,
        division: department.division,
        entityId: subsidiaryByCode.get(department.subsidiaryCode)?.id ?? null,
        active: false,
      },
    })
  }

  const departmentRecords = await prisma.department.findMany({
    where: { code: { in: departmentSeeds.map((department) => department.code) } },
  })
  const departmentByCode = new Map(departmentRecords.map((department) => [department.code, department]))

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
      where: { email: employee.email },
      update: {
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        title: employee.title,
        departmentId: departmentByCode.get(employee.departmentCode)?.id ?? null,
        entityId: subsidiaryByCode.get(employee.subsidiaryCode)?.id ?? null,
        active: true,
      },
      create: {
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        title: employee.title,
        departmentId: departmentByCode.get(employee.departmentCode)?.id ?? null,
        entityId: subsidiaryByCode.get(employee.subsidiaryCode)?.id ?? null,
        active: true,
      },
    })
  }

  const employeeRecords = await prisma.employee.findMany({
    where: { employeeNumber: { in: employeeSeeds.map((employee) => employee.employeeNumber) } },
  })
  const employeeByNumber = new Map(employeeRecords.map((employee) => [employee.employeeNumber, employee]))

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
      where: { code: departmentCode },
      data: {
        managerId: employeeByNumber.get(managerEmployeeNumber)?.id ?? null,
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
        entityId: subsidiaryByCode.get(customer.subsidiaryCode)?.id ?? null,
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
        entityId: subsidiaryByCode.get(customer.subsidiaryCode)?.id ?? null,
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
        entityId: subsidiaryByCode.get(vendor.subsidiaryCode)?.id ?? null,
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
        entityId: subsidiaryByCode.get(vendor.subsidiaryCode)?.id ?? null,
        currencyId: currencyByCode.get(vendor.currencyCode)?.id ?? null,
        inactive: false,
      },
    })
  }

  const itemSeeds = [
    {
      itemNumber: 'ITM-0001',
      sku: 'SKU-0001',
      name: 'Implementation Package',
      description: 'Initial implementation services package',
      itemType: 'service',
      uom: 'EA',
      listPrice: 1500,
      subsidiaryCode: 'SUB-001',
      currencyCode: 'USD',
    },
    {
      itemNumber: 'ITM-0002',
      sku: 'SKU-0002',
      name: 'Analytics Subscription',
      description: 'Annual analytics platform subscription',
      itemType: 'service',
      uom: 'YR',
      listPrice: 2400,
      subsidiaryCode: 'SUB-002',
      currencyCode: 'EUR',
    },
    {
      itemNumber: 'ITM-0003',
      sku: 'SKU-0003',
      name: 'Warehouse Scanner',
      description: 'Mobile barcode scanning device',
      itemType: 'product',
      uom: 'EA',
      listPrice: 425,
      subsidiaryCode: 'SUB-003',
      currencyCode: 'GBP',
    },
    {
      itemNumber: 'ITM-0004',
      sku: 'SKU-0004',
      name: 'Support Retainer',
      description: 'Monthly support retainer',
      itemType: 'expense',
      uom: 'MO',
      listPrice: 300,
      subsidiaryCode: 'SUB-001',
      currencyCode: 'USD',
    },
  ]

  for (const item of itemSeeds) {
    await prisma.item.upsert({
      where: { itemNumber: item.itemNumber },
      update: {
        sku: item.sku,
        name: item.name,
        description: item.description,
        itemType: item.itemType,
        uom: item.uom,
        listPrice: item.listPrice,
        entityId: subsidiaryByCode.get(item.subsidiaryCode)?.id ?? null,
        currencyId: currencyByCode.get(item.currencyCode)?.id ?? null,
        active: true,
      },
      create: {
        itemNumber: item.itemNumber,
        sku: item.sku,
        name: item.name,
        description: item.description,
        itemType: item.itemType,
        uom: item.uom,
        listPrice: item.listPrice,
        entityId: subsidiaryByCode.get(item.subsidiaryCode)?.id ?? null,
        currencyId: currencyByCode.get(item.currencyCode)?.id ?? null,
        active: true,
      },
    })
  }

  console.log('Seed completed: admin user plus currencies, subsidiaries, departments, employees, customers, contacts, vendors, and items')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })