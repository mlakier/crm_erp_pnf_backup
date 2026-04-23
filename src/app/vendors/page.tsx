import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtPhone, normalizePhone } from '@/lib/format'
import CreatePageLinkButton from '@/components/CreatePageLinkButton'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import MasterDataListSection from '@/components/MasterDataListSection'
import { MasterDataBodyCell, MasterDataEmptyStateRow, MasterDataHeaderCell, MasterDataMutedCell } from '@/components/MasterDataTableCells'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { MASTER_DATA_TABLE_DIVIDER_STYLE, getMasterDataRowStyle } from '@/lib/master-data-table'
import { formatMasterDataDate } from '@/lib/master-data-display'
import { loadCompanyPageLogo } from '@/lib/company-page-logo'
import { loadVendorFormCustomization } from '@/lib/vendor-form-customization-store'
import { VENDOR_FORM_FIELDS } from '@/lib/vendor-form-customization'
import { vendorListDefinition } from '@/lib/master-data-list-definitions'
import { buildFieldMetaById, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const vendorFieldMetaById = buildFieldMetaById(VENDOR_FORM_FIELDS)

  const where = query
    ? {
        OR: [
          { vendorNumber: { contains: query, mode: 'insensitive' as const } },
          { name: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
          { phone: { contains: query, mode: 'insensitive' as const } },
          { taxId: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const orderBy =
    sort === 'id'
      ? [{ vendorNumber: 'asc' as const }, { createdAt: 'desc' as const }]
      : sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'name'
        ? [{ name: 'asc' as const }]
        : [{ createdAt: 'desc' as const }]

  const [totalVendors, subsidiaries, currencies, companyLogoPages, fieldOptions, formCustomization] = await Promise.all([
    prisma.vendor.count({ where }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, currencyId: true, code: true, name: true } }),
    loadCompanyPageLogo(),
    loadFieldOptionsMap(vendorFieldMetaById, ['inactive']),
    loadVendorFormCustomization(),
  ])
  const pagination = getPagination(totalVendors, params.page)

  const vendors = await prisma.vendor.findMany({
    where,
    include: { subsidiary: true, currency: true },
    orderBy,
    skip: pagination.skip,
    take: pagination.pageSize,
  })

  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (sort) search.set('sort', sort)
    search.set('page', String(nextPage))
    return `/vendors?${search.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Vendors"
        total={totalVendors}
        logoUrl={companyLogoPages?.url}
        actions={
          <CreatePageLinkButton href="/vendors/new" label="New Vendor" />
        }
      />

      <MasterDataListSection
        query={params.q}
        searchPlaceholder={vendorListDefinition.searchPlaceholder}
        tableId={vendorListDefinition.tableId}
        exportFileName={vendorListDefinition.exportFileName}
        columns={vendorListDefinition.columns}
        sort={sort}
        sortOptions={vendorListDefinition.sortOptions}
      >
        <table className="min-w-full" id={vendorListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              <MasterDataHeaderCell columnId="vendor-number" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Vendor Id</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="name" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Name</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="subsidiary" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Primary Subsidiary</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="currency" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Primary Currency</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="email" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Email</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="phone" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Phone</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="address" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Address</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="tax-id" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Tax ID</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="inactive" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Inactive</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="created" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Created</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="last-modified" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Last Modified</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="actions" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide">Actions</MasterDataHeaderCell>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={12}>No vendors found</MasterDataEmptyStateRow>
            ) : vendors.map((vendor, index) => (
              <tr key={vendor.id} style={getMasterDataRowStyle(index, vendors.length)}>
                <MasterDataBodyCell columnId="vendor-number" className="whitespace-nowrap px-4 py-2 text-sm font-medium">
                  <Link href={`/vendors/${vendor.id}`} className="hover:underline font-medium" style={{ color: 'var(--accent-primary-strong)' }}>
                    {vendor.vendorNumber ?? 'Pending'}
                  </Link>
                </MasterDataBodyCell>
                <MasterDataBodyCell columnId="name" className="whitespace-nowrap px-4 py-2 text-sm text-white">{vendor.name}</MasterDataBodyCell>
                <MasterDataMutedCell columnId="subsidiary" className="whitespace-nowrap px-4 py-2 text-sm">{vendor.subsidiary ? `${vendor.subsidiary.subsidiaryId} (${vendor.subsidiary.name})` : '-'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="currency" className="whitespace-nowrap px-4 py-2 text-sm">{vendor.currency?.code ?? '-'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="email" className="whitespace-nowrap px-4 py-2 text-sm">{vendor.email ?? '-'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="phone" className="whitespace-nowrap px-4 py-2 text-sm">{fmtPhone(vendor.phone)}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="address" className="whitespace-nowrap px-4 py-2 text-sm">{vendor.address ?? '-'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="tax-id" className="whitespace-nowrap px-4 py-2 text-sm">{vendor.taxId ?? '-'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="inactive" className="whitespace-nowrap px-4 py-2 text-sm">{vendor.inactive ? 'Yes' : 'No'}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="created" className="whitespace-nowrap px-4 py-2 text-sm">{formatMasterDataDate(vendor.createdAt)}</MasterDataMutedCell>
                <MasterDataMutedCell columnId="last-modified" className="whitespace-nowrap px-4 py-2 text-sm">{formatMasterDataDate(vendor.updatedAt)}</MasterDataMutedCell>
                <MasterDataBodyCell columnId="actions" className="whitespace-nowrap px-4 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <EditButton
                      resource="vendors"
                      id={vendor.id}
                      fields={[
                        ...(formCustomization.fields.vendorNumber.visible ? [{ name: 'vendorNumber', label: 'Vendor ID', value: vendor.vendorNumber ?? '' }] : []),
                        ...(formCustomization.fields.name.visible ? [{ name: 'name', label: 'Name', value: vendor.name }] : []),
                        ...(formCustomization.fields.email.visible ? [{ name: 'email', label: 'Email', value: vendor.email ?? '', type: 'email' as const }] : []),
                        ...(formCustomization.fields.phone.visible ? [{ name: 'phone', label: 'Phone', value: normalizePhone(vendor.phone) ?? '' }] : []),
                        ...(formCustomization.fields.address.visible ? [{ name: 'address', label: 'Address', value: vendor.address ?? '', type: 'address' as const }] : []),
                        ...(formCustomization.fields.taxId.visible ? [{ name: 'taxId', label: 'Tax ID', value: vendor.taxId ?? '' }] : []),
                        ...(formCustomization.fields.primarySubsidiaryId.visible
                          ? [{
                              name: 'primarySubsidiaryId',
                              label: 'Primary Subsidiary',
                              value: vendor.subsidiaryId ?? '',
                              type: 'select' as const,
                              options: [{ value: '', label: 'None' }, ...subsidiaries.map((subsidiary) => ({ value: subsidiary.id, label: `${subsidiary.subsidiaryId} - ${subsidiary.name}` }))],
                            }]
                          : []),
                        ...(formCustomization.fields.primaryCurrencyId.visible
                          ? [{
                              name: 'primaryCurrencyId',
                              label: 'Primary Currency',
                              value: vendor.currencyId ?? '',
                              type: 'select' as const,
                              options: [{ value: '', label: 'None' }, ...currencies.map((currency) => ({ value: currency.id, label: `${currency.code} - ${currency.name}` }))],
                            }]
                          : []),
                        ...(formCustomization.fields.inactive.visible
                          ? [{
                              name: 'inactive',
                              label: 'Inactive',
                              value: String(vendor.inactive),
                              type: 'select' as const,
                              options: fieldOptions.inactive ?? [],
                            }]
                          : []),
                      ]}
                    />
                    <DeleteButton resource="vendors" id={vendor.id} />
                  </div>
                </MasterDataBodyCell>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={totalVendors}
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
