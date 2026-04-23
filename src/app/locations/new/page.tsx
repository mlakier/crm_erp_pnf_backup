import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import LocationCreateForm from '@/components/LocationCreateForm'
import { generateNextLocationId } from '@/lib/location-number'
import { loadListOptionsForSource } from '@/lib/list-source'
import { prisma } from '@/lib/prisma'

export default async function NewLocationPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [nextLocationId, locations, subsidiaries, locationTypeOptions, duplicateLocation] = await Promise.all([
    generateNextLocationId(),
    prisma.location.findMany({ orderBy: { locationId: 'asc' }, select: { id: true, locationId: true, code: true, name: true } }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LOCATION-TYPE' }),
    duplicateFrom
      ? prisma.location.findUnique({ where: { id: duplicateFrom }, select: { code: true, name: true, subsidiaryId: true, parentLocationId: true, locationType: true, makeInventoryAvailable: true, address: true, inactive: true } })
      : Promise.resolve(null),
  ])

  const parentLocationOptions = locations.map((location) => ({
    value: location.id,
    label: `${location.locationId} - ${location.code} - ${location.name}`,
  }))
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))

  return (
    <MasterDataCreatePageShell backHref="/locations" backLabel="<- Back to Locations" title="New Location" formId="create-location-form">
      <LocationCreateForm
        formId="create-location-form"
        showFooterActions={false}
        redirectBasePath="/locations"
        initialLocationId={nextLocationId}
        parentLocationOptions={parentLocationOptions}
        subsidiaryOptions={subsidiaryOptions}
        locationTypeOptions={locationTypeOptions}
        initialValues={duplicateLocation ? {
          code: `COPY-${duplicateLocation.code}`.slice(0, 24),
          name: `Copy of ${duplicateLocation.name}`,
          subsidiaryId: duplicateLocation.subsidiaryId,
          parentLocationId: duplicateLocation.parentLocationId,
          locationType: duplicateLocation.locationType,
          makeInventoryAvailable: duplicateLocation.makeInventoryAvailable,
          address: duplicateLocation.address,
          inactive: duplicateLocation.inactive,
        } : undefined}
      />
    </MasterDataCreatePageShell>
  )
}
