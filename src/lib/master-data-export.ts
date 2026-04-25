import { prisma } from '@/lib/prisma'
import { fmtPhone, toNumericValue } from '@/lib/format'
import { displayMasterDataValue, formatMasterDataDate } from '@/lib/master-data-display'
import { loadManagedListsState } from '@/lib/manage-lists'
import {
  chartOfAccountsListDefinition,
  contactListDefinition,
  currencyListDefinition,
  customerListDefinition,
  departmentListDefinition,
  employeeListDefinition,
  itemListDefinition,
  locationListDefinition,
  accountingPeriodListDefinition,
  managedListDefinition,
  roleListDefinition,
  subsidiaryListDefinition,
  userListDefinition,
  vendorListDefinition,
} from '@/lib/master-data-list-definitions'

export type MasterDataExportResource =
  | 'users'
  | 'roles'
  | 'contacts'
  | 'customers'
  | 'vendors'
  | 'subsidiaries'
  | 'currencies'
  | 'locations'
  | 'accounting-periods'
  | 'items'
  | 'departments'
  | 'employees'
  | 'chart-of-accounts'
  | 'lists'
  | 'invoice-receipts'
  | 'invoices'
  | 'fulfillments'
  | 'sales-orders'
  | 'journals'

export type MasterDataExportPayload = {
  headers: string[]
  rows: string[][]
}

const INSENSITIVE = 'insensitive' as const

function text(value: unknown) {
  if (value === null || value === undefined) return '-'
  const normalized = String(value).trim()
  return normalized === '' ? '-' : normalized
}

