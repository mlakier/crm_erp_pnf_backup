import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function ERPPage() {
  const [vendorCount, purchaseOrderCount] = await Promise.all([
    prisma.vendor.count(),
    prisma.purchaseOrder.count(),
  ])

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">
        <div className="rounded-2xl border p-8" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold text-white">ERP Overview</h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              This area now surfaces procurement and supplier data for your enterprise workflows.
            </p>
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <SummaryCard label="Vendors" value={vendorCount} description="Suppliers available in the system." />
              <SummaryCard label="Purchase Orders" value={purchaseOrderCount} description="Open orders in procurement." />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Procure-to-Pay" description="Requisitions, purchase orders, receipts, and vendor matching." />
              <FeatureCard title="Record-to-Report" description="Journal entries, financial reporting, and close management." />
            </div>
            <Link href="/dashboard" className="inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white sm:w-auto" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, description }: { label: string; value: number; description: string }) {
  return (
    <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--accent-primary-strong)' }}>{label}</p>
      <p className="mt-4 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{description}</p>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{description}</p>
    </div>
  )
}
