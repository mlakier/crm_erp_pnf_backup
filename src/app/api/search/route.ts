import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/* ── Static page definitions (mirrors sidebar nav) ────────────────────── */
const PAGES = [
  { label: 'Dashboard',             href: '/dashboard' },
  { label: 'Company Information',   href: '/company-information' },
  { label: 'Company Prefs',         href: '/company-preferences' },
  { label: 'File Cabinet',          href: '/company-information/file-cabinet' },
  { label: 'Manage Lists',          href: '/lists' },
  { label: 'Manage Integrations',   href: '/integrations' },
  { label: 'Manage Permissions',    href: '/manage-permissions' },
  { label: 'Import Master Data',    href: '/master-data-import' },
  { label: 'Users',                 href: '/users' },
  { label: 'Roles',                 href: '/roles' },
  { label: 'Contacts',              href: '/contacts' },
  { label: 'Customers',             href: '/customers' },
  { label: 'Vendors',               href: '/vendors' },
  { label: 'Subsidiaries',          href: '/subsidiaries' },
  { label: 'Currencies',            href: '/currencies' },
  { label: 'Locations',             href: '/locations' },
  { label: 'Accounting Periods',    href: '/accounting-periods' },
  { label: 'Items',                 href: '/items' },
  { label: 'Chart of Accounts',     href: '/chart-of-accounts' },
  { label: 'Departments',           href: '/departments' },
  { label: 'Employees',             href: '/employees' },
  { label: 'OTC Workflow',          href: '/otc-workflow' },
  { label: 'PTP Workflow',          href: '/ptp-workflow' },
  { label: 'Leads',                 href: '/leads' },
  { label: 'Opportunities',         href: '/opportunities' },
  { label: 'Quotes',                href: '/quotes' },
  { label: 'Sales Orders',          href: '/sales-orders' },
  { label: 'Fulfillments',          href: '/fulfillments' },
  { label: 'Invoices',              href: '/invoices' },
  { label: 'Invoice Receipts',      href: '/invoice-receipts' },
  { label: 'AP Portal',             href: '/ap' },
  { label: 'Purchase Requisitions', href: '/purchase-requisitions' },
  { label: 'Purchase Orders',       href: '/purchase-orders' },
  { label: 'Receipts',              href: '/receipts' },
  { label: 'Bills',                 href: '/bills' },
  { label: 'Bill Payments',         href: '/bill-payments' },
  { label: 'Journals',              href: '/journals' },
  { label: 'Intercompany Journals', href: '/intercompany-journals' },
]

/* ── Record search helpers ─────────────────────────────────────────────── */
type Hit = { type: 'page' | 'record' | 'list' | 'listValue' | 'field' | 'fieldValue'; label: string; href: string; detail?: string }

async function searchRecords(q: string, limit: number): Promise<Hit[]> {
  const hits: Hit[] = []
  const [customers, contacts, vendors, leads, items, employees, departments, locations, accountingPeriods, opportunities] = await Promise.all([
    prisma.customer.findMany({ where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { customerId: { contains: q, mode: 'insensitive' } }] }, take: limit, select: { id: true, name: true, customerId: true } }),
    prisma.contact.findMany({ where: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }, take: limit, select: { id: true, firstName: true, lastName: true, email: true } }),
    prisma.vendor.findMany({ where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { vendorNumber: { contains: q, mode: 'insensitive' } }] }, take: limit, select: { id: true, name: true, vendorNumber: true } }),
    prisma.lead.findMany({ where: { OR: [{ company: { contains: q, mode: 'insensitive' } }, { firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] }, take: limit, select: { id: true, company: true, firstName: true, lastName: true } }),
    prisma.item.findMany({ where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { itemId: { contains: q, mode: 'insensitive' } }] }, take: limit, select: { id: true, name: true, itemId: true } }),
    prisma.employee.findMany({ where: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] }, take: limit, select: { id: true, firstName: true, lastName: true } }),
    prisma.department.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: limit, select: { id: true, name: true } }),
    prisma.location.findMany({
      where: {
        OR: [
          { locationId: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { subsidiary: { is: { subsidiaryId: { contains: q, mode: 'insensitive' } } } },
          { subsidiary: { is: { name: { contains: q, mode: 'insensitive' } } } },
        ],
      },
      take: limit,
      select: { id: true, locationId: true, code: true, name: true, subsidiary: { select: { subsidiaryId: true } } },
    }),
    prisma.accountingPeriod.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { status: { contains: q, mode: 'insensitive' } },
          { subsidiary: { is: { subsidiaryId: { contains: q, mode: 'insensitive' } } } },
          { subsidiary: { is: { name: { contains: q, mode: 'insensitive' } } } },
        ],
      },
      take: limit,
      select: { id: true, name: true, status: true, subsidiary: { select: { subsidiaryId: true } } },
    }),
    prisma.opportunity.findMany({ where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { opportunityNumber: { contains: q, mode: 'insensitive' } }] }, take: limit, select: { id: true, name: true, opportunityNumber: true } }),
  ])

  for (const r of customers) hits.push({ type: 'record', label: r.name, href: `/customers/${r.id}`, detail: `Customer ${r.customerId || ''}` })
  for (const r of contacts) hits.push({ type: 'record', label: `${r.firstName} ${r.lastName}`, href: `/contacts/${r.id}`, detail: r.email || 'Contact' })
  for (const r of vendors) hits.push({ type: 'record', label: r.name, href: `/vendors/${r.id}`, detail: `Vendor ${r.vendorNumber || ''}` })
  for (const r of leads) hits.push({ type: 'record', label: `${r.firstName} ${r.lastName}`, href: `/leads/${r.id}`, detail: r.company || 'Lead' })
  for (const r of items) hits.push({ type: 'record', label: r.name, href: `/items/${r.id}`, detail: `Item ${r.itemId || ''}` })
  for (const r of employees) hits.push({ type: 'record', label: `${r.firstName} ${r.lastName}`, href: `/employees/${r.id}`, detail: 'Employee' })
  for (const r of departments) hits.push({ type: 'record', label: r.name, href: `/departments/${r.id}`, detail: 'Department' })
  for (const r of locations) hits.push({ type: 'record', label: r.name, href: '/locations', detail: `${r.locationId} - ${r.code}${r.subsidiary ? ` - ${r.subsidiary.subsidiaryId}` : ''}` })
  for (const r of accountingPeriods) hits.push({ type: 'record', label: r.name, href: `/accounting-periods/${r.id}`, detail: `${r.status}${r.subsidiary ? ` - ${r.subsidiary.subsidiaryId}` : ''}` })
  for (const r of opportunities) hits.push({ type: 'record', label: r.name, href: `/opportunities/${r.id}`, detail: `Opportunity ${r.opportunityNumber || ''}` })

  return hits
}

