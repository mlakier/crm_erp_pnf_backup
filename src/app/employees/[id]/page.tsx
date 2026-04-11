import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      entity: true,
      departmentRef: true,
      manager: { select: { id: true, firstName: true, lastName: true, title: true } },
      directReports: { orderBy: { lastName: 'asc' }, select: { id: true, firstName: true, lastName: true, title: true, email: true } },
    },
  })

  if (!employee) notFound()

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/employees" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Employees
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{employee.employeeNumber ?? 'No employee #'}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{employee.firstName} {employee.lastName}</h1>
            {employee.title && (
              <span className="mt-1 inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
                {employee.title}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <EditButton
              resource="employees"
              id={employee.id}
              fields={[
                { name: 'firstName', label: 'First Name', value: employee.firstName },
                { name: 'lastName', label: 'Last Name', value: employee.lastName },
                { name: 'email', label: 'Email', value: employee.email ?? '' },
                { name: 'title', label: 'Title', value: employee.title ?? '' },
                { name: 'department', label: 'Department', value: employee.department ?? '' },
                { name: 'phone', label: 'Phone', value: employee.phone ?? '' },
                { name: 'entityId', label: 'Subsidiary Id', value: employee.entityId ?? '' },
                { name: 'managerId', label: 'Manager Id', value: employee.managerId ?? '' },
                { name: 'hireDate', label: 'Hire Date', value: employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : '', type: 'date' },
                { name: 'terminationDate', label: 'Termination Date', value: employee.terminationDate ? new Date(employee.terminationDate).toISOString().split('T')[0] : '', type: 'date' },
                { name: 'active', label: 'Active', value: String(employee.active) },
              ]}
            />
            <DeleteButton resource="employees" id={employee.id} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <StatCard label="Direct Reports" value={employee.directReports.length} />
          <StatCard label="Subsidiary" value={employee.entity?.code ?? '—'} />
          <StatCard label="Department" value={employee.departmentRef?.name ?? employee.department ?? '—'} />
        </div>

        {/* Details */}
        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Employee details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Employee #" value={employee.employeeNumber} />
            <Field label="First Name" value={employee.firstName} />
            <Field label="Last Name" value={employee.lastName} />
            <Field label="Email" value={employee.email} />
            <Field label="Phone" value={employee.phone} />
            <Field label="Title" value={employee.title} />
            <Field label="Department" value={employee.departmentRef?.name ?? employee.department} />
            <Field label="Subsidiary" value={employee.entity ? `${employee.entity.code} – ${employee.entity.name}` : null} />
            <Field label="Manager" value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : null} />
            <Field label="Hire Date" value={employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : null} />
            <Field label="Termination Date" value={employee.terminationDate ? new Date(employee.terminationDate).toLocaleDateString() : null} />
            <Field label="Active" value={employee.active ? 'Yes' : 'No'} />
            <Field label="Created" value={new Date(employee.createdAt).toLocaleDateString()} />
          </dl>
        </div>

        {/* Direct Reports */}
        <Section title="Direct Reports" count={employee.directReports.length}>
          {employee.directReports.length === 0 ? (
            <EmptyRow message="No direct reports" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Title</Th>
                  <Th>Email</Th>
                </tr>
              </thead>
              <tbody>
                {employee.directReports.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <Td>
                      <Link href={`/employees/${r.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {r.firstName} {r.lastName}
                      </Link>
                    </Td>
                    <Td>{r.title ?? '—'}</Td>
                    <Td>{r.email ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

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

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-6 overflow-hidden rounded-xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-muted)' }}>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>{count}</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function EmptyRow({ message }: { message: string }) {
  return <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>{message}</p>
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-muted)' }}>{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{children}</td>
}
