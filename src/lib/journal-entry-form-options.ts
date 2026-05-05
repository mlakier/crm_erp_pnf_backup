import { prisma } from '@/lib/prisma'
import { loadListValues } from '@/lib/load-list-values'
import { getAccountingActivityTypeOptions } from '@/lib/accounting-activity-types'

export async function loadJournalEntryFormOptions() {
  const [entities, accounts, departments, locations, projects, customers, vendors, items, currencies, accountingPeriods, employees, journalEntries, openItems, statusValues, sourceTypeValues] = await Promise.all([
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.chartOfAccounts.findMany({
      where: { active: true, isPosting: true },
      orderBy: [{ accountNumber: 'asc' }, { accountId: 'asc' }],
      select: { id: true, accountId: true, accountNumber: true, name: true },
    }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: [{ departmentNumber: 'asc' }, { departmentId: 'asc' }],
      select: { id: true, departmentId: true, departmentNumber: true, name: true },
    }),
    prisma.location.findMany({
      where: { inactive: false },
      orderBy: [{ code: 'asc' }, { locationId: 'asc' }],
      select: { id: true, locationId: true, code: true, name: true },
    }),
    prisma.project.findMany({
      where: { inactive: false },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    }),
    prisma.customer.findMany({ where: { inactive: false }, orderBy: { name: 'asc' }, select: { id: true, customerId: true, name: true } }),
    prisma.vendor.findMany({ where: { inactive: false }, orderBy: { name: 'asc' }, select: { id: true, vendorNumber: true, name: true } }),
    prisma.item.findMany({
      where: { active: true },
      orderBy: [{ sku: 'asc' }, { itemId: 'asc' }],
      select: { id: true, itemId: true, sku: true, name: true },
    }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, currencyId: true, code: true, name: true } }),
    prisma.accountingPeriod.findMany({
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true, startDate: true, endDate: true, subsidiaryId: true, closed: true, status: true },
    }),
    prisma.employee.findMany({
      orderBy: [{ eid: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, employeeId: true, eid: true, firstName: true, lastName: true },
    }),
    prisma.journalEntry.findMany({
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      take: 500,
      select: { id: true, number: true, description: true, journalType: true, status: true },
    }),
    prisma.openItem.findMany({
      where: { isOpen: true },
      orderBy: [{ postingDate: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
      select: {
        id: true,
        openItemNumber: true,
        sourceNumber: true,
        openItemType: true,
        counterpartyType: true,
        counterpartyId: true,
        sourceTransactionType: true,
        sourceTransactionId: true,
        originalTransactionAmount: true,
        status: true,
      },
    }),
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
    accountingPeriods: accountingPeriods.map((period) => ({
      ...period,
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
    })),
    employees,
    journalEntries: journalEntries.map((journal) => ({
      id: journal.id,
      number: journal.number,
      description: journal.description,
      journalType: journal.journalType,
      status: journal.status,
    })),
    openItems: openItems.map((openItem) => ({
      id: openItem.id,
      openItemNumber: openItem.openItemNumber,
      sourceNumber: openItem.sourceNumber,
      openItemType: openItem.openItemType,
      counterpartyType: openItem.counterpartyType,
      counterpartyId: openItem.counterpartyId,
      sourceTransactionType: openItem.sourceTransactionType,
      sourceTransactionId: openItem.sourceTransactionId,
      originalTransactionAmount: openItem.originalTransactionAmount.toString(),
      status: openItem.status,
    })),
    statusOptions: statusValues.map((value) => ({ value: value.toLowerCase(), label: value })),
    statusFilterValues: ['all', ...statusValues.map((value) => value.toLowerCase())],
    sourceTypeOptions: sourceTypeValues.map((value) => ({ value, label: value })),
    activityTypeOptions: getAccountingActivityTypeOptions(),
  }
}
