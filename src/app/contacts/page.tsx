import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtPhone, normalizePhone } from '@/lib/format'
import ContactCreateForm from '@/components/ContactCreateForm'
import DeleteButton from '@/components/DeleteButton'
import ContactEditButton from '@/components/ContactEditButton'
import CreateModalButton from '@/components/CreateModalButton'
import MasterDataCustomizeButton from '@/components/MasterDataCustomizeButton'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'

const CONTACT_COLUMNS = [
  { id: 'contact-number', label: 'Contact Id' },
  { id: 'name', label: 'Name' },
  { id: 'customer', label: 'Customer' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'address', label: 'Address' },
  { id: 'position', label: 'Position' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? 'newest'

  const where = query
    ? {
        OR: [
          { contactNumber: { contains: query } },
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { email: { contains: query } },
          { phone: { contains: query } },
          { address: { contains: query } },
          { position: { contains: query } },
          { customer: { name: { contains: query } } },
        ],
      }
    : {}

  const orderBy =
    sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'name'
        ? [{ firstName: 'asc' as const }, { lastName: 'asc' as const }]
        : [{ createdAt: 'desc' as const }]

  const [totalContacts, customers, adminUser, companySettings, cabinetFiles] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findUnique({ where: { email: 'admin@example.com' } }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
  ])

  const pagination = getPagination(totalContacts, params.page)

  const contacts = await prisma.contact.findMany({
    where,
    include: { customer: true },
    orderBy,
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (sort) search.set('sort', sort)
    search.set('page', String(nextPage))
    return `/contacts?${search.toString()}`
  }

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages =
    cabinetFiles.find((file) => file.id === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.originalName === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.storedName === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.url === selectedLogoValue)
    ?? (!selectedLogoValue ? cabinetFiles[0] : undefined)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? (
          <img
            src={companyLogoPages.url}
            alt="Company logo"
            className="h-16 w-auto rounded"
          />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Contacts</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalContacts} total</p>
        </div>
        <div className="flex items-center gap-2">
          <MasterDataCustomizeButton tableId="contacts-list" columns={CONTACT_COLUMNS} title="Contacts" />
          {adminUser ? (
            <CreateModalButton buttonLabel="New Contact" title="New Contact">
              <ContactCreateForm userId={adminUser.id} customers={customers} />
            </CreateModalButton>
          ) : null}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" />
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search contact ID, name, customer, email, phone"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A-Z</option>
            </select>
            <ExportButton tableId="contacts-list" fileName="contacts" />
            <ColumnSelector tableId="contacts-list" columns={CONTACT_COLUMNS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="contacts-list">
          <table className="min-w-full" id="contacts-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="contact-number" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Contact Id</th>
                <th data-column="name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                <th data-column="customer" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Customer</th>
                <th data-column="email" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Email</th>
                <th data-column="phone" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Phone</th>
                <th data-column="address" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Address</th>
                <th data-column="position" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Position</th>
                <th data-column="inactive" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Inactive</th>
                <th data-column="created" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
                <th data-column="last-modified" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Last Modified</th>
                <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No contacts found
                  </td>
                </tr>
              ) : contacts.map((contact, index) => (
                <tr key={contact.id} style={index < contacts.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                  <td data-column="contact-number" className="px-4 py-2 text-sm font-medium">
                    <Link href={`/contacts/${contact.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                      {contact.contactNumber ?? 'Pending'}
                    </Link>
                  </td>
                  <td data-column="name" className="px-4 py-2 text-sm text-white">{contact.firstName} {contact.lastName}</td>
                  <td data-column="customer" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{contact.customer.name}</td>
                  <td data-column="email" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{contact.email ?? '—'}</td>
                  <td data-column="phone" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtPhone(contact.phone)}</td>
                  <td data-column="address" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{contact.address ?? '—'}</td>
                  <td data-column="position" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{contact.position ?? '—'}</td>
                  <td data-column="inactive" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{contact.active ? 'No' : 'Yes'}</td>
                  <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(contact.createdAt).toLocaleDateString()}</td>
                  <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(contact.updatedAt).toLocaleDateString()}</td>
                  <td data-column="actions" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-2">
                      <ContactEditButton
                        contactId={contact.id}
                        values={{
                          firstName: contact.firstName,
                          lastName: contact.lastName,
                          email: contact.email ?? '',
                          phone: normalizePhone(contact.phone) ?? '',
                          address: contact.address ?? '',
                          position: contact.position ?? '',
                          customerId: contact.customerId,
                          inactive: !contact.active,
                        }}
                        customers={customers.map((customer) => ({ id: customer.id, name: customer.name }))}
                      />
                      <DeleteButton resource="contacts" id={contact.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={totalContacts}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          hasPrevPage={pagination.hasPrevPage}
          hasNextPage={pagination.hasNextPage}
          prevHref={buildPageHref(pagination.currentPage - 1)}
          nextHref={buildPageHref(pagination.currentPage + 1)}
        />
      </section>
    </div>
  )
}
