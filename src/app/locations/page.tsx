import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import EditButton from '@/components/EditButton'
import MasterDataListSection from '@/components/MasterDataListSection'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import { MasterDataBodyCell, MasterDataEmptyStateRow, MasterDataHeaderCell, MasterDataMutedCell } from '@/components/MasterDataTableCells'
import PaginationFooter from '@/components/PaginationFooter'
import { loadCompanyPageLogo } from '@/lib/company-page-logo'
import { loadListOptionsForSource } from '@/lib/list-source'
import { locationListDefinition } from '@/lib/master-data-list-definitions'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { MASTER_DATA_TABLE_DIVIDER_STYLE, getMasterDataRowStyle } from '@/lib/master-data-table'
import { formatMasterDataDate } from '@/lib/master-data-display'
import { getPagination } from '@/lib/pagination'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'

function formatBool(value: boolean) {
  return value ? 'Yes' : 'No'
}

export default async function LocationsPage({
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
          { locationId: { contains: query, mode: 'insensitive' as const } },
          { code: { contains: query, mode: 'insensitive' as const } },
          { name: { contains: query, mode: 'insensitive' as const } },
          { address: { contains: query, mode: 'insensitive' as const } },
          { locationType: { contains: query, mode: 'insensitive' as const } },
          { parentLocation: { is: { locationId: { contains: query, mode: 'insensitive' as const } } } },
          { parentLocation: { is: { code: { contains: query, mode: 'insensitive' as const } } } },
          { parentLocation: { is: { name: { contains: query, mode: 'insensitive' as const } } } },
          { subsidiary: { is: { subsidiaryId: { contains: query, mode: 'insensitive' as const } } } },
          { subsidiary: { is: { name: { contains: query, mode: 'insensitive' as const } } } },
        ],
      }
    : {}

  const total = await prisma.location.count({ where })
  const pagination = getPagination(total, params.page)

  const [locations, allLocations, subsidiaries, locationTypeOptions, companyLogoPages] = await Promise.all([
    prisma.location.findMany({
      where,
      include: { parentLocation: true, subsidiary: true },
      orderBy:
        sort === 'id'
          ? [{ locationId: 'asc' as const }, { createdAt: 'desc' as const }]
          : sort === 'oldest'
          ? [{ createdAt: 'asc' as const }]
          : sort === 'name'
            ? [{ name: 'asc' as const }, { locationId: 'asc' as const }]
            : [{ createdAt: 'desc' as const }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.location.findMany({
      orderBy: { locationId: 'asc' },
      select: { id: true, locationId: true, code: true, name: true },
    }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LOCATION-TYPE' }),
    loadCompanyPageLogo(),
  ])

  const parentLocationOptions = allLocations.map((location) => ({
    value: location.id,
    label: `${location.locationId} - ${location.code} - ${location.name}`,
  }))
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (sort) s.set('sort', sort)
    s.set('page', String(p))
    return `/locations?${s.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Locations"
        total={total}
        logoUrl={companyLogoPages?.url}
        actions={
          <Link
            href="/locations/new"
            className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
            style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
          >
            <span className="mr-1.5 text-lg leading-none">+</span>
            New Location
          </Link>
        }
      />

      <MasterDataListSection
        query={params.q}
        searchPlaceholder={locationListDefinition.searchPlaceholder}
        tableId={locationListDefinition.tableId}
        exportFileName={locationListDefinition.exportFileName}
        exportAllUrl={buildMasterDataExportUrl('locations', params.q, sort)}
        columns={locationListDefinition.columns}
        sort={sort}
        sortOptions={locationListDefinition.sortOptions}
      >
        <table className="min-w-full" id={locationListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              <MasterDataHeaderCell columnId="location-id">Location Id</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="code">Code</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="name">Name</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="subsidiary">Subsidiary</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="parent-location">Parent Location</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="location-type">Location Type</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="make-inventory-available">Make Inventory Available</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="address">Address</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="inactive">Inactive</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="created">Created</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="last-modified">Last Modified</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="actions">Actions</MasterDataHeaderCell>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={12}>No locations found</MasterDataEmptyStateRow>
            ) : (
              locations.map((location, index) => (
                <tr key={location.id} style={getMasterDataRowStyle(index, locations.length)}>
                  <MasterDataBodyCell columnId="location-id" className="px-4 py-2 text-sm font-medium">
                    <Link href={`/locations/${location.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                      {location.locationId}
                    </Link>
                  </MasterDataBodyCell>
                  <MasterDataMutedCell columnId="code">{location.code}</MasterDataMutedCell>
                  <MasterDataBodyCell columnId="name" className="px-4 py-2 text-sm font-medium text-white">{location.name}</MasterDataBodyCell>
                  <MasterDataMutedCell columnId="subsidiary">{location.subsidiary ? location.subsidiary.subsidiaryId : '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="parent-location">
                    {location.parentLocation ? `${location.parentLocation.locationId} - ${location.parentLocation.name}` : '-'}
                  </MasterDataMutedCell>
                  <MasterDataMutedCell columnId="location-type">{location.locationType ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="make-inventory-available">{formatBool(location.makeInventoryAvailable)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="address">{location.address ?? '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="inactive">{formatBool(location.inactive)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="created">{formatMasterDataDate(location.createdAt)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="last-modified">{formatMasterDataDate(location.updatedAt)}</MasterDataMutedCell>
                  <MasterDataBodyCell columnId="actions">
                    <div className="flex items-center gap-2">
                      <EditButton
                        resource="locations"
                        id={location.id}
                        fields={[
                          { name: 'locationId', label: 'Location Id', value: location.locationId },
                          { name: 'code', label: 'Code', value: location.code },
                          { name: 'name', label: 'Name', value: location.name },
                          {
                            name: 'subsidiaryId',
                            label: 'Subsidiary',
                            value: location.subsidiaryId ?? '',
                            type: 'select',
                            placeholder: 'None',
                            options: subsidiaryOptions,
                          },
                          {
                            name: 'parentLocationId',
                            label: 'Parent Location',
                            value: location.parentLocationId ?? '',
                            type: 'select',
                            placeholder: 'None',
                            options: parentLocationOptions.filter((option) => option.value !== location.id),
                          },
                          {
                            name: 'locationType',
                            label: 'Location Type',
                            value: location.locationType ?? '',
                            type: 'select',
                            placeholder: 'None',
                            options: locationTypeOptions,
                          },
                          {
                            name: 'makeInventoryAvailable',
                            label: 'Make Inventory Available',
                            value: String(location.makeInventoryAvailable),
                            type: 'checkbox',
                            placeholder: 'Make Inventory Available',
                          },
                          { name: 'address', label: 'Address', value: location.address ?? '', type: 'address' },
                          {
                            name: 'inactive',
                            label: 'Inactive',
                            value: String(location.inactive),
                            type: 'select',
                            options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }],
                          },
                        ]}
                      />
                      <DeleteButton resource="locations" id={location.id} />
                    </div>
                  </MasterDataBodyCell>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={total}
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
