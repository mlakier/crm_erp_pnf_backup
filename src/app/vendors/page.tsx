import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtPhone, normalizePhone } from '@/lib/format'
import VendorCreateForm from '@/components/VendorCreateForm'
import DeleteButton from '@/components/DeleteButton'
import VendorEditButton from '@/components/VendorEditButton'
import CreateModalButton from '@/components/CreateModalButton'
import MasterDataCustomizeButton from '@/components/MasterDataCustomizeButton'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'

const VENDOR_COLUMNS = [
  { id: 'vendor-number', label: 'Vendor Id' },
  { id: 'name', label: 'Name' },
  { id: 'subsidiary', label: 'Primary Subsidiary' },
  { id: 'currency', label: 'Primary Currency' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'address', label: 'Address' },
  { id: 'tax-id', label: 'Tax ID' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function VendorsPage({
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
          { vendorNumber: { contains: query } },
          { name: { contains: query } },
          { email: { contains: query } },
          { phone: { contains: query } },
          { taxId: { contains: query } },
        ],
      }
    : {}

  const orderBy =
    sort === 'oldest'
      ? [{ createdAt: 'asc' as const }]
      : sort === 'name'
        ? [{ name: 'asc' as const }]
        : [{ createdAt: 'desc' as const }]

  const [totalVendors, subsidiaries, currencies, companySettings, cabinetFiles] = await Promise.all([
    prisma.vendor.count({ where }),
    prisma.entity.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.currency.findMany({ orderBy: { currencyId: 'asc' }, select: { id: true, currencyId: true, name: true } }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
  ])
  const pagination = getPagination(totalVendors, params.page)

  const vendors = await prisma.vendor.findMany({
    where,
    include: { entity: true, currency: true },
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
          <h1 className="text-xl font-semibold text-white">Vendors</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalVendors} total</p>
        </div>
        <div className="flex items-center gap-2">
          <MasterDataCustomizeButton tableId="vendors-list" columns={VENDOR_COLUMNS} title="Vendors" />
          <CreateModalButton buttonLabel="New Vendor" title="New Vendor">
            <VendorCreateForm subsidiaries={subsidiaries} currencies={currencies} />
          </CreateModalButton>
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
              placeholder="Search vendor id, name, email, phone, tax id"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <select name="sort" defaultValue={sort} className="rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A-Z</option>
            </select>
            <ExportButton tableId="vendors-list" fileName="vendors" />
            <ColumnSelector tableId="vendors-list" columns={VENDOR_COLUMNS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="vendors-list">
          <table className="min-w-full" id="vendors-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="vendor-number" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Vendor Id</th>
                <th data-column="name" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                <th data-column="subsidiary" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Primary Subsidiary</th>
                <th data-column="currency" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Primary Currency</th>
                <th data-column="email" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Email</th>
                <th data-column="phone" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Phone</th>
                <th data-column="address" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Address</th>
                <th data-column="tax-id" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Tax ID</th>
                <th data-column="inactive" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Inactive</th>
                <th data-column="created" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
                <th data-column="last-modified" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Last Modified</th>
                <th data-column="actions" className="sticky top-0 z-10 whitespace-nowrap px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No vendors found
                  </td>
                </tr>
              ) : vendors.map((vendor, index) => (
                <tr key={vendor.id} style={index < vendors.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                  <td data-column="vendor-number" className="whitespace-nowrap px-4 py-2 text-sm font-medium">
                    <Link href={`/vendors/${vendor.id}`} className="hover:underline font-medium" style={{ color: 'var(--accent-primary-strong)' }}>
                      {vendor.vendorNumber ?? 'Pending'}
                    </Link>
                  </td>
                  <td data-column="name" className="whitespace-nowrap px-4 py-2 text-sm text-white">{vendor.name}</td>
                  <td data-column="subsidiary" className="whitespace-nowrap px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {vendor.entity ? `${vendor.entity.subsidiaryId} (${vendor.entity.name})` : '—'}
                  </td>
                  <td data-column="currency" className="whitespace-nowrap px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {vendor.currency?.currencyId ?? '—'}
                  </td>
                  <td data-column="email" className="whitespace-nowrap px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{vendor.email ?? '—'}</td>
                  <td data-column="phone" className="whitespace-nowrap px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtPhone(vendor.phone)}</td>
                  <td data-column="address" className="whitespace-nowrap px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{vendor.address ?? '—'}</td>
                  <td data-column="tax-id" className="whitespace-nowrap px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{vendor.taxId ?? '—'}</td>
                  <td data-column="inactive" className="whitespace-nowrap px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{vendor.inactive ? 'Yes' : 'No'}</td>
                  <td data-column="created" className="whitespace-nowrap px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(vendor.createdAt).toLocaleDateString()}</td>
                  <td data-column="last-modified" className="whitespace-nowrap px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(vendor.updatedAt).toLocaleDateString()}</td>
                  <td data-column="actions" className="whitespace-nowrap px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-2">
                      <VendorEditButton
                        vendorId={vendor.id}
                        values={{
                          name: vendor.name,
                          email: vendor.email ?? '',
                          phone: normalizePhone(vendor.phone) ?? '',
                          address: vendor.address ?? '',
                          taxId: vendor.taxId ?? '',
                          primarySubsidiaryId: vendor.entityId ?? '',
                          primaryCurrencyId: vendor.currencyId ?? '',
                          inactive: vendor.inactive,
                        }}
                        subsidiaries={subsidiaries}
                        currencies={currencies}
                      />
                      <DeleteButton resource="vendors" id={vendor.id} />
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
          total={totalVendors}
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
