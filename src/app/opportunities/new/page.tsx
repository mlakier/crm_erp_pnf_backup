import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import OpportunityCreateForm from '@/components/OpportunityCreateForm'
import { loadListOptionsForSource } from '@/lib/list-source'

export default async function NewOpportunityPage() {
  const [adminUser, customers, items, stageOptions] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'admin@example.com' } }),
    prisma.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.item.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, listPrice: true, itemId: true },
    }),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-OPP-STAGE' }),
  ])

  if (!adminUser) {
    return <p className="p-8 text-white">No admin user found.</p>
  }

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-4xl">
        <Link href="/opportunities" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          ← Back to Opportunities
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-white">New Opportunity</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Opportunity ID is generated automatically when the record is created.
        </p>
        <div className="mt-6">
          <OpportunityCreateForm userId={adminUser.id} customers={customers} items={items} stageOptions={stageOptions} fullPage />
        </div>
      </div>
    </div>
  )
}
