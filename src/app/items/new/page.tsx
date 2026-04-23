import { prisma } from '@/lib/prisma'
import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import ItemCreateForm from '@/components/ItemCreateForm'
import { loadListOptionsForSource } from '@/lib/list-source'
import { buildFieldMetaById, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { ITEM_FORM_FIELDS } from '@/lib/item-form-customization'

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const fieldMetaById = buildFieldMetaById(ITEM_FORM_FIELDS)
  const [entities, departments, locations, vendors, currencies, glAccounts, revRecTemplates, fieldOptions, inactiveOptions, duplicateItem] = await Promise.all([
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' } }),
    prisma.department.findMany({ orderBy: { departmentId: 'asc' }, select: { id: true, departmentId: true, name: true } }),
    prisma.location.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.vendor.findMany({ orderBy: { name: 'asc' }, select: { id: true, vendorNumber: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' } }),
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
    loadFieldOptionsMap(fieldMetaById, [
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
    ]),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    duplicateFrom
      ? prisma.item.findUnique({
          where: { id: duplicateFrom },
          include: { itemSubsidiaries: { select: { subsidiaryId: true } } },
        })
      : Promise.resolve(null),
  ])

  return (
    <MasterDataCreatePageShell backHref="/items" backLabel="<- Back to Items" title="New Item" formId="create-item-form">
      <ItemCreateForm
        formId="create-item-form"
        showFooterActions={false}
        entities={entities}
        departments={departments}
        locations={locations}
        vendors={vendors}
        currencies={currencies}
        glAccounts={glAccounts}
        revRecTemplates={revRecTemplates}
        itemTypeOptions={fieldOptions.itemType ?? []}
        itemCategoryOptions={fieldOptions.itemCategory ?? []}
        recognitionMethodOptions={fieldOptions.recognitionMethod ?? []}
        fieldOptions={fieldOptions}
        inactiveOptions={inactiveOptions}
        redirectBasePath="/items"
        initialValues={duplicateItem ? {
          name: `Copy of ${duplicateItem.name}`,
          sku: duplicateItem.sku,
          description: duplicateItem.description,
          salesDescription: duplicateItem.salesDescription,
          purchaseDescription: duplicateItem.purchaseDescription,
          inactive: !duplicateItem.active,
          itemType: duplicateItem.itemType,
          itemCategory: duplicateItem.itemCategory,
          uom: duplicateItem.uom,
          primaryPurchaseUnit: duplicateItem.primaryPurchaseUnit,
          primarySaleUnit: duplicateItem.primarySaleUnit,
          primaryUnitsType: duplicateItem.primaryUnitsType,
          listPrice: String(duplicateItem.listPrice),
          revenueStream: duplicateItem.revenueStream,
          recognitionMethod: duplicateItem.recognitionMethod,
          recognitionTrigger: duplicateItem.recognitionTrigger,
          defaultRevRecTemplateId: duplicateItem.defaultRevRecTemplateId,
          defaultTermMonths: duplicateItem.defaultTermMonths != null ? String(duplicateItem.defaultTermMonths) : '',
          createRevenueArrangementOn: duplicateItem.createRevenueArrangementOn,
          createForecastPlanOn: duplicateItem.createForecastPlanOn,
          createRevenuePlanOn: duplicateItem.createRevenuePlanOn,
          allocationEligible: duplicateItem.allocationEligible,
          performanceObligationType: duplicateItem.performanceObligationType,
          standaloneSellingPrice: duplicateItem.standaloneSellingPrice != null ? String(duplicateItem.standaloneSellingPrice) : '',
          billingType: duplicateItem.billingType,
          standardCost: duplicateItem.standardCost != null ? String(duplicateItem.standardCost) : '',
          averageCost: duplicateItem.averageCost != null ? String(duplicateItem.averageCost) : '',
          subsidiaryIds: duplicateItem.itemSubsidiaries.map((assignment) => assignment.subsidiaryId),
          includeChildren: duplicateItem.includeChildren,
          departmentId: duplicateItem.departmentId,
          locationId: duplicateItem.locationId,
          currencyId: duplicateItem.currencyId,
          line: duplicateItem.line,
          productLine: duplicateItem.productLine,
          dropShipItem: duplicateItem.dropShipItem,
          specialOrderItem: duplicateItem.specialOrderItem,
          canBeFulfilled: duplicateItem.canBeFulfilled,
          preferredVendorId: duplicateItem.preferredVendorId,
          incomeAccountId: duplicateItem.incomeAccountId,
          deferredRevenueAccountId: duplicateItem.deferredRevenueAccountId,
          inventoryAccountId: duplicateItem.inventoryAccountId,
          cogsExpenseAccountId: duplicateItem.cogsExpenseAccountId,
          deferredCostAccountId: duplicateItem.deferredCostAccountId,
          directRevenuePosting: duplicateItem.directRevenuePosting,
        } : undefined}
      />
    </MasterDataCreatePageShell>
  )
}
