import Link from 'next/link'
import type { ReactNode } from 'react'
import { prisma } from '@/lib/prisma'
import CreatePageLinkButton from '@/components/CreatePageLinkButton'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import MasterDataListSection from '@/components/MasterDataListSection'
import { MasterDataBodyCell, MasterDataEmptyStateRow, MasterDataHeaderCell, MasterDataMutedCell } from '@/components/MasterDataTableCells'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { MASTER_DATA_TABLE_DIVIDER_STYLE, getMasterDataRowStyle } from '@/lib/master-data-table'
import { formatMasterDataDate } from '@/lib/master-data-display'
import { loadCompanyPageLogo } from '@/lib/company-page-logo'
import { ITEM_FORM_FIELDS, type ItemFormFieldKey } from '@/lib/item-form-customization'
import { itemListDefinition } from '@/lib/master-data-list-definitions'
import { buildFieldMetaById, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { buildFieldStyleListTooltip } from '@/lib/field-style-list-tooltip'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT
  const itemFieldMetaById = buildFieldMetaById(ITEM_FORM_FIELDS)
  const fieldTooltip = (fieldId: keyof typeof itemFieldMetaById) =>
    buildFieldStyleListTooltip({
      label: itemFieldMetaById[fieldId].label,
      fieldId: itemFieldMetaById[fieldId].id,
      fieldType: itemFieldMetaById[fieldId].fieldType,
      description: itemFieldMetaById[fieldId].description,
      sourceText: itemFieldMetaById[fieldId].source,
    })

  const where = query
    ? { OR: [{ name: { contains: query, mode: 'insensitive' as const } }, { itemId: { contains: query, mode: 'insensitive' as const } }, { sku: { contains: query, mode: 'insensitive' as const } }] }
    : {}

  const total = await prisma.item.count({ where })
  const pagination = getPagination(total, params.page)

  const [items, entities, glAccounts, revRecTemplates, fieldOptions, companyLogoPages] = await Promise.all([
    prisma.item.findMany({
      where,
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
          ? [{ itemId: 'asc' as const }, { createdAt: 'desc' as const }]
          : sort === 'oldest'
          ? [{ createdAt: 'asc' as const }]
          : sort === 'name'
            ? [{ name: 'asc' as const }]
            : [{ createdAt: 'desc' as const }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' } }),
    prisma.chartOfAccounts.findMany({
      where: { active: true },
      orderBy: { accountId: 'asc' },
      select: { id: true, accountId: true, name: true },
    }),
    prisma.revRecTemplate.findMany({
      where: { active: true },
      orderBy: { templateId: 'asc' },
      select: { id: true, templateId: true, name: true },
    }),
    loadFieldOptionsMap(itemFieldMetaById, [
      'itemType',
      'itemCategory',
      'uom',
      'primaryPurchaseUnit',
      'primarySaleUnit',
      'primaryUnitsType',
      'revenueStream',
      'recognitionMethod',
      'recognitionTrigger',
      'createRevenueArrangementOn',
      'createForecastPlanOn',
      'createRevenuePlanOn',
      'performanceObligationType',
      'billingType',
      'line',
      'productLine',
      'departmentId',
      'locationId',
      'preferredVendorId',
      'inactive',
    ]),
    loadCompanyPageLogo(),
  ])

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (sort) s.set('sort', sort)
    s.set('page', String(p))
    return `/items?${s.toString()}`
  }

  const glOptions = glAccounts.map((account) => ({
    value: account.id,
    label: `${account.accountId} - ${account.name}`,
  }))

  const formatAccountLabel = (account: { accountId: string; name: string } | null) =>
    account ? `${account.accountId} - ${account.name}` : '-'

  type ItemRow = (typeof items)[number]
  type ItemListColumnId = ItemFormFieldKey | 'created' | 'last-modified' | 'actions'

  const formatNumber = (value: number | null | undefined) => (value == null ? '-' : value.toFixed(2))
  const formatBoolean = (value: boolean) => (value ? 'Yes' : 'No')

  const renderItemFieldValue = (item: ItemRow, columnId: ItemListColumnId): ReactNode => {
    switch (columnId) {
      case 'itemId':
        return (
          <Link href={`/items/${item.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
            {item.itemId ?? '-'}
          </Link>
        )
      case 'inactive':
        return formatBoolean(!item.active)
      case 'listPrice':
        return formatNumber(item.listPrice)
      case 'standaloneSellingPrice':
        return formatNumber(item.standaloneSellingPrice)
      case 'standardCost':
        return formatNumber(item.standardCost)
      case 'averageCost':
        return formatNumber(item.averageCost)
      case 'subsidiaryIds':
        return item.itemSubsidiaries.length > 0
          ? item.itemSubsidiaries.map((assignment) => assignment.subsidiary.subsidiaryId).join(', ')
          : item.subsidiary?.subsidiaryId ?? '-'
      case 'includeChildren':
        return formatBoolean(item.includeChildren)
      case 'currencyId':
        return item.currency?.code ?? '-'
      case 'departmentId':
        return item.department ? `${item.department.departmentId} - ${item.department.name}` : '-'
      case 'locationId':
        return item.location ? `${item.location.code} - ${item.location.name}` : '-'
      case 'preferredVendorId':
        return item.preferredVendor ? `${item.preferredVendor.vendorNumber ?? item.preferredVendor.id} - ${item.preferredVendor.name}` : '-'
      case 'defaultRevRecTemplateId':
        return item.defaultRevRecTemplate ? `${item.defaultRevRecTemplate.templateId} - ${item.defaultRevRecTemplate.name}` : '-'
      case 'incomeAccountId':
        return formatAccountLabel(item.incomeAccount)
      case 'deferredRevenueAccountId':
        return formatAccountLabel(item.deferredRevenueAccount)
      case 'inventoryAccountId':
        return formatAccountLabel(item.inventoryAccount)
      case 'cogsExpenseAccountId':
        return formatAccountLabel(item.cogsExpenseAccount)
      case 'deferredCostAccountId':
        return formatAccountLabel(item.deferredCostAccount)
      case 'allocationEligible':
      case 'dropShipItem':
      case 'specialOrderItem':
      case 'canBeFulfilled':
      case 'directRevenuePosting':
        return formatBoolean(item[columnId])
      case 'created':
        return formatMasterDataDate(item.createdAt)
      case 'last-modified':
        return formatMasterDataDate(item.updatedAt)
      case 'actions':
        return null
      default: {
        const value = item[columnId]
        return value == null || value === '' ? '-' : String(value)
      }
    }
  }

  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Items"
        total={total}
        logoUrl={companyLogoPages?.url}
        actions={
          <CreatePageLinkButton href="/items/new" label="New Item" />
        }
      />

      <MasterDataListSection
        query={params.q}
        searchPlaceholder={itemListDefinition.searchPlaceholder}
        tableId={itemListDefinition.tableId}
        exportFileName={itemListDefinition.exportFileName}
        columns={itemListDefinition.columns}
        sort={sort}
        sortOptions={itemListDefinition.sortOptions}
      >
        <table className="min-w-full" id={itemListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              {itemListDefinition.columns.map((column) => (
                <MasterDataHeaderCell
                  key={column.id}
                  columnId={column.id}
                  tooltip={column.id in itemFieldMetaById ? fieldTooltip(column.id as keyof typeof itemFieldMetaById) : undefined}
                >
                  {column.label}
                </MasterDataHeaderCell>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={itemListDefinition.columns.length}>No items found</MasterDataEmptyStateRow>
            ) : (
              items.map((item, index) => (
                <tr key={item.id} style={getMasterDataRowStyle(index, items.length)}>
                  {itemListDefinition.columns.map((column) => {
                    if (column.id === 'actions') {
                      return (
                        <MasterDataBodyCell key={column.id} columnId={column.id}>
                          <div className="flex items-center gap-2">
                            <EditButton
                        resource="items"
                        id={item.id}
                        fields={[
                          { name: 'name', label: 'Name', value: item.name },
                          { name: 'itemId', label: 'Item Id', value: item.itemId ?? '' },
                          { name: 'sku', label: 'SKU', value: item.sku ?? '' },
                          { name: 'description', label: 'Description', value: item.description ?? '' },
                          { name: 'salesDescription', label: 'Sales Description', value: item.salesDescription ?? '' },
                          { name: 'purchaseDescription', label: 'Purchase Description', value: item.purchaseDescription ?? '' },
                          {
                            name: 'itemType',
                            label: 'Item Type',
                            value: item.itemType,
                            type: 'select',
                            placeholder: 'Select item type',
                            options: fieldOptions.itemType ?? [],
                          },
                          {
                            name: 'itemCategory',
                            label: 'Item Category',
                            value: item.itemCategory ?? '',
                            type: 'select',
                            placeholder: 'Select item category',
                            options: fieldOptions.itemCategory ?? [],
                          },
                          { name: 'uom', label: 'UOM', value: item.uom ?? '', type: 'select', options: fieldOptions.uom ?? [] },
                          { name: 'primaryPurchaseUnit', label: 'Primary Purchase Unit', value: item.primaryPurchaseUnit ?? '', type: 'select', options: fieldOptions.primaryPurchaseUnit ?? [] },
                          { name: 'primarySaleUnit', label: 'Primary Sales Unit', value: item.primarySaleUnit ?? '', type: 'select', options: fieldOptions.primarySaleUnit ?? [] },
                          { name: 'primaryUnitsType', label: 'Primary Units Type', value: item.primaryUnitsType ?? '', type: 'select', options: fieldOptions.primaryUnitsType ?? [] },
                          { name: 'listPrice', label: 'List Price', value: String(item.listPrice), type: 'number' },
                          { name: 'revenueStream', label: 'Revenue Stream', value: item.revenueStream ?? '', type: 'select', options: fieldOptions.revenueStream ?? [] },
                          { name: 'recognitionMethod', label: 'Recognition Method', value: item.recognitionMethod ?? '', type: 'select', options: fieldOptions.recognitionMethod ?? [] },
                          { name: 'recognitionTrigger', label: 'Recognition Trigger', value: item.recognitionTrigger ?? '', type: 'select', options: fieldOptions.recognitionTrigger ?? [] },
                          { name: 'defaultRevRecTemplateId', label: 'Rev Rec Template', value: item.defaultRevRecTemplateId ?? '', type: 'select', placeholder: 'Select template', options: revRecTemplates.map((template) => ({ value: template.id, label: `${template.templateId} - ${template.name}` })) },
                          { name: 'defaultTermMonths', label: 'Default Term Months', value: item.defaultTermMonths != null ? String(item.defaultTermMonths) : '', type: 'number' },
                          { name: 'createRevenueArrangementOn', label: 'Create Revenue Arrangement On', value: item.createRevenueArrangementOn ?? '', type: 'select', options: fieldOptions.createRevenueArrangementOn ?? [] },
                          { name: 'createForecastPlanOn', label: 'Create Forecast Plan On', value: item.createForecastPlanOn ?? '', type: 'select', options: fieldOptions.createForecastPlanOn ?? [] },
                          { name: 'createRevenuePlanOn', label: 'Create Revenue Plan On', value: item.createRevenuePlanOn ?? '', type: 'select', options: fieldOptions.createRevenuePlanOn ?? [] },
                          { name: 'allocationEligible', label: 'Allocation Eligible', value: item.allocationEligible ? 'true' : 'false', type: 'checkbox', placeholder: 'Allocation Eligible' },
                          { name: 'performanceObligationType', label: 'Performance Obligation Type', value: item.performanceObligationType ?? '', type: 'select', options: fieldOptions.performanceObligationType ?? [] },
                          { name: 'standaloneSellingPrice', label: 'Standalone Selling Price', value: item.standaloneSellingPrice != null ? String(item.standaloneSellingPrice) : '', type: 'number' },
                          { name: 'billingType', label: 'Billing Type', value: item.billingType ?? '', type: 'select', options: fieldOptions.billingType ?? [] },
                          { name: 'standardCost', label: 'Standard Cost', value: item.standardCost != null ? String(item.standardCost) : '', type: 'number' },
                          { name: 'averageCost', label: 'Average Cost', value: item.averageCost != null ? String(item.averageCost) : '', type: 'number' },
                          {
                            name: 'subsidiaryIds',
                            label: 'Subsidiaries',
                            value: item.itemSubsidiaries.map((assignment) => assignment.subsidiaryId).join(','),
                            type: 'select',
                            multiple: true,
                            placeholder: 'Select Subsidiaries',
                            options: entities.map((Subsidiary) => ({ value: Subsidiary.id, label: `${Subsidiary.subsidiaryId} - ${Subsidiary.name}` })),
                          },
                          { name: 'includeChildren', label: 'Include Children', value: item.includeChildren ? 'true' : 'false', type: 'checkbox', placeholder: 'Include Children' },
                          {
                            name: 'departmentId',
                            label: 'Department Id',
                            value: item.departmentId ?? '',
                            type: 'select',
                            placeholder: 'Select department',
                            options: fieldOptions.departmentId ?? [],
                          },
                          {
                            name: 'locationId',
                            label: 'Location Id',
                            value: item.locationId ?? '',
                            type: 'select',
                            placeholder: 'Select location',
                            options: fieldOptions.locationId ?? [],
                          },
                          { name: 'incomeAccountId', label: 'Income Account', value: item.incomeAccountId ?? '', type: 'select', placeholder: 'Select GL account', options: glOptions },
                          { name: 'deferredRevenueAccountId', label: 'Deferred Revenue Account', value: item.deferredRevenueAccountId ?? '', type: 'select', placeholder: 'Select GL account', options: glOptions },
                          { name: 'inventoryAccountId', label: 'Asset Account', value: item.inventoryAccountId ?? '', type: 'select', placeholder: 'Select GL account', options: glOptions },
                          { name: 'cogsExpenseAccountId', label: 'COGS / Expense Account', value: item.cogsExpenseAccountId ?? '', type: 'select', placeholder: 'Select GL account', options: glOptions },
                          { name: 'deferredCostAccountId', label: 'Deferred Cost Account', value: item.deferredCostAccountId ?? '', type: 'select', placeholder: 'Select GL account', options: glOptions },
                          { name: 'line', label: 'Line', value: item.line ?? '', type: 'select', options: fieldOptions.line ?? [] },
                          { name: 'productLine', label: 'Product Line', value: item.productLine ?? '', type: 'select', options: fieldOptions.productLine ?? [] },
                          { name: 'dropShipItem', label: 'Drop Ship Item', value: item.dropShipItem ? 'true' : 'false', type: 'checkbox', placeholder: 'Drop Ship Item' },
                          { name: 'specialOrderItem', label: 'Special Order Item', value: item.specialOrderItem ? 'true' : 'false', type: 'checkbox', placeholder: 'Special Order Item' },
                          { name: 'canBeFulfilled', label: 'Can Be Fulfilled', value: item.canBeFulfilled ? 'true' : 'false', type: 'checkbox', placeholder: 'Can Be Fulfilled' },
                          {
                            name: 'preferredVendorId',
                            label: 'Preferred Vendor Id',
                            value: item.preferredVendorId ?? '',
                            type: 'select',
                            placeholder: 'Select preferred vendor',
                            options: fieldOptions.preferredVendorId ?? [],
                          },
                          { name: 'directRevenuePosting', label: 'Direct Revenue Posting', value: item.directRevenuePosting ? 'true' : 'false', type: 'checkbox', placeholder: 'Direct Revenue Posting' },
                        ]}
                      />
                            <DeleteButton resource="items" id={item.id} />
                          </div>
                        </MasterDataBodyCell>
                      )
                    }

                    const columnId = column.id as ItemListColumnId
                    const content = renderItemFieldValue(item, columnId)

                    return column.id === 'name' || column.id === 'itemId' ? (
                      <MasterDataBodyCell
                        key={column.id}
                        columnId={column.id}
                        className={column.id === 'name' ? 'px-4 py-2 text-sm font-medium text-white' : undefined}
                      >
                        {content}
                      </MasterDataBodyCell>
                    ) : (
                      <MasterDataMutedCell
                        key={column.id}
                        columnId={column.id}
                        className={column.id === 'itemType' ? 'px-4 py-2 text-sm capitalize' : undefined}
                      >
                        {content}
                      </MasterDataMutedCell>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={total}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          hasPrevPage={pagination.hasPrevPage}
          hasNextPage={pagination.hasNextPage}
          prevHref={buildPageHref(pagination.currentPage - 1)}
          nextHref={buildPageHref(pagination.currentPage + 1)}
        />
      </MasterDataListSection>
    </div>
  )
}
