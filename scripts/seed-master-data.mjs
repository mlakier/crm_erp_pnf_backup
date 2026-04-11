import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function currencyDisplayName(code) {
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'currency' })
    return display.of(code) || code
  } catch {
    return code
  }
}

async function seedCurrencies() {
  const codes = [
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'CHF',
    'CAD',
    'AUD',
    'CNY',
    'HKD',
    'SGD',
    'SEK',
    'NOK',
    'DKK',
    'NZD',
    'INR',
  ]

  for (const code of codes) {
    await prisma.currency.upsert({
      where: { code },
      update: {
        name: currencyDisplayName(code),
        symbol: null,
        decimals: 2,
        active: true,
      },
      create: {
        code,
        name: currencyDisplayName(code),
        symbol: null,
        decimals: 2,
        active: true,
      },
    })
  }

  return codes
}

async function seedEntities() {
  const preferredCurrencies = await prisma.currency.findMany({
    where: { code: { in: ['USD', 'EUR', 'GBP'] } },
  })

  const byCode = new Map(preferredCurrencies.map((c) => [c.code, c.id]))

  const entities = [
    {
      code: 'ENT-US',
      name: 'North America Entity',
      legalName: 'North America Entity LLC',
      entityType: 'Operating Company',
      defaultCurrencyId: byCode.get('USD') || null,
    },
    {
      code: 'ENT-EU',
      name: 'Europe Entity',
      legalName: 'Europe Entity GmbH',
      entityType: 'Operating Company',
      defaultCurrencyId: byCode.get('EUR') || null,
    },
    {
      code: 'ENT-UK',
      name: 'United Kingdom Entity',
      legalName: 'United Kingdom Entity Ltd',
      entityType: 'Operating Company',
      defaultCurrencyId: byCode.get('GBP') || null,
    },
  ]

  for (const entity of entities) {
    await prisma.entity.upsert({
      where: { code: entity.code },
      update: {
        name: entity.name,
        legalName: entity.legalName,
        entityType: entity.entityType,
        defaultCurrencyId: entity.defaultCurrencyId,
        active: true,
      },
      create: {
        ...entity,
        active: true,
      },
    })
  }
}

async function seedItems() {
  const entities = await prisma.entity.findMany({
    where: { code: { in: ['ENT-US', 'ENT-EU', 'ENT-UK'] } },
    orderBy: { code: 'asc' },
  })

  const currencies = await prisma.currency.findMany({
    where: { code: { in: ['USD', 'EUR', 'GBP'] } },
    orderBy: { code: 'asc' },
  })

  const itemTypes = ['service', 'product', 'expense']

  for (let i = 1; i <= 20; i += 1) {
    const entity = entities[(i - 1) % entities.length] || null
    const currency = currencies[(i - 1) % currencies.length] || null

    const itemNumber = `ITM-${String(i).padStart(4, '0')}`
    const sku = `SKU-${String(i).padStart(4, '0')}`

    await prisma.item.upsert({
      where: { itemNumber },
      update: {
        name: `Master Item ${String(i).padStart(2, '0')}`,
        sku,
        itemType: itemTypes[(i - 1) % itemTypes.length],
        uom: 'EA',
        listPrice: 50 + i * 10,
        entityId: entity?.id || null,
        currencyId: currency?.id || null,
        active: true,
      },
      create: {
        itemNumber,
        sku,
        name: `Master Item ${String(i).padStart(2, '0')}`,
        description: `Seeded master item ${i}`,
        itemType: itemTypes[(i - 1) % itemTypes.length],
        uom: 'EA',
        listPrice: 50 + i * 10,
        entityId: entity?.id || null,
        currencyId: currency?.id || null,
        active: true,
      },
    })
  }
}

async function seedEmployees() {
  const entities = await prisma.entity.findMany({
    where: { code: { in: ['ENT-US', 'ENT-EU', 'ENT-UK'] } },
    orderBy: { code: 'asc' },
  })

  const titles = [
    'Sales Manager',
    'Operations Analyst',
    'Account Executive',
    'Procurement Specialist',
    'Finance Analyst',
  ]

  for (let i = 1; i <= 20; i += 1) {
    const entity = entities[(i - 1) % entities.length] || null
    const firstName = `Employee${String(i).padStart(2, '0')}`
    const lastName = 'Seeded'
    const email = `employee${String(i).padStart(2, '0')}@example.com`

    await prisma.employee.upsert({
      where: { email },
      update: {
        firstName,
        lastName,
        title: titles[(i - 1) % titles.length],
        entityId: entity?.id || null,
        active: true,
      },
      create: {
        employeeNumber: `EMP-${String(i).padStart(4, '0')}`,
        firstName,
        lastName,
        email,
        title: titles[(i - 1) % titles.length],
        entityId: entity?.id || null,
        active: true,
      },
    })
  }
}

async function main() {
  const currencyCodes = await seedCurrencies()
  await seedEntities()
  await seedItems()
  await seedEmployees()

  const [currencyCount, entityCount, itemCount, employeeCount] = await Promise.all([
    prisma.currency.count(),
    prisma.entity.count({ where: { code: { in: ['ENT-US', 'ENT-EU', 'ENT-UK'] } } }),
    prisma.item.count({ where: { itemNumber: { startsWith: 'ITM-' } } }),
    prisma.employee.count({ where: { email: { endsWith: '@example.com' } } }),
  ])

  console.log('Seed complete:')
  console.log(`- Currencies created/available: ${currencyCount} (seed list size: ${currencyCodes.length})`)
  console.log(`- Entities seeded: ${entityCount}`)
  console.log(`- Items seeded: ${itemCount}`)
  console.log(`- Employees seeded: ${employeeCount}`)
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
