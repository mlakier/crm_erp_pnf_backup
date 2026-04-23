import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import LocationDetailCustomizeMode from '@/components/LocationDetailCustomizeMode'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import { RecordDetailCell, RecordDetailEmptyState, RecordDetailHeaderCell, RecordDetailSection, RecordDetailStatCard } from '@/components/RecordDetailPanels'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { LOCATION_FORM_FIELDS, type LocationFormFieldKey } from '@/lib/location-form-customization'
import { loadLocationFormCustomization } from '@/lib/location-form-customization-store'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

function boolValue(value: boolean) {
  return value ? 'true' : 'false'
}

export default async function LocationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string; customize?: string }>
}) {
  const { id } = await params
  const { edit, customize } = await searchParams
  const isEditing = edit === '1'
  const isCustomizing = customize === '1'
  const fieldMetaById = buildFieldMetaById(LOCATION_FORM_FIELDS)

  const [location, allLocations, fieldOptions, layout, formRequirements] = await Promise.all([
    prisma.location.findUnique({
      where: { id },
      include: {
        parentLocation: true,
        subsidiary: true,
        childLocations: { orderBy: { locationId: 'asc' } },
        employees: { orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], select: { id: true, employeeId: true, firstName: true, lastName: true } },
        items: { orderBy: [{ itemId: 'asc' }, { name: 'asc' }], select: { id: true, itemId: true, name: true } },
        invoiceLineItems: { take: 20, orderBy: { createdAt: 'desc' }, select: { id: true, description: true } },
        billLineItems: { take: 20, orderBy: { createdAt: 'desc' }, select: { id: true, description: true } },
        journalEntryLineItems: { take: 20, orderBy: { createdAt: 'desc' }, select: { id: true, description: true, debit: true, credit: true } },
      },
    }),
    prisma.location.findMany({ orderBy: { locationId: 'asc' }, select: { id: true, locationId: true, code: true, name: true } }),
    loadFieldOptionsMap(fieldMetaById as never, ['subsidiaryId', 'parentLocationId', 'locationType', 'inactive']),
    loadLocationFormCustomization(),
    loadFormRequirements(),
  ])

  if (!location) notFound()
  const locationRecord = location as typeof location & {
    childLocations: Array<{ id: string; locationId: string; name: string }>
    subsidiary: { id: string; subsidiaryId: string; name: string } | null
    employees: Array<{ id: string; employeeId: string | null; firstName: string; lastName: string }>
    items: Array<{ id: string; itemId: string | null; name: string }>
    invoiceLineItems: Array<{ id: string; description: string | null }>
    billLineItems: Array<{ id: string; description: string | null }>
    journalEntryLineItems: Array<{ id: string; description: string | null; debit: number; credit: number }>
  }

  const detailHref = `/locations/${location.id}`
  const parentOptions = allLocations
    .filter((entry) => entry.id !== location.id)
    .map((entry) => ({ value: entry.id, label: `${entry.locationId} - ${entry.code} - ${entry.name}` }))
  const inactiveOptions = fieldOptions.inactive ?? [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }]
  const sectionDescriptions: Record<string, string> = {
    Core: 'Primary identity fields for the location.',
    Hierarchy: 'Subsidiary context and parent location relationship for rollups.',
    Operations: 'Operational use and inventory availability.',
    Address: 'Physical or operating address.',
  }

  const fieldDefinitions: Record<LocationFormFieldKey, InlineRecordSection['fields'][number]> = {
    locationId: { name: 'locationId', label: 'Location Id', value: location.locationId, helpText: 'System-generated location master record identifier.' },
    code: { name: 'code', label: 'Code', value: location.code, helpText: 'Short operating code for the location.' },
    name: { name: 'name', label: 'Name', value: location.name, helpText: 'Display name for the location.' },
    subsidiaryId: { name: 'subsidiaryId', label: 'Subsidiary', value: location.subsidiaryId ?? '', type: 'select', options: fieldOptions.subsidiaryId ?? [], placeholder: 'None', helpText: 'Subsidiary context for this location.', sourceText: getFieldSourceText(fieldMetaById as never, 'subsidiaryId') },
    parentLocationId: { name: 'parentLocationId', label: 'Parent Location', value: location.parentLocationId ?? '', type: 'select', options: parentOptions, placeholder: 'None', helpText: 'Optional parent location.', sourceText: getFieldSourceText(fieldMetaById as never, 'parentLocationId') },
    locationType: { name: 'locationType', label: 'Location Type', value: location.locationType ?? '', type: 'select', options: fieldOptions.locationType ?? [], placeholder: 'None', helpText: 'Operational classification.', sourceText: getFieldSourceText(fieldMetaById as never, 'locationType') },
    makeInventoryAvailable: { name: 'makeInventoryAvailable', label: 'Make Inventory Available', value: boolValue(location.makeInventoryAvailable), type: 'checkbox', placeholder: 'Make Inventory Available', helpText: 'Controls whether inventory is available for transactions.' },
    address: { name: 'address', label: 'Address', value: location.address ?? '', type: 'address', helpText: 'Physical or operating address.' },
    inactive: { name: 'inactive', label: 'Inactive', value: boolValue(location.inactive), type: 'select', options: inactiveOptions, helpText: 'Marks the location unavailable for new records.', sourceText: getFieldSourceText(fieldMetaById as never, 'inactive') },
  }

  const detailSections = buildConfiguredInlineSections({
    fields: LOCATION_FORM_FIELDS,
    layout,
    fieldDefinitions,
    sectionDescriptions,
  })
  const customizeFields = buildCustomizePreviewFields(LOCATION_FORM_FIELDS, fieldDefinitions)
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'location',
    entityId: location.id,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'location', entityId: location.id })

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/locations'}
      backLabel={isCustomizing ? '<- Back to Location Detail' : '<- Back to Locations'}
      meta={location.locationId}
      title={location.name}
      badge={<span className="inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>{location.code}</span>}
      actions={
        <>
          {isEditing && !isCustomizing ? (
            <>
              <Link href={detailHref} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Cancel</Link>
              <button type="submit" form={`inline-record-form-${location.id}`} className="rounded-md px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>Save</button>
            </>
          ) : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailCreateMenu newHref="/locations/new" duplicateHref={`/locations/new?duplicateFrom=${location.id}`} /> : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailExportMenu title={location.name} fileName={`location-${location.locationId}`} sections={detailSections} /> : null}
          {!isEditing && !isCustomizing ? <Link href={`${detailHref}?customize=1`} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Customize</Link> : null}
          {!isEditing && !isCustomizing ? <Link href={`${detailHref}?edit=1`} className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm" style={{ backgroundColor: 'var(--accent-primary-strong)' }}>Edit</Link> : null}
          {!isCustomizing ? <DeleteButton resource="locations" id={location.id} /> : null}
        </>
      }
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <RecordDetailStatCard label="Child Locations" value={locationRecord.childLocations.length} />
        <RecordDetailStatCard label="Employees" value={locationRecord.employees.length} />
        <RecordDetailStatCard label="Items" value={locationRecord.items.length} />
      </div>

      {isCustomizing ? (
        <LocationDetailCustomizeMode
          detailHref={detailHref}
          initialLayout={layout}
          initialRequirements={{ ...formRequirements.locationCreate }}
          fields={customizeFields}
          sectionDescriptions={sectionDescriptions}
        />
      ) : (
        <InlineRecordDetails
          resource="locations"
          id={location.id}
          title="Location details"
          sections={detailSections}
          editing={isEditing}
          columns={layout.formColumns}
          showInternalActions={false}
        />
      )}

      {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} /> : null}

      <RecordDetailSection title="Child Locations" count={locationRecord.childLocations.length}>
        {locationRecord.childLocations.length === 0 ? <RecordDetailEmptyState message="No child locations yet." /> : (
          <table className="min-w-full"><tbody>{locationRecord.childLocations.map((child) => (
            <tr key={child.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
              <RecordDetailCell><Link href={`/locations/${child.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{child.locationId}</Link></RecordDetailCell>
              <RecordDetailCell>{child.name}</RecordDetailCell>
            </tr>
          ))}</tbody></table>
        )}
      </RecordDetailSection>

      <RecordDetailSection title="Employees" count={locationRecord.employees.length}>
        {locationRecord.employees.length === 0 ? <RecordDetailEmptyState message="No employees assigned to this location." /> : (
          <table className="min-w-full"><thead><tr><RecordDetailHeaderCell>Employee Id</RecordDetailHeaderCell><RecordDetailHeaderCell>Name</RecordDetailHeaderCell></tr></thead><tbody>{locationRecord.employees.map((employee) => (
            <tr key={employee.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
              <RecordDetailCell><Link href={`/employees/${employee.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{employee.employeeId ?? 'Pending'}</Link></RecordDetailCell>
              <RecordDetailCell>{employee.firstName} {employee.lastName}</RecordDetailCell>
            </tr>
          ))}</tbody></table>
        )}
      </RecordDetailSection>

      <RecordDetailSection title="Items" count={locationRecord.items.length}>
        {locationRecord.items.length === 0 ? <RecordDetailEmptyState message="No items assigned to this location." /> : (
          <table className="min-w-full"><thead><tr><RecordDetailHeaderCell>Item Id</RecordDetailHeaderCell><RecordDetailHeaderCell>Name</RecordDetailHeaderCell></tr></thead><tbody>{locationRecord.items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
              <RecordDetailCell><Link href={`/items/${item.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{item.itemId ?? 'Pending'}</Link></RecordDetailCell>
              <RecordDetailCell>{item.name}</RecordDetailCell>
            </tr>
          ))}</tbody></table>
        )}
      </RecordDetailSection>

      <RecordDetailSection title="Transaction Lines" count={locationRecord.invoiceLineItems.length + locationRecord.billLineItems.length + locationRecord.journalEntryLineItems.length}>
        <div className="grid gap-3 md:grid-cols-3">
          <RecordDetailStatCard label="Invoice Lines" value={locationRecord.invoiceLineItems.length} />
          <RecordDetailStatCard label="Bill Lines" value={locationRecord.billLineItems.length} />
          <RecordDetailStatCard label="Journal Lines" value={locationRecord.journalEntryLineItems.length} />
        </div>
      </RecordDetailSection>

      <SystemNotesSection notes={systemNotes} />
    </RecordDetailPageShell>
  )
}
