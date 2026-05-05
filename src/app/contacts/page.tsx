import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtPhone, normalizePhone } from '@/lib/format'
import ListRowActions from '@/components/ListRowActions'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import MasterDataListSection from '@/components/MasterDataListSection'
import { MasterDataBodyCell, MasterDataEmptyStateRow, MasterDataHeaderCell, MasterDataMutedCell } from '@/components/MasterDataTableCells'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { MASTER_DATA_TABLE_DIVIDER_STYLE, getMasterDataRowStyle } from '@/lib/master-data-table'
import { formatMasterDataDate } from '@/lib/master-data-display'
import { loadCompanyPageLogo } from '@/lib/company-page-logo'
import { loadContactFormCustomization } from '@/lib/contact-form-customization-store'
import { contactListDefinition } from '@/lib/master-data-list-definitions'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT

  const where = query
    ? {
        OR: [
          { contactNumber: { contains: query, mode: 'insensitive' as const } },
          { firstName: { contains: query, mode: 'insensitive' as const } },
          { lastName: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
          { phone: { contains: query, mode: 'insensitive' as const } },
          { address: { contains: query, mode: 'insensitive' as const } },
          { position: { contains: query, mode: 'insensitive' as const } },
          { customer: { name: { contains: query, mode: 'insensitive' as const } } },
          { vendor: { name: { contains: query, mode: 'insensitive' as const } } },
        ],
      }
    : {}

  const orderBy =
    sort === 'id'
      ? [{ contactNumber: 'asc' as const }, { createdAt: 'desc' as const }]
      : sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'name'
        ? [{ lastName: 'asc' as const }, { firstName: 'asc' as const }]
        : [{ createdAt: 'desc' as const }]

  const [totalContacts, customers, vendors, companyLogoPages, formCustomization] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.vendor.findMany({ orderBy: { name: 'asc' } }),
    loadCompanyPageLogo(),
    loadContactFormCustomization(),
  ])

  const pagination = getPagination(totalContacts, params.page)

  const contacts = await prisma.contact.findMany({
    where,
    include: { customer: true, vendor: true },
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

  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Contacts"
        total={totalContacts}
        logoUrl={companyLogoPages?.url}
        actions={
          <Link
            href="/contacts/new"
            className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
            style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
          >
            <span className="mr-1.5 text-lg leading-none">+</span>
            New Contact
          </Link>
        }
      />

      <MasterDataListSection
        query={params.q}
        searchPlaceholder={contactListDefinition.searchPlaceholder}
        tableId={contactListDefinition.tableId}
        exportFileName={contactListDefinition.exportFileName}
        exportAllUrl={buildMasterDataExportUrl('contacts', params.q, sort)}
        columns={contactListDefinition.columns}
        sort={sort}
        sortOptions={contactListDefinition.sortOptions}
      >
        <table className="min-w-full" id={contactListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              <MasterDataHeaderCell columnId="contact-number">Contact Id</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="name">Name</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="account-type">Account Type</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="account">Account</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="email">Email</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="phone">Phone</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="address">Address</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="position">Position</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="primary">Primary</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="quotes-sales-orders">Quotes / SOs</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="invoices">Invoices</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="invoice-cc">Invoice CC</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="inactive">Inactive</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="db-id">DB Id</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="created">Created</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="last-modified">Last Modified</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="actions">Actions</MasterDataHeaderCell>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={17}>No contacts found</MasterDataEmptyStateRow>
            ) : contacts.map((contact, index) => (
              <tr key={contact.id} style={getMasterDataRowStyle(index, contacts.length)}>
                <MasterDataBodyCell columnId="contact-number" className="px-4 py-2 text-sm font-medium">
                  <Link href={`/contacts/${contact.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                    {contact.contactNumber ?? 'Pending'}
                  </Link>
                </MasterDataBodyCell>
                <MasterDataBodyCell columnId="name" className="px-4 py-2 text-sm text-white">{contact.firstName} {contact.lastName}</MasterDataBodyCell>
                <MasterDataMutedCell columnId="account-type">
                  {contact.customerId ? 'Customer' : contact.vendorId ? 'Vendor' : '-'}
                </MasterDataMutedCell>
                <MasterDataMutedCell columnId="account">{contact.customer?.name ?? contact.vendor?.name ?? '-'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="email">{contact.email ?? '-'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="phone">{fmtPhone(contact.phone)}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="address">{contact.address ?? '-'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="position">{contact.position ?? '-'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="primary">{contact.isPrimaryForCustomer ? 'Yes' : 'No'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="quotes-sales-orders">{contact.receivesQuotesSalesOrders ? 'Yes' : 'No'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="invoices">{contact.receivesInvoices ? 'Yes' : 'No'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="invoice-cc">{contact.receivesInvoiceCc ? 'Yes' : 'No'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="inactive">{contact.active ? 'No' : 'Yes'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="db-id">{contact.id}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="created">{formatMasterDataDate(contact.createdAt)}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="last-modified">{formatMasterDataDate(contact.updatedAt)}</MasterDataMutedCell>
                <MasterDataBodyCell columnId="actions" style={{ color: 'var(--text-secondary)' }}>
                  <ListRowActions
                    viewHref={`/contacts/${contact.id}`}
                    editButton={{
                      resource: 'contacts',
                      id: contact.id,
                      fields: [
                        ...(formCustomization.fields.firstName.visible ? [{ name: 'firstName', label: 'First Name', value: contact.firstName }] : []),
                        ...(formCustomization.fields.lastName.visible ? [{ name: 'lastName', label: 'Last Name', value: contact.lastName }] : []),
                        ...(formCustomization.fields.email.visible ? [{ name: 'email', label: 'Email', value: contact.email ?? '', type: 'email' as const }] : []),
                        ...(formCustomization.fields.phone.visible ? [{ name: 'phone', label: 'Phone', value: normalizePhone(contact.phone) ?? '' }] : []),
                        ...(formCustomization.fields.address.visible ? [{ name: 'address', label: 'Address', value: contact.address ?? '', type: 'address' as const }] : []),
                        ...(formCustomization.fields.position.visible ? [{ name: 'position', label: 'Position', value: contact.position ?? '' }] : []),
                        ...(formCustomization.fields.customerId.visible
                          ? [{
                              name: 'customerId',
                              label: 'Customer',
                              value: contact.customerId ?? '',
                              type: 'select' as const,
                              options: [{ value: '', label: 'None' }, ...customers.map((customer) => ({ value: customer.id, label: customer.name }))],
                            }]
                          : []),
                        ...(formCustomization.fields.vendorId.visible
                          ? [{
                              name: 'vendorId',
                              label: 'Vendor',
                              value: contact.vendorId ?? '',
                              type: 'select' as const,
                              options: [{ value: '', label: 'None' }, ...vendors.map((vendor) => ({ value: vendor.id, label: vendor.name }))],
                            }]
                          : []),
                        ...(formCustomization.fields.isPrimaryForCustomer.visible
                          ? [{
                              name: 'isPrimaryForCustomer',
                              label: 'Primary',
                              value: contact.isPrimaryForCustomer ? 'true' : 'false',
                              type: 'checkbox' as const,
                              placeholder: 'Primary',
                            }]
                          : []),
                        ...(formCustomization.fields.receivesQuotesSalesOrders.visible
                          ? [{
                              name: 'receivesQuotesSalesOrders',
                              label: 'Send Quote / SO',
                              value: contact.receivesQuotesSalesOrders ? 'true' : 'false',
                              type: 'checkbox' as const,
                              placeholder: 'Send Quote / SO',
                            }]
                          : []),
                        ...(formCustomization.fields.receivesInvoices.visible
                          ? [{
                              name: 'receivesInvoices',
                              label: 'Send Invoice',
                              value: contact.receivesInvoices ? 'true' : 'false',
                              type: 'checkbox' as const,
                              placeholder: 'Send Invoice',
                            }]
                          : []),
                        ...(formCustomization.fields.receivesInvoiceCc.visible
                          ? [{
                              name: 'receivesInvoiceCc',
                              label: 'CC Invoice',
                              value: contact.receivesInvoiceCc ? 'true' : 'false',
                              type: 'checkbox' as const,
                              placeholder: 'CC Invoice',
                            }]
                          : []),
                        ...(formCustomization.fields.inactive.visible
                          ? [{
                              name: 'inactive',
                              label: 'Inactive',
                              value: contact.active ? 'false' : 'true',
                              type: 'checkbox' as const,
                              placeholder: 'Inactive',
                            }]
                          : []),
                      ],
                    }}
                    deleteButton={{ resource: 'contacts', id: contact.id }}
                  />
                </MasterDataBodyCell>
              </tr>
            ))}
          </tbody>
        </table>
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
      </MasterDataListSection>
    </div>
  )
}
