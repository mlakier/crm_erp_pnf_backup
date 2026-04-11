import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const preferred = await prisma.entity.findFirst({ where: { code: 'ENT-US' } })
  const fallback = preferred ?? await prisma.entity.findFirst({ orderBy: { createdAt: 'asc' } })

  if (!fallback) {
    console.log('No subsidiaries/entities found. Nothing to backfill.')
    return
  }

  const [customerResult, vendorResult] = await Promise.all([
    prisma.customer.updateMany({
      where: { entityId: null },
      data: { entityId: fallback.id },
    }),
    prisma.vendor.updateMany({
      where: { entityId: null },
      data: { entityId: fallback.id },
    }),
  ])

  const customersNeedingCurrency = await prisma.customer.findMany({
    where: { currencyId: null, entityId: { not: null } },
    select: { id: true, entity: { select: { defaultCurrencyId: true } } },
  })

  const vendorsNeedingCurrency = await prisma.vendor.findMany({
    where: { currencyId: null, entityId: { not: null } },
    select: { id: true, entity: { select: { defaultCurrencyId: true } } },
  })

  let customerCurrencyUpdated = 0
  for (const row of customersNeedingCurrency) {
    const defaultCurrencyId = row.entity?.defaultCurrencyId
    if (!defaultCurrencyId) continue
    await prisma.customer.update({ where: { id: row.id }, data: { currencyId: defaultCurrencyId } })
    customerCurrencyUpdated += 1
  }

  let vendorCurrencyUpdated = 0
  for (const row of vendorsNeedingCurrency) {
    const defaultCurrencyId = row.entity?.defaultCurrencyId
    if (!defaultCurrencyId) continue
    await prisma.vendor.update({ where: { id: row.id }, data: { currencyId: defaultCurrencyId } })
    vendorCurrencyUpdated += 1
  }

  const [remainingCustomers, remainingVendors] = await Promise.all([
    prisma.customer.count({ where: { entityId: null } }),
    prisma.vendor.count({ where: { entityId: null } }),
  ])

  const [remainingCustomerCurrencies, remainingVendorCurrencies] = await Promise.all([
    prisma.customer.count({ where: { currencyId: null } }),
    prisma.vendor.count({ where: { currencyId: null } }),
  ])

  console.log('Primary subsidiary backfill complete:')
  console.log(`- Subsidiary used: ${fallback.code} (${fallback.name})`)
  console.log(`- Customers updated: ${customerResult.count}`)
  console.log(`- Vendors updated: ${vendorResult.count}`)
  console.log(`- Customer currencies backfilled: ${customerCurrencyUpdated}`)
  console.log(`- Vendor currencies backfilled: ${vendorCurrencyUpdated}`)
  console.log(`- Customers still null: ${remainingCustomers}`)
  console.log(`- Vendors still null: ${remainingVendors}`)
  console.log(`- Customers with null currency: ${remainingCustomerCurrencies}`)
  console.log(`- Vendors with null currency: ${remainingVendorCurrencies}`)
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