function yesNo(value: boolean) {
  return value ? 'Yes' : 'No'
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function itemMoney(value: unknown) {
  if (value === null || value === undefined) return '-'
  return toNumericValue(value).toFixed(2)
}

function buildHeaders(labels: Array<{ id: string; label: string }>) {
  return labels.filter((column) => column.id !== 'actions').map((column) => column.label)
}

export async function buildMasterDataExportPayload(
  resource: MasterDataExportResource,
  query: string,
  sort: string,
): Promise<MasterDataExportPayload> {
  switch (resource) {
    case 'users': {
      const users = await prisma.user.findMany({
        where: query
          ? {
              OR: [
                { userId: { contains: query, mode: INSENSITIVE } },
                { name: { contains: query, mode: INSENSITIVE } },
                { email: { contains: query, mode: INSENSITIVE } },
                { role: { name: { contains: query, mode: INSENSITIVE } } },
                { defaultSubsidiary: { is: { subsidiaryId: { contains: query, mode: INSENSITIVE } } } },
                { subsidiaryAssignments: { some: { subsidiary: { subsidiaryId: { contains: query, mode: INSENSITIVE } } } } },
              ],
            }
          : {},
        include: {
          department: { select: { departmentId: true, name: true } },
          role: { select: { name: true } },
          defaultSubsidiary: { select: { subsidiaryId: true } },
          approvalCurrency: { select: { code: true } },
          delegatedApprover: { select: { userId: true, name: true, email: true } },
          subsidiaryAssignments: {
            include: { subsidiary: { select: { subsidiaryId: true } } },
            orderBy: { subsidiary: { subsidiaryId: 'asc' } },
          },
        },
        orderBy:
          sort === 'id'
            ? [{ userId: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ name: 'asc' }]
                : [{ createdAt: 'desc' }],
      })
      const employees = await prisma.employee.findMany({
        where: { userId: { not: null } },
        select: { userId: true, firstName: true, lastName: true, employeeId: true },
      })
      const employeeByUserId = new Map(
        employees.filter((employee) => employee.userId).map((employee) => [employee.userId as string, employee]),
      )
      return {
        headers: buildHeaders(userListDefinition.columns),
        rows: users.map((user) => {
          const linkedEmployee = employeeByUserId.get(user.id)
          return [
            text(user.userId ?? 'Pending'),
            text(user.name),
            text(user.email),
            text(user.role?.name),
            user.department ? `${user.department.departmentId} - ${user.department.name}` : '-',
            text(user.defaultSubsidiary?.subsidiaryId),
            user.subsidiaryAssignments.length > 0 ? user.subsidiaryAssignments.map((assignment) => assignment.subsidiary.subsidiaryId).join(', ') : '-',
            yesNo(user.includeChildren),
            user.approvalLimit === null || user.approvalLimit === undefined ? '-' : `${user.approvalLimit}${user.approvalCurrency ? ` ${user.approvalCurrency.code}` : ''}`,
            user.delegatedApprover ? text(user.delegatedApprover.userId ?? user.delegatedApprover.name ?? user.delegatedApprover.email) : '-',
            yesNo(user.locked),
            linkedEmployee ? `${linkedEmployee.firstName} ${linkedEmployee.lastName}${linkedEmployee.employeeId ? ` (${linkedEmployee.employeeId})` : ''}` : '-',
            yesNo(user.inactive),
            formatMasterDataDate(user.createdAt),
            formatMasterDataDate(user.updatedAt),
          ]
        }),
      }
    }
    case 'roles': {
      const roles = await prisma.role.findMany({
        where: query
          ? {
              OR: [
                { roleId: { contains: query, mode: INSENSITIVE } },
                { name: { contains: query, mode: INSENSITIVE } },
              ],
            }
          : {},
        include: {
          _count: { select: { users: true } },
          users: { select: { inactive: true } },
        },
        orderBy:
          sort === 'id'
            ? [{ roleId: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ name: 'asc' }]
                : [{ createdAt: 'desc' }],
      })
      return {
        headers: buildHeaders(roleListDefinition.columns),
        rows: roles.map((role) => {
          const inactiveUsers = role.users.filter((user) => user.inactive).length
          const activeUsers = role._count.users - inactiveUsers
          return [
            text(role.roleId),
            text(role.name),
            text(role.description),
            String(role._count.users),
            String(inactiveUsers),
            String(activeUsers),
            role.active ? 'No' : 'Yes',
            formatMasterDataDate(role.createdAt),
            formatMasterDataDate(role.updatedAt),
          ]
        }),
      }
    }
    case 'contacts': {
      const contacts = await prisma.contact.findMany({
        where: query
          ? {
              OR: [
                { contactNumber: { contains: query, mode: INSENSITIVE } },
                { firstName: { contains: query, mode: INSENSITIVE } },
                { lastName: { contains: query, mode: INSENSITIVE } },
                { email: { contains: query, mode: INSENSITIVE } },
                { phone: { contains: query, mode: INSENSITIVE } },
                { address: { contains: query, mode: INSENSITIVE } },
                { position: { contains: query, mode: INSENSITIVE } },
                { customer: { name: { contains: query, mode: INSENSITIVE } } },
                { vendor: { name: { contains: query, mode: INSENSITIVE } } },
              ],
            }
          : {},
        include: { customer: true, vendor: true },
        orderBy:
          sort === 'id'
            ? [{ contactNumber: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ lastName: 'asc' }, { firstName: 'asc' }]
                : [{ createdAt: 'desc' }],
      })
      return {
        headers: buildHeaders(contactListDefinition.columns),
        rows: contacts.map((contact) => [
          text(contact.contactNumber ?? 'Pending'),
          `${contact.firstName} ${contact.lastName}`.trim(),
          contact.customerId ? 'Customer' : contact.vendorId ? 'Vendor' : '-',
          text(contact.customer?.name ?? contact.vendor?.name),
          text(contact.email),
          text(fmtPhone(contact.phone)),
          text(contact.address),
          text(contact.position),
          contact.active ? 'No' : 'Yes',
          formatMasterDataDate(contact.createdAt),
          formatMasterDataDate(contact.updatedAt),
        ]),
      }
    }
    case 'customers': {
      const customers = await prisma.customer.findMany({
        where: query
          ? {
              OR: [
                { customerId: { contains: query, mode: INSENSITIVE } },
                { name: { contains: query, mode: INSENSITIVE } },
                { email: { contains: query, mode: INSENSITIVE } },
                { industry: { contains: query, mode: INSENSITIVE } },
              ],
            }
          : {},
        include: { subsidiary: true, currency: true },
        orderBy:
          sort === 'id'
            ? [{ customerId: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ name: 'asc' }, { createdAt: 'desc' }]
                : [{ createdAt: 'desc' }],
      })
      return {
        headers: buildHeaders(customerListDefinition.columns),
        rows: customers.map((customer) => [
          text(customer.customerId ?? 'Pending'),
          text(customer.name),
          customer.subsidiary ? `${customer.subsidiary.subsidiaryId} (${customer.subsidiary.name})` : '-',
          text(customer.currency?.code),
          displayMasterDataValue(customer.address),
          yesNo(customer.inactive),
          formatMasterDataDate(customer.createdAt),
          formatMasterDataDate(customer.updatedAt),
        ]),
      }
    }
    case 'vendors': {
      const vendors = await prisma.vendor.findMany({
        where: query
          ? {
              OR: [
                { vendorNumber: { contains: query, mode: INSENSITIVE } },
                { name: { contains: query, mode: INSENSITIVE } },
                { email: { contains: query, mode: INSENSITIVE } },
                { phone: { contains: query, mode: INSENSITIVE } },
                { taxId: { contains: query, mode: INSENSITIVE } },
              ],
            }
          : {},
        include: { subsidiary: true, currency: true },
        orderBy:
          sort === 'id'
            ? [{ vendorNumber: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ name: 'asc' }]
                : [{ createdAt: 'desc' }],
      })
      return {
        headers: buildHeaders(vendorListDefinition.columns),
        rows: vendors.map((vendor) => [
          text(vendor.vendorNumber ?? 'Pending'),
          text(vendor.name),
          vendor.subsidiary ? `${vendor.subsidiary.subsidiaryId} (${vendor.subsidiary.name})` : '-',
          text(vendor.currency?.code),
          text(vendor.email),
          text(fmtPhone(vendor.phone)),
          text(vendor.address),
          text(vendor.taxId),
          yesNo(vendor.inactive),
          formatMasterDataDate(vendor.createdAt),
          formatMasterDataDate(vendor.updatedAt),
        ]),
      }
    }
    case 'subsidiaries': {
      const subsidiaries = await prisma.subsidiary.findMany({
        where: query
          ? {
              OR: [
                { subsidiaryId: { contains: query, mode: INSENSITIVE } },
                { name: { contains: query, mode: INSENSITIVE } },
              ],
            }
          : {},
        include: { defaultCurrency: true, functionalCurrency: true, reportingCurrency: true, parentSubsidiary: true },
        orderBy:
          sort === 'id'
            ? [{ subsidiaryId: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ name: 'asc' }]
                : [{ createdAt: 'desc' }],
      })
      return {
        headers: buildHeaders(subsidiaryListDefinition.columns),
        rows: subsidiaries.map((subsidiary) => [
          text(subsidiary.subsidiaryId),
          text(subsidiary.name),
          text(subsidiary.country),
          text(subsidiary.address),
          text(subsidiary.taxId),
          subsidiary.parentSubsidiary ? `${subsidiary.parentSubsidiary.subsidiaryId} - ${subsidiary.parentSubsidiary.name}` : '-',
          text(subsidiary.legalName),
          text(subsidiary.entityType),
          text(subsidiary.defaultCurrency?.code),
          text(subsidiary.functionalCurrency?.code),
          text(subsidiary.reportingCurrency?.code),
          text(subsidiary.consolidationMethod),
          text(subsidiary.ownershipPercent),
          subsidiary.active ? 'No' : 'Yes',
          formatMasterDataDate(subsidiary.createdAt),
          formatMasterDataDate(subsidiary.updatedAt),
        ]),
      }
    }
    case 'currencies': {
      const currencies = await prisma.currency.findMany({
        where: query
          ? {
              OR: [
                { currencyId: { contains: query, mode: INSENSITIVE } },
                { code: { contains: query, mode: INSENSITIVE } },
                { name: { contains: query, mode: INSENSITIVE } },
              ],
            }
          : {},
        orderBy:
          sort === 'id'
            ? [{ currencyId: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ name: 'asc' }]
                : [{ createdAt: 'desc' }],
      })
      return {
        headers: buildHeaders(currencyListDefinition.columns),
        rows: currencies.map((currency) => [
          text(currency.currencyId),
          text(currency.code),
          text(currency.name),
          text(currency.symbol),
          text(currency.decimals),
          currency.active ? 'No' : 'Yes',
          formatMasterDataDate(currency.createdAt),
          formatMasterDataDate(currency.updatedAt),
        ]),
      }
    }
    case 'locations': {
      const locations = await prisma.location.findMany({
        where: query
          ? {
              OR: [
                { locationId: { contains: query, mode: INSENSITIVE } },
                { code: { contains: query, mode: INSENSITIVE } },
                { name: { contains: query, mode: INSENSITIVE } },
                { address: { contains: query, mode: INSENSITIVE } },
                { locationType: { contains: query, mode: INSENSITIVE } },
                { parentLocation: { is: { locationId: { contains: query, mode: INSENSITIVE } } } },
                { parentLocation: { is: { code: { contains: query, mode: INSENSITIVE } } } },
                { parentLocation: { is: { name: { contains: query, mode: INSENSITIVE } } } },
                { subsidiary: { is: { subsidiaryId: { contains: query, mode: INSENSITIVE } } } },
                { subsidiary: { is: { name: { contains: query, mode: INSENSITIVE } } } },
              ],
            }
          : {},
        include: { parentLocation: true, subsidiary: true },
        orderBy:
          sort === 'id'
            ? [{ locationId: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ name: 'asc' }, { locationId: 'asc' }]
                : [{ createdAt: 'desc' }],
      })
      return {
        headers: buildHeaders(locationListDefinition.columns),
        rows: locations.map((location) => [
          text(location.locationId),
          text(location.code),
          text(location.name),
          text(location.subsidiary?.subsidiaryId),
          location.parentLocation ? `${location.parentLocation.locationId} - ${location.parentLocation.name}` : '-',
          text(location.locationType),
          yesNo(location.makeInventoryAvailable),
          text(location.address),
          yesNo(location.inactive),
          formatMasterDataDate(location.createdAt),
          formatMasterDataDate(location.updatedAt),
        ]),
      }
    }
    case 'accounting-periods': {
      const periods = await prisma.accountingPeriod.findMany({
        where: query
          ? {
              OR: [
                { name: { contains: query, mode: INSENSITIVE } },
                { status: { contains: query, mode: INSENSITIVE } },
                { subsidiary: { is: { subsidiaryId: { contains: query, mode: INSENSITIVE } } } },
                { subsidiary: { is: { name: { contains: query, mode: INSENSITIVE } } } },
              ],
            }
          : {},
        include: { subsidiary: { select: { subsidiaryId: true, name: true } } },
        orderBy:
          sort === 'id'
            ? [{ name: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ name: 'asc' }]
                : [{ createdAt: 'desc' }],
      })
      return {
        headers: buildHeaders(accountingPeriodListDefinition.columns),
        rows: periods.map((period) => [
          text(period.name),
          formatMasterDataDate(period.startDate),
          formatMasterDataDate(period.endDate),
          period.subsidiary ? `${period.subsidiary.subsidiaryId} - ${period.subsidiary.name}` : '-',
          text(titleCase(period.status)),
          yesNo(period.closed),
          yesNo(period.arLocked),
          yesNo(period.apLocked),
          yesNo(period.inventoryLocked),
          formatMasterDataDate(period.closedAt),
          formatMasterDataDate(period.createdAt),
          formatMasterDataDate(period.updatedAt),
        ]),
      }
    }
    case 'items': {
      const items = await prisma.item.findMany({
        where: query
          ? {
              OR: [
                { name: { contains: query, mode: INSENSITIVE } },
                { itemId: { contains: query, mode: INSENSITIVE } },
                { externalId: { contains: query, mode: INSENSITIVE } },
                { sku: { contains: query, mode: INSENSITIVE } },
              ],
            }
          : {},
        include: {
          subsidiary: true,
          itemSubsidiaries: { include: { subsidiary: true }, orderBy: { subsidiary: { subsidiaryId: 'asc' } } },
          department: true,
          location: true,
          preferredVendor: true,
          currency: true,
          defaultRevRecTemplate: true,
          incomeAccount: true,
          deferredRevenueAccount: true,
          inventoryAccount: true,
          cogsExpenseAccount: true,
          deferredCostAccount: true,
        },
        orderBy:
          sort === 'id'
            ? [{ itemId: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ name: 'asc' }]
                : [{ createdAt: 'desc' }],
      })

      const rows = items.map((item) =>
        itemListDefinition.columns
          .filter((column) => column.id !== 'actions')
          .map((column) => {
            switch (column.id) {
              case 'itemId':
                return text(item.itemId)
              case 'name':
                return text(item.name)
              case 'inactive':
                return yesNo(!item.active)
              case 'listPrice':
                return itemMoney(item.listPrice)
              case 'standaloneSellingPrice':
                return itemMoney(item.standaloneSellingPrice)
              case 'standardCost':
                return itemMoney(item.standardCost)
              case 'averageCost':
                return itemMoney(item.averageCost)
              case 'subsidiaryIds':
                return item.itemSubsidiaries.length > 0
                  ? item.itemSubsidiaries.map((assignment) => assignment.subsidiary.subsidiaryId).join(', ')
                  : item.subsidiary?.subsidiaryId ?? '-'
              case 'includeChildren':
                return yesNo(item.includeChildren)
              case 'currencyId':
                return text(item.currency?.code)
              case 'departmentId':
                return item.department ? `${item.department.departmentId} - ${item.department.name}` : '-'
              case 'locationId':
                return item.location ? `${item.location.code} - ${item.location.name}` : '-'
              case 'preferredVendorId':
                return item.preferredVendor ? `${item.preferredVendor.vendorNumber ?? item.preferredVendor.id} - ${item.preferredVendor.name}` : '-'
              case 'defaultRevRecTemplateId':
                return item.defaultRevRecTemplate ? `${item.defaultRevRecTemplate.templateId} - ${item.defaultRevRecTemplate.name}` : '-'
              case 'incomeAccountId':
                return item.incomeAccount ? `${item.incomeAccount.accountId} - ${item.incomeAccount.name}` : '-'
              case 'deferredRevenueAccountId':
                return item.deferredRevenueAccount ? `${item.deferredRevenueAccount.accountId} - ${item.deferredRevenueAccount.name}` : '-'
              case 'inventoryAccountId':
                return item.inventoryAccount ? `${item.inventoryAccount.accountId} - ${item.inventoryAccount.name}` : '-'
              case 'cogsExpenseAccountId':
                return item.cogsExpenseAccount ? `${item.cogsExpenseAccount.accountId} - ${item.cogsExpenseAccount.name}` : '-'
              case 'deferredCostAccountId':
                return item.deferredCostAccount ? `${item.deferredCostAccount.accountId} - ${item.deferredCostAccount.name}` : '-'
              case 'allocationEligible':
              case 'dropShipItem':
              case 'specialOrderItem':
              case 'canBeFulfilled':
              case 'directRevenuePosting':
                return yesNo(Boolean(item[column.id]))
              case 'created':
                return formatMasterDataDate(item.createdAt)
              case 'last-modified':
                return formatMasterDataDate(item.updatedAt)
              default:
                return text(item[column.id as keyof typeof item])
            }
          }),
      )
      return { headers: buildHeaders(itemListDefinition.columns), rows }
    }
    case 'departments': {
      const departments = await prisma.department.findMany({
        where: query
          ? {
              OR: [
                { departmentId: { contains: query, mode: INSENSITIVE } },
                { departmentNumber: { contains: query, mode: INSENSITIVE } },
                { name: { contains: query, mode: INSENSITIVE } },
                { description: { contains: query, mode: INSENSITIVE } },
                { division: { contains: query, mode: INSENSITIVE } },
                { planningCategory: { contains: query, mode: INSENSITIVE } },
              ],
            }
          : {},
        include: {
          departmentSubsidiaries: {
            include: { subsidiary: true },
            orderBy: { subsidiary: { subsidiaryId: 'asc' } },
          },
          manager: { select: { firstName: true, lastName: true, employeeId: true } },
          approver: { select: { firstName: true, lastName: true, employeeId: true } },
        },
        orderBy:
          sort === 'id'
            ? [{ departmentId: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ name: 'asc' }, { departmentId: 'asc' }]
                : [{ createdAt: 'desc' }],
      })
      return {
        headers: buildHeaders(departmentListDefinition.columns),
        rows: departments.map((department) => [
          text(department.departmentId),
          text(department.departmentNumber),
          text(department.name),
          text(department.description),
          text(department.division),
          department.departmentSubsidiaries.length > 0 ? department.departmentSubsidiaries.map(({ subsidiary }) => subsidiary.subsidiaryId).join(', ') : '-',
          yesNo(department.includeChildren),
          text(department.planningCategory),
          department.manager ? `${department.manager.firstName} ${department.manager.lastName}${department.manager.employeeId ? ` (${department.manager.employeeId})` : ''}` : '-',
          department.approver ? `${department.approver.firstName} ${department.approver.lastName}${department.approver.employeeId ? ` (${department.approver.employeeId})` : ''}` : '-',
          department.active ? 'No' : 'Yes',
          formatMasterDataDate(department.createdAt),
          formatMasterDataDate(department.updatedAt),
        ]),
      }
    }
    case 'employees': {
      const queryTokens = query.split(/\s+/).filter(Boolean)
      const employeeSearchFields = (value: string) => [
        { employeeId: { contains: value, mode: INSENSITIVE } },
        { eid: { contains: value, mode: INSENSITIVE } },
        { firstName: { contains: value, mode: INSENSITIVE } },
        { lastName: { contains: value, mode: INSENSITIVE } },
        { email: { contains: value, mode: INSENSITIVE } },
        { title: { contains: value, mode: INSENSITIVE } },
        { laborType: { contains: value, mode: INSENSITIVE } },
        { departmentRef: { is: { departmentId: { contains: value, mode: INSENSITIVE } } } },
        { departmentRef: { is: { name: { contains: value, mode: INSENSITIVE } } } },
      ]
      const employees = await prisma.employee.findMany({
        where: query
          ? { AND: queryTokens.map((token) => ({ OR: employeeSearchFields(token) })) }
          : {},
        include: {
          employeeSubsidiaries: {
            include: { subsidiary: true },
            orderBy: { subsidiary: { subsidiaryId: 'asc' } },
          },
          departmentRef: true,
          user: { select: { userId: true, name: true, email: true } },
        },
        orderBy:
          sort === 'id'
            ? [{ employeeId: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ lastName: 'asc' }, { firstName: 'asc' }]
                : [{ createdAt: 'desc' }],
      })
      return {
        headers: buildHeaders(employeeListDefinition.columns),
        rows: employees.map((employee) => [
          text(employee.employeeId ?? 'Pending'),
          text(employee.eid),
          `${employee.firstName} ${employee.lastName}`.trim(),
          text(employee.email),
          text(employee.title),
          text(employee.laborType),
          text(employee.departmentRef?.departmentId),
          employee.employeeSubsidiaries.map((assignment) => assignment.subsidiary.subsidiaryId).join(', ') || '-',
          yesNo(employee.includeChildren),
          employee.user ? `${employee.user.name ?? employee.user.email}${employee.user.userId ? ` (${employee.user.userId})` : ''}` : '-',
          employee.active ? 'No' : 'Yes',
          formatMasterDataDate(employee.createdAt),
          formatMasterDataDate(employee.updatedAt),
        ]),
      }
    }
    case 'chart-of-accounts': {
      const accounts = await prisma.chartOfAccounts.findMany({
        where: query
          ? {
              OR: [
                { accountId: { contains: query, mode: INSENSITIVE } },
                { accountNumber: { contains: query, mode: INSENSITIVE } },
                { name: { contains: query, mode: INSENSITIVE } },
                { accountType: { contains: query, mode: INSENSITIVE } },
                { description: { contains: query, mode: INSENSITIVE } },
              ],
            }
          : {},
        include: {
          parentAccount: { select: { accountId: true, name: true } },
          parentSubsidiary: { select: { subsidiaryId: true } },
          subsidiaryAssignments: {
            include: { subsidiary: { select: { subsidiaryId: true } } },
            orderBy: { subsidiary: { subsidiaryId: 'asc' } },
          },
        },
        orderBy:
          sort === 'id'
            ? [{ accountId: 'asc' }, { accountNumber: 'asc' }, { createdAt: 'desc' }]
            : sort === 'oldest'
              ? [{ createdAt: 'asc' }]
              : sort === 'name'
                ? [{ name: 'asc' }]
                : [{ createdAt: 'desc' }],
      })
      return {
        headers: buildHeaders(chartOfAccountsListDefinition.columns),
        rows: accounts.map((account) => [
          text(account.accountId),
          text(account.accountNumber),
          text(account.name),
          text(account.description),
          text(account.accountType),
          text(account.normalBalance),
          text(account.financialStatementSection),
          text(account.financialStatementGroup),
          text(account.financialStatementCategory),
          account.parentAccount ? `${account.parentAccount.accountId} - ${account.parentAccount.name}` : '-',
          yesNo(account.isPosting),
          yesNo(account.isControlAccount),
          yesNo(account.inventory),
          yesNo(account.summary),
          account.parentSubsidiary
            ? account.parentSubsidiary.subsidiaryId
            : account.subsidiaryAssignments.length > 0
              ? account.subsidiaryAssignments.map((entry) => entry.subsidiary.subsidiaryId).join(', ')
              : '-',
          yesNo(account.includeChildren),
          formatMasterDataDate(account.createdAt),
        ]),
      }
    }
    case 'lists': {
      const { lists } = await loadManagedListsState()
      const loweredQuery = query.trim().toLowerCase()
      const filteredLists = loweredQuery
        ? lists.filter((list) => [list.key, list.label, list.whereUsed.join(' ')].join(' ').toLowerCase().includes(loweredQuery))
        : lists
      const sortedLists = [...filteredLists].sort((a, b) => {
        if (sort === 'name') return a.label.localeCompare(b.label)
        if (sort === 'oldest') return a.key.localeCompare(b.key)
        if (sort === 'newest') return b.key.localeCompare(a.key)
        return a.key.localeCompare(b.key)
      })
      return {
        headers: buildHeaders(managedListDefinition.columns),
        rows: sortedLists.map((list) => [
          text(list.key),
          text(list.label),
          text(list.whereUsed.join(', ') || '-'),
          String(list.valueCount),
          list.displayOrder === 'alpha' ? 'Alphabetical' : 'List Order',
          list.systemManaged ? 'Standard' : 'Custom',
        ]),
      }
    }
    case 'invoice-receipts': {
      const receipts = await prisma.cashReceipt.findMany({
        where: query
          ? {
              OR: [
                { number: { contains: query, mode: INSENSITIVE } },
                { id: { contains: query, mode: INSENSITIVE } },
                { invoiceId: { contains: query, mode: INSENSITIVE } },
                { method: { contains: query, mode: INSENSITIVE } },
                { reference: { contains: query, mode: INSENSITIVE } },
                { invoice: { is: { number: { contains: query, mode: INSENSITIVE } } } },
              ],
            }
          : {},
        include: {
          invoice: {
            include: {
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: sort === 'oldest' ? [{ createdAt: 'asc' }] : [{ createdAt: 'desc' }],
      })

      return {
        headers: [
          'Invoice Receipt Id',
          'Invoice',
          'Customer',
          'Amount',
          'Date',
          'Method',
          'Reference',
          'DB Id',
          'Created',
          'Last Modified',
        ],
        rows: receipts.map((receipt) => [
          text(receipt.number ?? receipt.id),
          text(receipt.invoice?.number),
          text(receipt.invoice?.customer?.name),
          text(toNumericValue(receipt.amount).toFixed(2)),
          formatMasterDataDate(receipt.date),
          text(receipt.method),
          text(receipt.reference),
          text(receipt.id),
          formatMasterDataDate(receipt.createdAt),
          formatMasterDataDate(receipt.updatedAt),
        ]),
      }
    }
    case 'invoices': {
      const invoices = await prisma.invoice.findMany({
        where: query
          ? {
              OR: [
                { number: { contains: query, mode: INSENSITIVE } },
                { id: { contains: query, mode: INSENSITIVE } },
                { status: { contains: query, mode: INSENSITIVE } },
                { salesOrderId: { contains: query, mode: INSENSITIVE } },
                { customer: { is: { name: { contains: query, mode: INSENSITIVE } } } },
                { salesOrder: { is: { number: { contains: query, mode: INSENSITIVE } } } },
              ],
            }
          : {},
        include: {
          customer: { select: { name: true } },
          salesOrder: { select: { number: true } },
          subsidiary: { select: { name: true } },
          currency: { select: { code: true } },
        },
        orderBy: sort === 'oldest' ? [{ createdAt: 'asc' }] : [{ createdAt: 'desc' }],
      })

      return {
        headers: [
          'Invoice Id',
          'Customer',
          'Sales Order',
          'Status',
          'Total',
          'Due Date',
          'Paid Date',
          'Subsidiary',
          'Currency',
          'DB Id',
          'Created',
          'Last Modified',
        ],
        rows: invoices.map((invoice) => [
          text(invoice.number),
          text(invoice.customer?.name),
          text(invoice.salesOrder?.number),
          text(invoice.status),
          text(toNumericValue(invoice.total).toFixed(2)),
          formatMasterDataDate(invoice.dueDate),
          formatMasterDataDate(invoice.paidDate),
          text(invoice.subsidiary?.name),
          text(invoice.currency?.code),
          text(invoice.id),
          formatMasterDataDate(invoice.createdAt),
          formatMasterDataDate(invoice.updatedAt),
        ]),
      }
    }
    case 'fulfillments': {
      const fulfillments = await prisma.fulfillment.findMany({
        where: query
          ? {
              OR: [
                { number: { contains: query, mode: INSENSITIVE } },
                { id: { contains: query, mode: INSENSITIVE } },
                { status: { contains: query, mode: INSENSITIVE } },
                { salesOrderId: { contains: query, mode: INSENSITIVE } },
                { notes: { contains: query, mode: INSENSITIVE } },
                { salesOrder: { is: { number: { contains: query, mode: INSENSITIVE } } } },
                { salesOrder: { is: { customer: { is: { name: { contains: query, mode: INSENSITIVE } } } } } },
              ],
            }
          : {},
        include: {
          salesOrder: {
            include: {
              customer: { select: { name: true } },
            },
          },
          subsidiary: { select: { name: true } },
          currency: { select: { code: true } },
        },
        orderBy: sort === 'oldest' ? [{ createdAt: 'asc' }] : [{ createdAt: 'desc' }],
      })

      return {
        headers: [
          'Fulfillment Id',
          'Sales Order',
          'Customer',
          'Status',
          'Date',
          'Subsidiary',
          'Currency',
          'Notes',
          'DB Id',
          'Created',
          'Last Modified',
        ],
        rows: fulfillments.map((fulfillment) => [
          text(fulfillment.number),
          text(fulfillment.salesOrder?.number),
          text(fulfillment.salesOrder?.customer?.name),
          text(fulfillment.status),
          formatMasterDataDate(fulfillment.date),
          text(fulfillment.subsidiary?.name),
          text(fulfillment.currency?.code),
          text(fulfillment.notes),
          text(fulfillment.id),
          formatMasterDataDate(fulfillment.createdAt),
          formatMasterDataDate(fulfillment.updatedAt),
        ]),
      }
    }
    case 'sales-orders': {
      const salesOrders = await prisma.salesOrder.findMany({
        where: query
          ? {
              OR: [
                { number: { contains: query, mode: INSENSITIVE } },
                { id: { contains: query, mode: INSENSITIVE } },
                { status: { contains: query, mode: INSENSITIVE } },
                { customer: { is: { name: { contains: query, mode: INSENSITIVE } } } },
                { customer: { is: { customerId: { contains: query, mode: INSENSITIVE } } } },
                { user: { is: { userId: { contains: query, mode: INSENSITIVE } } } },
                { quote: { is: { number: { contains: query, mode: INSENSITIVE } } } },
                { quote: { is: { opportunity: { is: { opportunityNumber: { contains: query, mode: INSENSITIVE } } } } } },
              ],
            }
          : {},
        include: {
          customer: { select: { customerId: true, name: true } },
          user: { select: { userId: true } },
          quote: {
            select: {
              number: true,
              opportunity: { select: { opportunityNumber: true } },
            },
          },
          subsidiary: { select: { subsidiaryId: true, name: true } },
          currency: { select: { currencyId: true, code: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
      })

      return {
        headers: [
          'Sales Order Id',
          'Customer Id',
          'Quote',
          'Opportunity Id',
          'Status',
          'Total',
          'Subsidiary Id',
          'Customer',
          'User Id',
          'Subsidiary',
          'Currency Id',
          'Currency',
          'DB Id',
          'Created',
          'Last Modified',
        ],
        rows: salesOrders.map((salesOrder) => [
          text(salesOrder.number),
          text(salesOrder.customer?.customerId),
          text(salesOrder.quote?.number),
          text(salesOrder.quote?.opportunity?.opportunityNumber),
          text(salesOrder.status),
          text(toNumericValue(salesOrder.total).toFixed(2)),
          text(salesOrder.subsidiary?.subsidiaryId),
          text(salesOrder.customer?.name),
          text(salesOrder.user?.userId),
          text(salesOrder.subsidiary?.name),
          text(salesOrder.currency?.currencyId ?? salesOrder.currency?.code),
          text(salesOrder.currency?.code),
          text(salesOrder.id),
          formatMasterDataDate(salesOrder.createdAt),
          formatMasterDataDate(salesOrder.updatedAt),
        ]),
      }
    }
    case 'journals': {
      const journals = await prisma.journalEntry.findMany({
        where: query
          ? {
              journalType: 'standard',
              OR: [
                { number: { contains: query, mode: INSENSITIVE } },
                { description: { contains: query, mode: INSENSITIVE } },
                { status: { contains: query, mode: INSENSITIVE } },
              ],
            }
          : { journalType: 'standard' },
        include: {
          subsidiary: { select: { name: true } },
          currency: { select: { code: true } },
          accountingPeriod: { select: { name: true } },
          postedByEmployee: { select: { firstName: true, lastName: true } },
          approvedByEmployee: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
      })

      return {
        headers: [
          'Journal Id',
          'Date',
          'Description',
          'Status',
          'Total',
          'Subsidiary',
          'Currency',
          'Accounting Period',
          'Prepared By',
          'Created',
          'Last Modified',
        ],
        rows: journals.map((journal) => [
          text(journal.number),
          formatMasterDataDate(journal.date),
          text(journal.description),
          text(journal.status),
          text(toNumericValue(journal.total).toFixed(2)),
          text(journal.subsidiary?.name),
          text(journal.currency?.code),
          text(journal.accountingPeriod?.name),
          journal.postedByEmployee ? `${journal.postedByEmployee.firstName} ${journal.postedByEmployee.lastName}` : '-',
          formatMasterDataDate(journal.createdAt),
          formatMasterDataDate(journal.updatedAt),
        ]),
      }
    }
    default:
      throw new Error(`Unsupported export resource: ${resource satisfies never}`)
  }
}
