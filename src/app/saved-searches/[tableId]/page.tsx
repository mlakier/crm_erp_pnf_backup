import { getServerSession } from 'next-auth/next'
import SavedSearchEditorClient from '@/components/SavedSearchEditorClient'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildUsersSavedSearchMetadata } from '@/lib/users-saved-search-metadata'
import { buildChartOfAccountsSavedSearchMetadata } from '@/lib/chart-of-accounts-saved-search-metadata'
import { buildPurchaseOrdersSavedSearchMetadata } from '@/lib/purchase-orders-saved-search-metadata'
import { buildPurchaseRequisitionsSavedSearchMetadata } from '@/lib/purchase-requisitions-saved-search-metadata'
import { buildReceiptsSavedSearchMetadata } from '@/lib/receipts-saved-search-metadata'
import { loadSavedSearchBuiltInBaseline } from '@/lib/saved-search-builtins-store'
import { loadListValues } from '@/lib/load-list-values'

export default async function SavedSearchEditorPage({
  params,
}: {
  params: Promise<{ tableId: string }>
}) {
  const { tableId } = await params
  const session = await getServerSession(authOptions)
  const [roles, departments, subsidiaries, employees, approverUsers, purchaseOrderStatuses, purchaseOrderVendors, purchaseOrderCurrencies, purchaseOrderRequisitions, receiptStatuses, receiptPurchaseOrders, requisitionStatuses, requisitionVendors, chartOfAccounts, accountTypeValues, normalBalanceValues, fsCategoryValues, accountRoleValues, rollforwardCategoryValues] = await Promise.all([
    prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({ orderBy: [{ departmentId: 'asc' }, { name: 'asc' }], select: { id: true, departmentId: true, name: true } }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.employee.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, employeeId: true, userId: true },
    }),
    prisma.user.findMany({ orderBy: [{ userId: 'asc' }, { name: 'asc' }], select: { id: true, userId: true, name: true, email: true } }),
    tableId === 'purchase-orders-list' ? loadListValues('PO-STATUS') : Promise.resolve([]),
    tableId === 'purchase-orders-list'
      ? prisma.vendor.findMany({
          where: { inactive: false },
          orderBy: [{ vendorNumber: 'asc' }, { name: 'asc' }],
          select: { id: true, vendorNumber: true, name: true },
        })
      : Promise.resolve([]),
    tableId === 'purchase-orders-list'
      ? prisma.currency.findMany({
          where: { active: true },
          orderBy: [{ code: 'asc' }, { name: 'asc' }],
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([]),
    tableId === 'purchase-orders-list'
      ? prisma.requisition.findMany({
          orderBy: [{ number: 'asc' }],
          select: { id: true, number: true, title: true },
        })
      : Promise.resolve([]),
    tableId === 'receipts-list' ? loadListValues('RECEIPT-STATUS') : Promise.resolve([]),
    tableId === 'receipts-list'
      ? prisma.purchaseOrder.findMany({
          orderBy: [{ number: 'asc' }],
          select: { id: true, number: true },
        })
      : Promise.resolve([]),
    tableId === 'requisitions-list' ? loadListValues('REQ-STATUS') : Promise.resolve([]),
    tableId === 'requisitions-list'
      ? prisma.vendor.findMany({
          where: { inactive: false },
          orderBy: [{ vendorNumber: 'asc' }, { name: 'asc' }],
          select: { id: true, vendorNumber: true, name: true },
        })
      : Promise.resolve([]),
    tableId === 'chart-of-accounts-list'
      ? prisma.chartOfAccounts.findMany({
          orderBy: [{ accountId: 'asc' }, { accountNumber: 'asc' }],
          select: { id: true, accountId: true, accountNumber: true, name: true },
        })
      : Promise.resolve([]),
    tableId === 'chart-of-accounts-list' ? loadListValues('accountType') : Promise.resolve([]),
    tableId === 'chart-of-accounts-list' ? loadListValues('normalBalance') : Promise.resolve([]),
    tableId === 'chart-of-accounts-list' ? loadListValues('LIST-COA-FS-CATEGORY') : Promise.resolve([]),
    tableId === 'chart-of-accounts-list' ? loadListValues('LIST-COA-ACCOUNT-ROLE') : Promise.resolve([]),
    tableId === 'chart-of-accounts-list' ? loadListValues('LIST-COA-ROLLFORWARD-CATEGORY') : Promise.resolve([]),
  ])

  const initialMetadata = tableId === 'users-list'
    ? buildUsersSavedSearchMetadata({
        roles,
        departments,
        subsidiaries,
        approverUsers,
        employees,
      })
    : tableId === 'purchase-orders-list'
      ? buildPurchaseOrdersSavedSearchMetadata({
          vendors: purchaseOrderVendors,
          statusOptions: purchaseOrderStatuses.map((value) => ({ value: value.toLowerCase(), label: value })),
          subsidiaries,
          currencies: purchaseOrderCurrencies,
          requisitions: purchaseOrderRequisitions,
        })
      : tableId === 'receipts-list'
        ? buildReceiptsSavedSearchMetadata({
            statusOptions: receiptStatuses.map((value) => ({ value: value.toLowerCase(), label: value })),
            purchaseOrders: receiptPurchaseOrders,
          })
        : tableId === 'chart-of-accounts-list'
          ? buildChartOfAccountsSavedSearchMetadata({
              accountTypeOptions: accountTypeValues.map((value) => ({ value, label: value })),
              normalBalanceOptions: normalBalanceValues.map((value) => ({ value, label: value })),
              financialStatementCategoryOptions: fsCategoryValues.map((value) => ({ value, label: value })),
              accountRoleOptions: accountRoleValues.map((value) => ({ value, label: value })),
              rollforwardCategoryOptions: rollforwardCategoryValues.map((value) => ({ value, label: value })),
              parentAccountOptions: chartOfAccounts.map((account) => ({
                value: account.id,
                label: `${account.accountId} - ${account.accountNumber} - ${account.name}`,
              })),
              subsidiaryOptions: subsidiaries.map((subsidiary) => ({
                value: subsidiary.id,
                label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
              })),
            })
        : tableId === 'requisitions-list'
          ? buildPurchaseRequisitionsSavedSearchMetadata({
              statusOptions: requisitionStatuses.map((value) => ({ value: value.toLowerCase(), label: value })),
              priorityOptions: [
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ],
              departments,
              vendors: requisitionVendors,
            })
    : null
  const builtInBaseline = await loadSavedSearchBuiltInBaseline(tableId)
  const canEditBuiltIn = (session?.user?.role ?? '').toLowerCase().includes('admin')

  return (
    <SavedSearchEditorClient
      tableId={tableId}
      initialMetadata={initialMetadata}
      builtInBaseline={builtInBaseline}
      canEditBuiltIn={canEditBuiltIn}
      roles={roles.map((role) => ({
        id: role.id,
        label: role.name,
      }))}
      departments={departments.map((department) => ({
        id: department.id,
        label: `${department.departmentId} - ${department.name}`,
      }))}
      subsidiaries={subsidiaries.map((subsidiary) => ({
        id: subsidiary.id,
        label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
      }))}
      employees={employees.map((employee) => ({
        id: employee.id,
        label: `${employee.employeeId ?? 'Pending'} - ${employee.firstName} ${employee.lastName}`.trim(),
      }))}
    />
  )
}
