import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      users: {
        orderBy: { name: 'asc' },
        select: { id: true, userId: true, name: true, email: true, inactive: true },
      },
    },
  })

  if (!role) notFound()

  const activeUsers = role.users.filter((u) => !u.inactive)
  const inactiveUsers = role.users.filter((u) => u.inactive)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/roles" className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
              ← Back to Roles
            </Link>
            <p className="mt-2 text-sm font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>{role.roleId}</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{role.name}</h1>
            {!role.active && (
              <span className="mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.18)', color: 'var(--danger)' }}>
                Inactive
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <EditButton
              resource="roles"
              id={role.id}
              fields={[
                { name: 'name', label: 'Name', value: role.name },
                { name: 'description', label: 'Description', value: role.description ?? '' },
                { name: 'inactive', label: 'Inactive', value: role.active ? 'false' : 'true', type: 'select', options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }] },
              ]}
            />
            <DeleteButton resource="roles" id={role.id} />
          </div>
        </div>

        {/* Details */}
        <section className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Role Details</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Role ID</dt>
              <dd className="mt-1 text-sm text-white">{role.roleId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Name</dt>
              <dd className="mt-1 text-sm text-white">{role.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Description</dt>
              <dd className="mt-1 text-sm text-white">{role.description ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Status</dt>
              <dd className="mt-1 text-sm text-white">{role.active ? 'Active' : 'Inactive'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Created</dt>
              <dd className="mt-1 text-sm text-white">{new Date(role.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Last Modified</dt>
              <dd className="mt-1 text-sm text-white">{new Date(role.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </section>

        {/* Users in this role */}
        <section className="mt-6 rounded-2xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Users ({role.users.length})
            {inactiveUsers.length > 0 && (
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                {activeUsers.length} active, {inactiveUsers.length} inactive
              </span>
            )}
          </h2>
          {role.users.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No users assigned to this role.</p>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>User ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {role.users.map((user, idx) => (
                  <tr key={user.id} style={idx < role.users.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td className="px-4 py-2 text-sm">
                      <Link href={`/users/${user.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {user.userId ?? 'Pending'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-white">{user.name ?? '—'}</td>
                    <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                    <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{user.inactive ? 'Inactive' : 'Active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
