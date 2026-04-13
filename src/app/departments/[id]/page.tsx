import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import { formatCustomFieldValue } from '@/lib/custom-fields'

export default async function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [department, managers, subsidiaries, customFields, customFieldValues] = await Promise.all([
    prisma.department.findUnique({
      where: { id },
      include: {
        entity: true,
        employees: { orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], select: { id: true, firstName: true, lastName: true, employeeNumber: true, title: true } },
      },
    }),
    prisma.employee.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, employeeNumber: true },
    }),
    prisma.entity.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.customFieldDefinition.findMany({
      where: { entityType: 'department', active: true },
      orderBy: [{ label: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, label: true, type: true, defaultValue: true },
    }),
    prisma.customFieldValue.findMany({
      where: { entityType: 'department', recordId: id },
      select: { fieldId: true, value: true },
    }),
  ])

  if (!department) notFound()

  const selectedManager = managers.find((manager) => manager.id === department.managerId)
  const customFieldValueMap = new Map(customFieldValues.map((entry) => [entry.fieldId, entry.value]))

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/departments" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Departments
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{department.code}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{department.name}</h1>
            <span className="mt-1 inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
              {department.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <EditButton
              resource="departments"
              id={department.id}
              fields={[
                { name: 'code', label: 'Code', value: department.code },
                { name: 'name', label: 'Name', value: department.name },
                { name: 'description', label: 'Description', value: department.description ?? '' },
                { name: 'division', label: 'Division', value: department.division ?? '' },
                {
                  name: 'entityId',
                  label: 'Subsidiary',
                  value: department.entityId ?? '',
                  type: 'select',
                  placeholder: 'Select subsidiary',
                  options: subsidiaries.map((subsidiary) => ({ value: subsidiary.id, label: `${subsidiary.code} - ${subsidiary.name}` })),
                },
                {
                  name: 'managerId',
                  label: 'Manager',
                  value: department.managerId ?? '',
                  type: 'select',
                  placeholder: 'Select manager',
                  options: managers.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}${m.employeeNumber ? ` (${m.employeeNumber})` : ''}` })),
                },
                {
                  name: 'inactive',
                  label: 'Inactive',
                  value: String(!department.active),
                  type: 'select',
                  options: [
                    { value: 'false', label: 'No' },
                    { value: 'true', label: 'Yes' },
                  ],
                },
              ]}
            />
            <DeleteButton resource="departments" id={department.id} />
          </div>
        </div>

        <div className="mb-8 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Department details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" value={department.code} />
            <Field label="Name" value={department.name} />
            <Field label="Description" value={department.description} />
            <Field label="Division" value={department.division} />
            <Field label="Subsidiary" value={department.entity ? `${department.entity.code} - ${department.entity.name}` : null} />
            <Field label="Manager" value={selectedManager ? `${selectedManager.firstName} ${selectedManager.lastName}${selectedManager.employeeNumber ? ` (${selectedManager.employeeNumber})` : ''}` : null} />
            <Field label="Inactive" value={department.active ? 'No' : 'Yes'} />
            <Field label="Created" value={new Date(department.createdAt).toLocaleDateString()} />
            <Field label="Last Modified" value={new Date(department.updatedAt).toLocaleDateString()} />
            {customFields.map((field) => (
              <Field
                key={field.id}
                label={field.label}
                value={formatCustomFieldValue(field.type as 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox', customFieldValueMap.get(field.id) ?? field.defaultValue)}
              />
            ))}
          </dl>
        </div>

        <Section title="Employees" count={department.employees.length}>
          {department.employees.length === 0 ? (
            <EmptyRow message="No employees in this department" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <Th>Employee #</Th>
                  <Th>Name</Th>
                  <Th>Title</Th>
                </tr>
              </thead>
              <tbody>
                {department.employees.map((employee) => (
                  <tr key={employee.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <Td>
                      <Link href={`/employees/${employee.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {employee.employeeNumber ?? 'Pending'}
                      </Link>
                    </Td>
                    <Td>{employee.firstName} {employee.lastName}</Td>
                    <Td>{employee.title ?? '—'}</Td>
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