/* ── Main handler ──────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const lower = q.toLowerCase()
  const limit = 5

  // 1. Pages
  const pages: Hit[] = PAGES
    .filter(p => p.label.toLowerCase().includes(lower))
    .slice(0, limit)
    .map(p => ({ type: 'page', label: p.label, href: p.href }))

  // 2. Records
  let records: Hit[] = []
  try {
    records = await searchRecords(q, limit)
  } catch (e) {
    console.error('Search records error:', e)
  }

  // 3. Lists (distinct keys from ListOption table)
  let listHits: Hit[] = []
  try {
    const listKeys = await prisma.listOption.findMany({
      where: { key: { contains: q, mode: 'insensitive' } },
      distinct: ['key'],
      take: limit,
      select: { key: true },
      orderBy: { key: 'asc' },
    })
    listHits = listKeys.map(r => ({
      type: 'list' as const,
      label: r.key.replace(/^LIST-/, '').replace(/-/g, ' '),
      href: '/lists',
      detail: r.key,
    }))
  } catch (e) { console.error('Search lists error:', e) }

  // 4. List values (individual ListOption rows by value/label)
  let listValueHits: Hit[] = []
  try {
    const listVals = await prisma.listOption.findMany({
      where: { OR: [
        { value: { contains: q, mode: 'insensitive' } },
        { label: { contains: q, mode: 'insensitive' } },
      ] },
      take: limit,
      select: { key: true, value: true, label: true },
    })
    listValueHits = listVals.map(r => ({
      type: 'listValue' as const,
      label: r.label || r.value,
      href: '/lists',
      detail: r.key.replace(/^LIST-/, '').replace(/-/g, ' '),
    }))
  } catch (e) { console.error('Search list values error:', e) }

  // 5. Fields (CustomFieldDefinition by name/label)
  let fieldHits: Hit[] = []
  try {
    const fields = await prisma.customFieldDefinition.findMany({
      where: { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { label: { contains: q, mode: 'insensitive' } },
      ] },
      take: limit,
      select: { id: true, name: true, label: true, entityType: true, type: true },
    })
    fieldHits = fields.map(r => ({
      type: 'field' as const,
      label: r.label || r.name,
      href: '/lists',
      detail: `${r.entityType} · ${r.type} field`,
    }))
  } catch (e) { console.error('Search fields error:', e) }

  // 6. Field values (CustomFieldValue by value)
  let fieldValueHits: Hit[] = []
  try {
    const fieldVals = await prisma.customFieldValue.findMany({
      where: { value: { contains: q, mode: 'insensitive' } },
      take: limit,
      select: { value: true, entityType: true, recordId: true, field: { select: { label: true, name: true } } },
    })
    fieldValueHits = fieldVals.map(r => ({
      type: 'fieldValue' as const,
      label: r.value,
      href: '#',
      detail: `${r.field.label || r.field.name} · ${r.entityType}`,
    }))
  } catch (e) { console.error('Search field values error:', e) }

  return NextResponse.json({ results: [...pages, ...records, ...listHits, ...listValueHits, ...fieldHits, ...fieldValueHits] })
}
