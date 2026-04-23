import { prisma } from '@/lib/prisma'

export default async function APPortalPage() {
  const [vendorCount, purchaseOrderCount] = await Promise.all([
    prisma.vendor.count(),
    prisma.purchaseOrder.count(),
  ])

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">
        <div className="rounded-2xl border p-8" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h1 className="text-xl font-semibold text-white">AP Portal</h1>
          <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
            The AP portal now includes supplier and order counts to give visibility into payable activity.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <SummaryCard label="Vendors" value={vendorCount} description="Suppliers configured for AP." />
            <SummaryCard label="Purchase Orders" value={purchaseOrderCount} description="POs available for matching." />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <FeatureCard title="Invoice Intake" description="Monitor invoices, attachments, and document OCR workflows." />
            <FeatureCard title="Approval Workflows" description="Route invoices for review, exceptions, and payment readiness." />
          </div>

        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, description }: { label: string; value: number; description: string }) {
  return (
    <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--card-elevated)', borderColor: 'var(--border-muted)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--accent-cyan-strong)' }}>{label}</p>
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
