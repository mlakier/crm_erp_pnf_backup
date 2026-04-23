import { getListSourceText, type FieldSourceType } from '@/lib/list-source'

export type LocationFormFieldKey =
  | 'locationId'
  | 'code'
  | 'name'
  | 'subsidiaryId'
  | 'parentLocationId'
  | 'locationType'
  | 'makeInventoryAvailable'
  | 'address'
  | 'inactive'

export type LocationFormFieldMeta = {
  id: LocationFormFieldKey
  label: string
  fieldType: string
  sourceType?: FieldSourceType
  sourceKey?: string
  source?: string
  description?: string
}

export type LocationFormFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type LocationFormCustomizationConfig = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<LocationFormFieldKey, LocationFormFieldCustomization>
}

export const LOCATION_FORM_FIELDS: LocationFormFieldMeta[] = [
  { id: 'locationId', label: 'Location ID', fieldType: 'text', description: 'System-generated location master record identifier.' },
  { id: 'code', label: 'Code', fieldType: 'text', description: 'Short operating code for the location.' },
  { id: 'name', label: 'Name', fieldType: 'text', description: 'Display name for the location.' },
  { id: 'subsidiaryId', label: 'Subsidiary', fieldType: 'list', sourceType: 'reference', sourceKey: 'subsidiaries', source: getListSourceText({ sourceType: 'reference', sourceKey: 'subsidiaries' }), description: 'Subsidiary context for this location.' },
  { id: 'parentLocationId', label: 'Parent Location', fieldType: 'list', sourceType: 'reference', sourceKey: 'locations', source: getListSourceText({ sourceType: 'reference', sourceKey: 'locations' }), description: 'Optional parent location for hierarchy and rollups.' },
  { id: 'locationType', label: 'Location Type', fieldType: 'list', sourceType: 'managed-list', sourceKey: 'LOCATION-TYPE', source: getListSourceText({ sourceType: 'managed-list', sourceKey: 'LOCATION-TYPE' }), description: 'Operational classification for the location.' },
  { id: 'makeInventoryAvailable', label: 'Make Inventory Available', fieldType: 'boolean', description: 'Controls whether inventory at this location is available for transactions.' },
  { id: 'address', label: 'Address', fieldType: 'address', description: 'Physical or operating address for the location.' },
  { id: 'inactive', label: 'Inactive', fieldType: 'list', sourceType: 'system', sourceKey: 'activeInactive', source: getListSourceText({ sourceType: 'system', sourceKey: 'activeInactive' }), description: 'Marks the location unavailable for new records while preserving history.' },
]

export function defaultLocationFormCustomization(): LocationFormCustomizationConfig {
  const sectionMap: Record<LocationFormFieldKey, string> = {
    locationId: 'Core',
    code: 'Core',
    name: 'Core',
    subsidiaryId: 'Hierarchy',
    parentLocationId: 'Hierarchy',
    locationType: 'Operations',
    makeInventoryAvailable: 'Operations',
    address: 'Address',
    inactive: 'Operations',
  }
  const columnMap: Record<LocationFormFieldKey, number> = {
    locationId: 1,
    code: 2,
    name: 1,
    subsidiaryId: 1,
    parentLocationId: 1,
    locationType: 1,
    makeInventoryAvailable: 2,
    address: 1,
    inactive: 2,
  }
  const rowMap: Record<LocationFormFieldKey, number> = {
    locationId: 0,
    code: 0,
    name: 1,
    subsidiaryId: 0,
    parentLocationId: 1,
    locationType: 0,
    makeInventoryAvailable: 0,
    address: 0,
    inactive: 1,
  }

  return {
    formColumns: 2,
    sections: ['Core', 'Hierarchy', 'Operations', 'Address'],
    sectionRows: { Core: 2, Hierarchy: 2, Operations: 2, Address: 1 },
    fields: Object.fromEntries(
      LOCATION_FORM_FIELDS.map((field) => [
        field.id,
        { visible: true, section: sectionMap[field.id], order: rowMap[field.id], column: columnMap[field.id] },
      ])
    ) as Record<LocationFormFieldKey, LocationFormFieldCustomization>,
  }
}
