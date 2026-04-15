export const SUPPORTED_ENTITIES = [
  'currencies',
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
      { key: 'accountId', required: true },
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
      ['1000', 'Cash', 'Asset', 'Cash and equivalents', 'false', 'false', 'false', 'false', 'selected', '', 'false', 'SUB-001,SUB-002'],
      ['4000', 'Revenue', 'Revenue', 'Sales revenue', 'false', 'false', 'false', 'false', 'parent', 'SUB-001', 'true', ''],
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
      { key: 'managerEmployeeId', required: false },
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
      { key: 'itemType', required: false },
      { key: 'uom', required: false },
      { key: 'listPrice', required: false },
      { key: 'currencyCode', required: false },
      { key: 'subsidiaryCode', required: false },
      { key: 'active', required: false },
    ],
    sampleRows: [
      ['ITEM-001', 'SKU-001', 'Product A', 'Premium product variant', 'product', 'EA', '99.99', 'USD', 'SUB-001', 'true'],
      ['ITEM-002', 'SKU-002', 'Service B', 'Consulting services', 'service', 'HR', '150.00', 'USD', 'SUB-001', 'true'],
      ['', 'SKU-003', 'Product C', 'Entry level product', 'product', 'EA', '49.99', 'EUR', 'SUB-002', 'true'],
    ],
  },
  employees: {
    label: 'Employees',
    fields: [
      { key: 'employeeId', required: false },
      { key: 'firstName', required: true },
      { key: 'lastName', required: true },
      { key: 'email', required: false },
      { key: 'phone', required: false },
      { key: 'title', required: false },
      { key: 'departmentCode', required: false },
      { key: 'subsidiaryCode', required: false },
      { key: 'managerEmployeeId', required: false },
      { key: 'active', required: false },
    ],
    sampleRows: [
      ['EMP-001', 'John', 'Smith', 'john.smith@company.com', '+1-555-0101', 'Sales Director', 'SALES', 'SUB-001', '', 'true'],
      ['EMP-002', 'Jane', 'Doe', 'jane.doe@company.com', '+1-555-0102', 'Engineering Lead', 'ENG', 'SUB-001', '', 'true'],
      ['EMP-003', 'Bob', 'Johnson', 'bob.johnson@company.com', '+1-555-0103', 'Sales Representative', 'SALES', 'SUB-001', 'EMP-001', 'true'],
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
      { key: 'entityCode', required: false },
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
      { key: 'entityCode', required: false },
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