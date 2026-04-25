import { prisma } from '@/lib/prisma'
import { loadListValues } from '@/lib/load-list-values'

export async function loadJournalEntryFormOptions() {
  const [entities, accounts, departments, locations, projects, customers, vendors, items, currencies, accountingPeriods, employees, statusValues, sourceTypeValues] = await Promise.all([
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.chartOfAccounts.findMany({ where: { active: true, isPosting: true }, orderBy: { accountId: 'asc' }, select: { id: true, accountId: true, name: true } }),
    prisma.department.findMany({ where: { active: true }, orderBy: { departmentId: 'asc' }, select: { id: true, departmentId: true, name: true } }),
    prisma.location.findMany({ where: { inactive: false }, orderBy: { locationId: 'asc' }, select: { id: true, locationId: true, name: true } }),
    prisma.project.findMany({ where: { inactive: false }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.customer.findMany({ where: { inactive: false }, orderBy: { name: 'asc' }, select: { id: true, customerId: true, name: true } }),
    prisma.vendor.findMany({ where: { inactive: false }, orderBy: { name: 'asc' }, select: { id: true, vendorNumber: true, name: true } }),
    prisma.item.findMany({ where: { active: true }, orderBy: { itemId: 'asc' }, select: { id: true, itemId: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, currencyId: true, code: true, name: true } }),
    prisma.accountingPeriod.findMany({ orderBy: { startDate: 'desc' }, select: { id: true, name: true } }),
    prisma.employee.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], select: { id: true, employeeId: true, firstName: true, lastName: true } }),
    loadListValues('JOURNAL-STATUS'),
    loadListValues('JOURNAL-SOURCE-TYPE'),
  ])

  return {
    entities,
    accounts,
    departments,
    locations,
    projects,
    customers,
    vendors,
    items,
    currencies,
    accountingPeriods,
    employees,
    statusOptions: statusValues.map((value) => ({ value: value.toLowerCase(), label: value })),
    statusFilterValues: ['all', ...statusValues.map((value) => value.toLowerCase())],
    sourceTypeOptions: sourceTypeValues.map((value) => ({ value, label: value })),
  }
}
