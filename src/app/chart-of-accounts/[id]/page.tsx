import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'

async function getDescendantSubsidiaryIds(parentId: string): Promise<Set<string>> {
  const descendants = new Set<string>([parentId])
  const queue = [parentId]

  while (queue.length > 0) {
    const current = queue.shift() as string
    const children = await prisma.entity.findMany({
      where: { parentEntityId: current },
      select: { id: true },
    })

    for (const child of children) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id)
        queue.push(child.id)
      }
    }
  }

  return descendants
}

export default async function ChartOfAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const account = await prisma.chartOfAccounts.findUnique({
    where: { id },
    include: {
      parentSubsidiary: { select: { id: true, code: true, name: true } },
      subsidiaryAssignments: {
        include: { subsidiary: { select: { id: true, code: true, name: true } } },
        orderBy: { subsidiary: { code: 'asc' } },
      },
    },
  })

  if (!account) notFound()

  const subsidiaries = await prisma.entity.findMany({
    where: account.parentSubsidiaryId && account.includeChildren
      ? { id: { in: Array.from(await getDescendantSubsidiaryIds(account.parentSubsidiaryId)) } }
      : account.parentSubsidiaryId
        ? { id: account.parentSubsidiaryId }
        : { id: { in: account.subsidiaryAssignments.map((entry) => entry.subsidiaryId) } },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  })

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/chart-of-accounts" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Chart of Accounts
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{account.accountNumber}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{account.name}</h1>
            <span className="mt-1 inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
              {account.accountType}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <EditButton
              resource="chart-of-accounts"
              id={account.id}
              fields={[
                { name: 'accountNumber', label: 'Account #', value: account.accountNumber },
                { name: 'name', label: 'Name', value: account.name },
                { name: 'description', label: 'Description', value: account.description ?? '' },
                {
                  name: 'accountType',
                  label: 'Account Type',
                  value: account.accountType,
                  type: 'select',
                  options: [
                    { value: 'Asset', label: 'Asset' },
                    { value: 'Liability', label: 'Liability' },
                    { value: 'Equity', label: 'Equity' },
                    { value: 'Revenue', label: 'Revenue' },
                    { value: 'Expense', label: 'Expense' },
                    { value: 'Other', label: 'Other' },
                  ],
                },
                { name: 'inventory', label: 'Inventory', value: String(account.inventory), type: 'checkbox' },
                { name: 'revalueOpenBalance', label: 'Revalue Open Balance', value: String(account.revalueOpenBalance), type: 'checkbox' },
                { name: 'eliminateIntercoTransactions', label: 'Eliminate Interco Transactions', value: String(account.eliminateIntercoTransactions), type: 'checkbox' },
                { name: 'summary', label: 'Summary', value: String(account.summary), type: 'checkbox' },
              ]}
            />
            <DeleteButton resource="chart-of-accounts" id={account.id} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          <StatCard label="Inventory" value={account.inventory ? 'Yes' : 'No'} />
          <StatCard label="Summary" value={account.summary ? 'Yes' : 'No'} />
          <StatCard label="Revalue Open Balance" value={account.revalueOpenBalance ? 'Yes' : 'No'} />
          <StatCard label="Eliminate Interco" value={account.eliminateIntercoTransactions ? 'Yes' : 'No'} />
        </div>

        <div className="mb-6 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Account details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Account #" value={account.accountNumber} />
            <Field label="Name" value={account.name} />
            <Field label="Description" value={account.description} />
            <Field label="Account Type" value={account.accountType} />
            <Field label="Scope" value={account.parentSubsidiary ? 'Parent Subsidiary' : 'Selected Subsidiaries'} />
            <Field label="Parent Subsidiary" value={account.parentSubsidiary ? `${account.parentSubsidiary.code} - ${account.parentSubsidiary.name}` : '—'} />
            <Field label="Include Children" value={account.includeChildren ? 'Yes' : 'No'} />
            <Field label="Created" value={new Date(account.createdAt).toLocaleDateString()} />
          </dl>
        </div>

        <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-muted)' }}>
            <h2 className="text-base font-semibold text-white">Subsidiaries in Scope</h2>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>{subsidiaries.length}</span>
          </div>
          <div className="overflow-x-auto">
            {subsidiaries.length === 0 ? (
              <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>No subsidiaries assigned.</p>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Name</Th>
                  </tr>
                </thead>
                <tbody>
                  {subsidiaries.map((subsidiary, index) => (
                    <tr key={subsidiary.id} style={index < subsidiaries.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                      <Td>{subsidiary.code}</Td>
                      <Td>{subsidiary.name}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{value ?? '—'}</dd>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}>{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{children}</td>
}
