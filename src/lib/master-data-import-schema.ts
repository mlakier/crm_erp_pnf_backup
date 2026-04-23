export const SUPPORTED_ENTITIES = [
  'currencies',
  'locations',
  'subsidiaries',
  'chart-of-accounts',
  'departments',
  'items',
  'employees',
  'customers',
  'contacts',
  'vendors',
] as const

export type SupportedEntity = (typeof SUPPORTED_ENTITIES)[number]

type FieldDefinition = {
  key: string
  required: boolean
}

type EntitySchema = {
  label: string
  fields: FieldDefinition[]
  sampleRows: string[][]
}

export const MASTER_DATA_IMPORT_SCHEMA: Record<SupportedEntity, EntitySchema> = {
  currencies: {
    label: 'Currencies',
    fields: [
      { key: 'code', required: true },
      { key: 'name', required: true },
      { key: 'symbol', required: false },
      { key: 'decimals', required: false },
      { key: 'isBase', required: false },
      { key: 'active', required: false },
    ],
    sampleRows: [
      ['USD', 'US Dollar', '$', '2', 'true', 'true'],
      ['EUR', 'Euro', 'EUR', '2', 'false', 'true'],
      ['GBP', 'British Pound', 'GBP', '2', 'false', 'true'],
    ],
  },
  subsidiaries: {
    label: 'Subsidiaries',
    fields: [
      { key: 'code', required: true },
      { key: 'name', required: true },
      { key: 'legalName', required: false },
      { key: 'entityType', required: false },
      { key: 'taxId', required: false },
      { key: 'registrationNumber', required: false },
      { key: 'defaultCurrencyCode', required: false },
      { key: 'active', required: false },
    ],
    sampleRows: [
      ['SUB-001', 'Main Subsidiary', 'Main Corp Inc.', 'corporation', 'XX-1234567', 'REG-001', 'USD', 'true'],
      ['SUB-002', 'European Branch', 'European Operations Ltd.', 'branch', 'DE-9876543', 'REG-002', 'EUR', 'true'],
    ],
  },
  'chart-of-accounts': {
    label: 'Chart of Accounts',
    fields: [
      { key: 'accountId', required: false },
      { key: 'accountNumber', required: true },
      { key: 'name', required: true },
      { key: 'accountType', required: true },
      { key: 'description', required: false },
      { key: 'inventory', required: false },
      { key: 'revalueOpenBalance', required: false },
      { key: 'eliminateIntercoTransactions', required: false },
      { key: 'summary', required: false },
      { key: 'scopeMode', required: false },
      { key: 'parentSubsidiaryCode', required: false },
      { key: 'includeChildren', required: false },
      { key: 'subsidiaryCodes', required: false },
    ],
    sampleRows: [
      ['GL-00001', '1000', 'Cash', 'Asset', 'Cash and equivalents', 'false', 'false', 'false', 'false', 'selected', '', 'false', 'SUB-001,SUB-002'],
      ['GL-00002', '4000', 'Revenue', 'Revenue', 'Sales revenue', 'false', 'false', 'false', 'false', 'parent', 'SUB-001', 'true', ''],
    ],
  },
  locations: {
    label: 'Locations',
    fields: [
      { key: 'locationId', required: false },
      { key: 'code', required: true },
      { key: 'name', required: true },
      { key: 'subsidiaryId', required: false },
      { key: 'parentLocationId', required: false },
      { key: 'locationType', required: false },
      { key: 'makeInventoryAvailable', required: false },
      { key: 'address', required: false },
      { key: 'active', required: false },
    ],
    sampleRows: [
      ['LOC-00001', 'HQ', 'Headquarters', 'SUB-001', '', 'Office', 'true', '100 Main St, Irvine, CA 92618', 'true'],
      ['', 'WH-01', 'Primary Warehouse', 'SUB-001', 'LOC-00001', 'Warehouse', 'true', '200 Distribution Way, Phoenix, AZ 85001', 'true'],
      ['', 'STORE-01', 'Retail Store 01', 'SUB-001', 'LOC-00001', 'Store', 'true', '300 Market St, San Diego, CA 92101', 'true'],
    ],
  },
  departments: {
    label: 'Departments',
    fields: [
      { key: 'departmentId', required: true },
      { key: 'name', required: true },
      { key: 'description', required: false },
      { key: 'division', required: false },
      { key: 'subsidiaryCode', required: false },
      { key: 'managerEmployeeNumber', required: false },
      { key: 'active', required: false },
    ],
    sampleRows: [
      ['SALES', 'Sales Department', 'Handles all sales operations', 'North America', 'SUB-001', 'EMP-001', 'true'],
      ['ENG', 'Engineering', 'Product development and support', 'Platform', 'SUB-001', 'EMP-002', 'true'],
      ['HR', 'Human Resources', 'HR and employee services', 'Corporate', '', '', 'true'],
    ],
  },
  items: {
    label: 'Items',
    fields: [
      { key: 'itemId', required: false },
      { key: 'sku', required: false },
      { key: 'name', required: true },
      { key: 'description', required: false },
      { key: 'salesDescription', required: false },
      { key: 'purchaseDescription', required: false },
      { key: 'itemType', required: false },
      { key: 'itemCategory', required: false },
      { key: 'uom', required: false },
      { key: 'primaryPurchaseUnit', required: false },
      { key: 'primarySaleUnit', required: false },
      { key: 'primaryUnitsType', required: false },
      { key: 'listPrice', required: false },
      { key: 'currencyCode', required: false },
      { key: 'subsidiaryCodes', required: false },
      { key: 'includeChildren', required: false },
      { key: 'departmentId', required: false },
      { key: 'locationCode', required: false },
      { key: 'line', required: false },
      { key: 'productLine', required: false },
      { key: 'dropShipItem', required: false },
      { key: 'specialOrderItem', required: false },
      { key: 'canBeFulfilled', required: false },
      { key: 'preferredVendorId', required: false },
      { key: 'taxCode', required: false },
      { key: 'active', required: false },
    ],
    sampleRows: [
      ['ITEM-001', 'SKU-001', 'Product A', 'Premium product variant', 'Customer-facing description', 'Vendor-facing description', 'product', 'Software', 'EA', 'EA', 'EA', 'Each', '99.99', 'USD', 'SUB-001,SUB-002', 'false', 'DEPT-00001', 'LOC-001', 'Cloud', 'Subscriptions', 'false', 'false', 'true', 'VEND-000001', 'AVATAX-SW', 'true'],
      ['ITEM-002', 'SKU-002', 'Service B', 'Consulting services', 'Professional services', 'Contractor services', 'service', 'Services', 'HR', 'Hour', 'Hour', 'Time', '150.00', 'USD', 'SUB-001', 'false', 'DEPT-00002', 'LOC-001', 'Consulting', 'Implementation', 'false', 'false', 'false', 'VEND-000002', 'AVATAX-SVC', 'true'],
      ['', 'SKU-003', 'Product C', 'Entry level product', 'Starter product', 'Inventory replenishment description', 'product', 'Hardware', 'EA', 'EA', 'EA', 'Each', '49.99', 'EUR', 'SUB-002', 'true', '', '', 'Devices', 'Entry', 'true', 'true', 'true', '', 'AVATAX-HW', 'true'],
    ],
  },
  employees: {
    label: 'Employees',
    fields: [
      { key: 'employeeId', required: false },
      { key: 'eid', required: false },
      { key: 'firstName', required: true },
      { key: 'lastName', required: true },
      { key: 'email', required: false },
      { key: 'phone', required: false },
      { key: 'title', required: false },
      { key: 'laborType', required: false },
      { key: 'departmentCode', required: false },
      { key: 'subsidiaryIds', required: false },
      { key: 'includeChildren', required: false },
      { key: 'managerEmployeeId', required: false },
      { key: 'active', required: false },
    ],
    sampleRows: [
      ['EMP-001', 'EID-001', 'John', 'Smith', 'john.smith@company.com', '+1-555-0101', 'Sales Director', 'FTE', 'SALES', 'SUB-001', 'true', '', 'true'],
      ['EMP-002', 'EID-002', 'Jane', 'Doe', 'jane.doe@company.com', '+1-555-0102', 'Engineering Lead', 'FTE', 'ENG', 'SUB-001', 'true', '', 'true'],
      ['EMP-003', 'EID-003', 'Bob', 'Johnson', 'bob.johnson@company.com', '+1-555-0103', 'Sales Representative', 'PTE', 'SALES', 'SUB-001', 'true', 'EMP-001', 'true'],
    ],
  },
  customers: {
    label: 'Customers',
    fields: [
      { key: 'customerNumber', required: false },
      { key: 'name', required: true },
      { key: 'email', required: false },
      { key: 'phone', required: false },
      { key: 'address', required: false },
      { key: 'industry', required: false },
      { key: 'subsidiaryCode', required: false },
      { key: 'currencyCode', required: false },
      { key: 'active', required: false },
    ],
    sampleRows: [
      ['CUST-000001', 'Acme Corporation', 'contact@acme.com', '+1-555-0201', '123 Business St, New York, NY 10001', 'Technology', 'SUB-001', 'USD', 'true'],
      ['CUST-000002', 'Global Enterprises', 'info@global.com', '+1-555-0202', '456 Corporate Ave, Chicago, IL 60601', 'Finance', 'SUB-001', 'USD', 'true'],
      ['', 'European Partners Ltd', 'hello@eupartners.eu', '+49-30-12345678', 'Berlin, Germany', 'Manufacturing', 'SUB-002', 'EUR', 'true'],
    ],
  },
  contacts: {
    label: 'Contacts',
    fields: [
      { key: 'contactNumber', required: false },
      { key: 'firstName', required: true },
      { key: 'lastName', required: true },
      { key: 'email', required: false },
      { key: 'phone', required: false },
      { key: 'position', required: false },
      { key: 'customerNumber', required: true },
    ],
    sampleRows: [
      ['CONT-000001', 'Alice', 'Williams', 'alice.williams@acme.com', '+1-555-0301', 'Procurement Manager', 'CUST-000001'],
      ['CONT-000002', 'Charlie', 'Brown', 'charlie.brown@acme.com', '+1-555-0302', 'Operations Director', 'CUST-000001'],
      ['', 'Diana', 'Prince', 'diana@global.com', '+1-555-0303', 'Finance Manager', 'CUST-000002'],
    ],
  },
  vendors: {
    label: 'Vendors',
    fields: [
      { key: 'vendorNumber', required: false },
      { key: 'name', required: true },
      { key: 'email', required: false },
      { key: 'phone', required: false },
      { key: 'address', required: false },
      { key: 'taxId', required: false },
      { key: 'subsidiaryCode', required: false },
      { key: 'currencyCode', required: false },
      { key: 'active', required: false },
    ],
    sampleRows: [
      ['VEND-000001', 'Widget Supplies Inc', 'sales@widgets.com', '+1-555-0401', '789 Supply Rd, Boston, MA 02101', 'XX-1111111', 'SUB-001', 'USD', 'true'],
      ['VEND-000002', 'Parts Distributor Co', 'orders@partsdist.com', '+1-555-0402', '321 Distribution Way, Atlanta, GA 30301', 'XX-2222222', 'SUB-001', 'USD', 'true'],
      ['', 'European Supplies GmbH', 'kontakt@eusupp.de', '+49-40-87654321', 'Hamburg, Germany', 'DE-3333333', 'SUB-002', 'EUR', 'true'],
    ],
  },
}

export const MASTER_DATA_ENTITY_OPTIONS = SUPPORTED_ENTITIES.map((entity) => ({
  value: entity,
  label: MASTER_DATA_IMPORT_SCHEMA[entity].label,
}))

export function isSupportedEntity(value: string): value is SupportedEntity {
  return SUPPORTED_ENTITIES.includes(value as SupportedEntity)
}

export function getTemplateRows(entity: SupportedEntity): string[][] {
  const schema = MASTER_DATA_IMPORT_SCHEMA[entity]
  const headers = schema.fields.map((field) => field.key)
  return [headers, ...schema.sampleRows]
}

export function getRequiredHeaders(entity: SupportedEntity): string[] {
  return MASTER_DATA_IMPORT_SCHEMA[entity].fields.filter((field) => field.required).map((field) => field.key)
}

export function getFieldNames(entity: SupportedEntity): string[] {
  return MASTER_DATA_IMPORT_SCHEMA[entity].fields.map((field) => field.key)
}
