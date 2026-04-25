import PurchaseRequisitionCreatePageClient from '@/components/PurchaseRequisitionCreatePageClient'
import { prisma } from '@/lib/prisma'
import { generateNextRequisitionNumber } from '@/lib/requisition-number'
import { loadPurchaseRequisitionDetailCustomization } from '@/lib/purchase-requisitions-detail-customization-store'

export default async function NewPurchaseRequisitionPage() {
  const [vendors, departments, subsidiaries, currencies, adminUser, nextNumber, customization] = await Promise.all([
    prisma.vendor.findMany({
      orderBy: { vendorNumber: 'asc' },
      where: { inactive: false },
      include: {
        subsidiary: { select: { id: true, subsidiaryId: true, name: true } },
        currency: { select: { id: true, currencyId: true, code: true, name: true } },
      },
    }),
    prisma.department.findMany({
      orderBy: { departmentId: 'asc' },
      where: { active: true },
      select: { id: true, departmentId: true, name: true },
    }),
    prisma.subsidiary.findMany({
      orderBy: { subsidiaryId: 'asc' },
      where: { active: true },
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.currency.findMany({
      orderBy: { code: 'asc' },
      where: { active: true },
      select: { id: true, currencyId: true, code: true, name: true },
    }),
    prisma.user.findUnique({
      where: { email: 'admin@example.com' },
      select: { id: true, userId: true, name: true, email: true },
    }),
    generateNextRequisitionNumber(),
    loadPurchaseRequisitionDetailCustomization(),
  ])

  const userLabel =
    adminUser?.userId && adminUser.name
      ? `${adminUser.userId} - ${adminUser.name}`
      : adminUser?.userId ?? adminUser?.name ?? adminUser?.email ?? ''

  return (
    <PurchaseRequisitionCreatePageClient
      nextNumber={nextNumber}
      userId={adminUser?.id ?? ''}
      userLabel={userLabel}
      vendors={vendors}
      departments={departments}
      subsidiaries={subsidiaries}
      currencies={currencies}
      customization={customization}
    />
  )
}
