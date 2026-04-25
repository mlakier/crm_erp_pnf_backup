import { prisma } from '@/lib/prisma'
import PurchaseOrderCreatePageClient from '@/components/PurchaseOrderCreatePageClient'
import { generateNextPurchaseOrderNumber } from '@/lib/purchase-order-number'
import { loadPurchaseOrderDetailCustomization } from '@/lib/purchase-order-detail-customization-store'
import { toNumericValue } from '@/lib/format'

export default async function NewPurchaseOrderPage() {
  const [adminUser, vendors, subsidiaries, items, nextNumber, customization] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'admin@example.com' } }),
    prisma.vendor.findMany({
      orderBy: { vendorNumber: 'asc' },
      select: {
        id: true,
        vendorNumber: true,
        name: true,
        email: true,
        phone: true,
        taxId: true,
        address: true,
        inactive: true,
        subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        currency: { select: { id: true, currencyId: true, code: true, name: true } },
      },
    }),
    prisma.subsidiary.findMany({
      orderBy: { subsidiaryId: 'asc' },
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.item.findMany({
      orderBy: [{ itemId: 'asc' }, { name: 'asc' }],
      select: { id: true, itemId: true, name: true, listPrice: true },
    }),
    generateNextPurchaseOrderNumber(),
    loadPurchaseOrderDetailCustomization(),
  ])

  if (!adminUser) {
    return <p className="p-8 text-white">No admin user found.</p>
  }

  const userLabel =
    adminUser.userId && adminUser.name
      ? `${adminUser.userId} - ${adminUser.name}`
      : adminUser.userId ?? adminUser.name ?? adminUser.email

  return (
    <PurchaseOrderCreatePageClient
      nextNumber={nextNumber}
      userId={adminUser.id}
      userLabel={userLabel}
      vendors={vendors}
      subsidiaries={subsidiaries}
      items={items.map((item) => ({ ...item, listPrice: toNumericValue(item.listPrice, 0) }))}
      customization={customization}
    />
  )
}
