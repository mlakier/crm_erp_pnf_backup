import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isFieldRequiredServer } from '@/lib/form-requirements-store'
import { generateNextItemNumber } from '@/lib/item-number'
import {
  isInventoryItemType,
  normalizeItemOrderFlags,
  validateItemInventoryRules,
  validateItemOrderFlags,
  validateItemRevenueTriggerSequence,
} from '@/lib/item-business-rules'

export async function GET() {
  const data = await prisma.item.findMany({
    include: {
      currency: true,
      subsidiary: true,
      itemSubsidiaries: { include: { subsidiary: true } },
      department: true,
      location: true,
      preferredVendor: true,
      defaultRevRecTemplate: true,
      incomeAccount: true,
      deferredRevenueAccount: true,
      inventoryAccount: true,
      cogsExpenseAccount: true,
      deferredCostAccount: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const toOptionalString = (value: unknown) => String(value ?? '').trim() || null
    const parseIds = (value: unknown) => {
      if (Array.isArray(value)) {
        return value.map((entry) => String(entry ?? '').trim()).filter(Boolean)
      }
      return String(value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    }
    const name = String(body?.name ?? '').trim()
    const requestedItemId = toOptionalString(body?.itemId)
    const itemId = requestedItemId ?? await generateNextItemNumber()
    const externalId = toOptionalString(body?.externalId)
    const sku = toOptionalString(body?.sku)
    const itemType = String(body?.itemType ?? 'service').trim() || 'service'
    const description = toOptionalString(body?.description)
    const salesDescription = toOptionalString(body?.salesDescription)
    const purchaseDescription = toOptionalString(body?.purchaseDescription)
    const itemCategory = toOptionalString(body?.itemCategory)
    const uom = toOptionalString(body?.uom)
    const primaryPurchaseUnit = toOptionalString(body?.primaryPurchaseUnit)
    const primarySaleUnit = toOptionalString(body?.primarySaleUnit)
    const primaryUnitsType = toOptionalString(body?.primaryUnitsType)
    const listPrice = Number(body?.listPrice ?? 0)
    const revenueStream = toOptionalString(body?.revenueStream)
    const recognitionMethod = toOptionalString(body?.recognitionMethod)
    const recognitionTrigger = toOptionalString(body?.recognitionTrigger)
    const defaultRevRecTemplateId = toOptionalString(body?.defaultRevRecTemplateId)
    const defaultTermMonthsRaw = String(body?.defaultTermMonths ?? '').trim()
    const defaultTermMonths = defaultTermMonthsRaw ? Number(defaultTermMonthsRaw) : null
    const createRevenueArrangementOn = toOptionalString(body?.createRevenueArrangementOn)
    const createForecastPlanOn = toOptionalString(body?.createForecastPlanOn)
    const createRevenuePlanOn = toOptionalString(body?.createRevenuePlanOn)
    const allocationEligible = String(body?.allocationEligible ?? 'true').trim().toLowerCase() === 'true'
    const performanceObligationType = toOptionalString(body?.performanceObligationType)
    const standaloneSellingPriceRaw = String(body?.standaloneSellingPrice ?? '').trim()
    const standaloneSellingPrice = standaloneSellingPriceRaw ? Number(standaloneSellingPriceRaw) : null
    const billingType = toOptionalString(body?.billingType)
    const billingTrigger = toOptionalString(body?.billingTrigger)
    const standardCostRaw = String(body?.standardCost ?? '').trim()
    const standardCost = standardCostRaw ? Number(standardCostRaw) : null
    const averageCostRaw = String(body?.averageCost ?? '').trim()
    const averageCost = averageCostRaw ? Number(averageCostRaw) : null
    const subsidiaryIds = parseIds(body?.subsidiaryIds)
    const includeChildren = String(body?.includeChildren ?? 'false').trim().toLowerCase() === 'true'
    const departmentId = toOptionalString(body?.departmentId)
    const locationId = toOptionalString(body?.locationId)
    const currencyId = toOptionalString(body?.currencyId)
    const line = toOptionalString(body?.line)
    const productLine = toOptionalString(body?.productLine)
    const directRevenuePosting = String(body?.directRevenuePosting ?? 'false').trim().toLowerCase() === 'true'
    const parsedDropShipItem = String(body?.dropShipItem ?? 'false').trim().toLowerCase() === 'true'
    const parsedSpecialOrderItem = String(body?.specialOrderItem ?? 'false').trim().toLowerCase() === 'true'
    const orderFlagError = validateItemOrderFlags({ dropShipItem: parsedDropShipItem, specialOrderItem: parsedSpecialOrderItem })
    if (orderFlagError) {
      return NextResponse.json({ error: orderFlagError }, { status: 400 })
    }
    const revenueTriggerError = validateItemRevenueTriggerSequence({
      directRevenuePosting,
      recognitionTrigger,
      createRevenueArrangementOn,
      createForecastPlanOn,
      createRevenuePlanOn,
    })
    if (revenueTriggerError) {
      return NextResponse.json({ error: revenueTriggerError }, { status: 400 })
    }
    const { dropShipItem, specialOrderItem } = normalizeItemOrderFlags({
      dropShipItem: parsedDropShipItem,
      specialOrderItem: parsedSpecialOrderItem,
    })
    const canBeFulfilled = String(body?.canBeFulfilled ?? 'false').trim().toLowerCase() === 'true'
    const preferredVendorId = toOptionalString(body?.preferredVendorId)
    const incomeAccountId = toOptionalString(body?.incomeAccountId)
    const deferredRevenueAccountId = toOptionalString(body?.deferredRevenueAccountId)
    const inventoryAccountId = toOptionalString(body?.inventoryAccountId)
    const cogsExpenseAccountId = toOptionalString(body?.cogsExpenseAccountId)
    const deferredCostAccountId = toOptionalString(body?.deferredCostAccountId)
    const inactive = String(body?.inactive ?? 'false').trim().toLowerCase() === 'true'
    const subsidiaryId = subsidiaryIds[0] ?? null
    const inventoryRuleError = validateItemInventoryRules({
      itemType,
      dropShipItem: parsedDropShipItem,
      specialOrderItem: parsedSpecialOrderItem,
      inventoryAccountId,
    })
    if (inventoryRuleError) {
      return NextResponse.json({ error: inventoryRuleError }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    }

    const missing: string[] = []
    const revenueRecognitionFieldNames = new Set([
      'revenueStream',
      'recognitionMethod',
      'recognitionTrigger',
      'defaultRevRecTemplateId',
      'defaultTermMonths',
      'createRevenueArrangementOn',
      'createForecastPlanOn',
      'createRevenuePlanOn',
      'allocationEligible',
      'performanceObligationType',
    ])
    const requiredFields = [
      ['name', name],
      ['itemId', itemId],
      ['externalId', externalId],
      ['sku', sku],
      ['itemType', itemType],
      ['uom', uom],
      ['listPrice', String(body?.listPrice ?? '')],
      ['revenueStream', revenueStream],
      ['recognitionMethod', recognitionMethod],
      ['recognitionTrigger', recognitionTrigger],
      ['defaultRevRecTemplateId', defaultRevRecTemplateId],
      ['defaultTermMonths', defaultTermMonthsRaw],
      ['createRevenueArrangementOn', createRevenueArrangementOn],
      ['createForecastPlanOn', createForecastPlanOn],
      ['createRevenuePlanOn', createRevenuePlanOn],
      ['allocationEligible', allocationEligible ? 'true' : 'false'],
      ['performanceObligationType', performanceObligationType],
      ['standaloneSellingPrice', standaloneSellingPriceRaw],
      ['billingType', billingType],
      ['billingTrigger', billingTrigger],
      ['standardCost', standardCostRaw],
      ['averageCost', averageCostRaw],
      ['subsidiaryId', subsidiaryId],
      ['currencyId', currencyId],
      ['incomeAccountId', incomeAccountId],
      ['inventoryAccountId', inventoryAccountId],
      ['cogsExpenseAccountId', cogsExpenseAccountId],
    ] as const

    for (const [fieldName, fieldValue] of requiredFields) {
      if (directRevenuePosting && revenueRecognitionFieldNames.has(fieldName)) {
        continue
      }
      if ((await isFieldRequiredServer('itemCreate', fieldName)) && !String(fieldValue ?? '').trim()) {
        missing.push(fieldName)
      }
    }

    if ((await isFieldRequiredServer('itemCreate', 'deferredRevenueAccountId')) && !directRevenuePosting && !deferredRevenueAccountId) {
      missing.push('deferredRevenueAccountId')
    }

    if ((await isFieldRequiredServer('itemCreate', 'deferredCostAccountId')) && !directRevenuePosting && !deferredCostAccountId) {
      missing.push('deferredCostAccountId')
    }

    if (isInventoryItemType(itemType) && !inventoryAccountId) {
      missing.push('inventoryAccountId')
    }

    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    const normalizedDeferredRevenueAccountId = directRevenuePosting ? null : deferredRevenueAccountId
    const normalizedDeferredCostAccountId = directRevenuePosting ? null : deferredCostAccountId
    const normalizedInventoryAccountId = isInventoryItemType(itemType) ? inventoryAccountId : null

    const created = await prisma.item.create({
      data: {
        name,
        itemId,
        externalId,
        sku,
        description,
        salesDescription,
        purchaseDescription,
        itemType,
        itemCategory,
        uom,
        primaryPurchaseUnit,
        primarySaleUnit,
        primaryUnitsType,
        listPrice: Number.isFinite(listPrice) ? listPrice : 0,
        revenueStream,
        recognitionMethod,
        recognitionTrigger,
        defaultRevRecTemplateId,
        defaultTermMonths: Number.isFinite(defaultTermMonths) ? defaultTermMonths : null,
        createRevenueArrangementOn,
        createForecastPlanOn,
        createRevenuePlanOn,
        allocationEligible,
        performanceObligationType,
        standaloneSellingPrice: Number.isFinite(standaloneSellingPrice) ? standaloneSellingPrice : null,
        billingType,
        billingTrigger,
        standardCost: Number.isFinite(standardCost) ? standardCost : null,
        averageCost: Number.isFinite(averageCost) ? averageCost : null,
        includeChildren,
        currencyId,
        subsidiaryId,
        departmentId,
        locationId,
        line,
        productLine,
        dropShipItem,
        specialOrderItem,
        canBeFulfilled,
        preferredVendorId,
        incomeAccountId,
        deferredRevenueAccountId: normalizedDeferredRevenueAccountId,
        inventoryAccountId: normalizedInventoryAccountId,
        cogsExpenseAccountId,
        deferredCostAccountId: normalizedDeferredCostAccountId,
        directRevenuePosting,
        active: !inactive,
        ...(subsidiaryIds.length > 0
          ? {
              itemSubsidiaries: {
                create: subsidiaryIds.map((selectedSubsidiaryId) => ({ subsidiaryId: selectedSubsidiaryId })),
              },
            }
          : {}),
      },
      include: {
        currency: true,
        subsidiary: true,
        itemSubsidiaries: { include: { subsidiary: true } },
        department: true,
        location: true,
        preferredVendor: true,
        defaultRevRecTemplate: true,
        incomeAccount: true,
        deferredRevenueAccount: true,
        inventoryAccount: true,
        cogsExpenseAccount: true,
        deferredCostAccount: true,
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to create item.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await request.json()
    const toOptionalString = (value: unknown) => String(value ?? '').trim() || null
    const parseIds = (value: unknown) => {
      if (value === undefined) return undefined
      if (Array.isArray(value)) {
        return value.map((entry) => String(entry ?? '').trim()).filter(Boolean)
      }
      return String(value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    }
    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const itemId = body?.itemId !== undefined ? toOptionalString(body.itemId) : undefined
    const externalId = body?.externalId !== undefined ? toOptionalString(body.externalId) : undefined
    const sku = body?.sku !== undefined ? toOptionalString(body.sku) : undefined
    const itemType = body?.itemType !== undefined ? String(body.itemType).trim() : undefined
    const description = body?.description !== undefined ? toOptionalString(body.description) : undefined
    const salesDescription = body?.salesDescription !== undefined ? toOptionalString(body.salesDescription) : undefined
    const purchaseDescription = body?.purchaseDescription !== undefined ? toOptionalString(body.purchaseDescription) : undefined
    const itemCategory = body?.itemCategory !== undefined ? toOptionalString(body.itemCategory) : undefined
    const uom = body?.uom !== undefined ? toOptionalString(body.uom) : undefined
    const primaryPurchaseUnit = body?.primaryPurchaseUnit !== undefined ? toOptionalString(body.primaryPurchaseUnit) : undefined
    const primarySaleUnit = body?.primarySaleUnit !== undefined ? toOptionalString(body.primarySaleUnit) : undefined
    const primaryUnitsType = body?.primaryUnitsType !== undefined ? toOptionalString(body.primaryUnitsType) : undefined
    const listPrice = body?.listPrice !== undefined ? Number(body.listPrice) : undefined
    const revenueStream = body?.revenueStream !== undefined ? toOptionalString(body.revenueStream) : undefined
    const recognitionMethod = body?.recognitionMethod !== undefined ? toOptionalString(body.recognitionMethod) : undefined
    const recognitionTrigger = body?.recognitionTrigger !== undefined ? toOptionalString(body.recognitionTrigger) : undefined
    const defaultRevRecTemplateId = body?.defaultRevRecTemplateId !== undefined ? toOptionalString(body.defaultRevRecTemplateId) : undefined
    const defaultTermMonths = body?.defaultTermMonths !== undefined
      ? (String(body.defaultTermMonths).trim() ? Number(body.defaultTermMonths) : null)
      : undefined
    const createRevenueArrangementOn = body?.createRevenueArrangementOn !== undefined ? toOptionalString(body.createRevenueArrangementOn) : undefined
    const createForecastPlanOn = body?.createForecastPlanOn !== undefined ? toOptionalString(body.createForecastPlanOn) : undefined
    const createRevenuePlanOn = body?.createRevenuePlanOn !== undefined ? toOptionalString(body.createRevenuePlanOn) : undefined
    const allocationEligible = body?.allocationEligible !== undefined
      ? String(body.allocationEligible).trim().toLowerCase() === 'true'
      : undefined
    const performanceObligationType = body?.performanceObligationType !== undefined ? toOptionalString(body.performanceObligationType) : undefined
    const standaloneSellingPrice = body?.standaloneSellingPrice !== undefined
      ? (String(body.standaloneSellingPrice).trim() ? Number(body.standaloneSellingPrice) : null)
      : undefined
    const billingType = body?.billingType !== undefined ? toOptionalString(body.billingType) : undefined
    const billingTrigger = body?.billingTrigger !== undefined ? toOptionalString(body.billingTrigger) : undefined
    const standardCost = body?.standardCost !== undefined
      ? (String(body.standardCost).trim() ? Number(body.standardCost) : null)
      : undefined
    const averageCost = body?.averageCost !== undefined
      ? (String(body.averageCost).trim() ? Number(body.averageCost) : null)
      : undefined
    const subsidiaryIds = parseIds(body?.subsidiaryIds)
    const includeChildren = body?.includeChildren !== undefined
      ? String(body.includeChildren).trim().toLowerCase() === 'true'
      : undefined
    const departmentId = body?.departmentId !== undefined ? toOptionalString(body.departmentId) : undefined
    const locationId = body?.locationId !== undefined ? toOptionalString(body.locationId) : undefined
    const currencyId = body?.currencyId !== undefined ? toOptionalString(body.currencyId) : undefined
    const line = body?.line !== undefined ? toOptionalString(body.line) : undefined
    const productLine = body?.productLine !== undefined ? toOptionalString(body.productLine) : undefined
    const parsedDropShipItem = body?.dropShipItem !== undefined
      ? String(body.dropShipItem).trim().toLowerCase() === 'true'
      : undefined
    const parsedSpecialOrderItem = body?.specialOrderItem !== undefined
      ? String(body.specialOrderItem).trim().toLowerCase() === 'true'
      : undefined
    const canBeFulfilled = body?.canBeFulfilled !== undefined
      ? String(body.canBeFulfilled).trim().toLowerCase() === 'true'
      : undefined
    const preferredVendorId = body?.preferredVendorId !== undefined ? toOptionalString(body.preferredVendorId) : undefined
    const incomeAccountId = body?.incomeAccountId !== undefined ? toOptionalString(body.incomeAccountId) : undefined
    const deferredRevenueAccountId = body?.deferredRevenueAccountId !== undefined ? toOptionalString(body.deferredRevenueAccountId) : undefined
    const inventoryAccountId = body?.inventoryAccountId !== undefined ? toOptionalString(body.inventoryAccountId) : undefined
    const cogsExpenseAccountId = body?.cogsExpenseAccountId !== undefined ? toOptionalString(body.cogsExpenseAccountId) : undefined
    const deferredCostAccountId = body?.deferredCostAccountId !== undefined ? toOptionalString(body.deferredCostAccountId) : undefined
    const directRevenuePosting = body?.directRevenuePosting !== undefined
      ? String(body.directRevenuePosting).trim().toLowerCase() === 'true'
      : undefined
    const inactive = body?.inactive !== undefined
      ? String(body.inactive).trim().toLowerCase() === 'true'
      : undefined
    const active = inactive !== undefined
      ? !inactive
      : body?.active !== undefined
        ? String(body.active).trim().toLowerCase() === 'true'
        : undefined
    const existing = await prisma.item.findUnique({
      where: { id },
      select: {
        dropShipItem: true,
        specialOrderItem: true,
        directRevenuePosting: true,
        recognitionTrigger: true,
        createRevenueArrangementOn: true,
        createForecastPlanOn: true,
        createRevenuePlanOn: true,
        itemType: true,
        inventoryAccountId: true,
      },
    })
    const candidateDropShipItem = parsedDropShipItem ?? existing?.dropShipItem ?? false
    const candidateSpecialOrderItem = parsedSpecialOrderItem ?? existing?.specialOrderItem ?? false
    const candidateDirectRevenuePosting = directRevenuePosting ?? existing?.directRevenuePosting ?? false
    const candidateRecognitionTrigger = recognitionTrigger ?? existing?.recognitionTrigger ?? null
    const candidateCreateRevenueArrangementOn = createRevenueArrangementOn ?? existing?.createRevenueArrangementOn ?? null
    const candidateCreateForecastPlanOn = createForecastPlanOn ?? existing?.createForecastPlanOn ?? null
    const candidateCreateRevenuePlanOn = createRevenuePlanOn ?? existing?.createRevenuePlanOn ?? null
    const candidateItemType = itemType ?? existing?.itemType ?? null
    const candidateInventoryAccountId = inventoryAccountId ?? existing?.inventoryAccountId ?? null
    const orderFlagError = validateItemOrderFlags({ dropShipItem: candidateDropShipItem, specialOrderItem: candidateSpecialOrderItem })
    if (orderFlagError) {
      return NextResponse.json({ error: orderFlagError }, { status: 400 })
    }
    const inventoryRuleError = validateItemInventoryRules({
      itemType: candidateItemType,
      dropShipItem: candidateDropShipItem,
      specialOrderItem: candidateSpecialOrderItem,
      inventoryAccountId: candidateInventoryAccountId,
    })
    if (inventoryRuleError) {
      return NextResponse.json({ error: inventoryRuleError }, { status: 400 })
    }
    const revenueTriggerError = validateItemRevenueTriggerSequence({
      directRevenuePosting: candidateDirectRevenuePosting,
      recognitionTrigger: candidateRecognitionTrigger,
      createRevenueArrangementOn: candidateCreateRevenueArrangementOn,
      createForecastPlanOn: candidateCreateForecastPlanOn,
      createRevenuePlanOn: candidateCreateRevenuePlanOn,
    })
    if (revenueTriggerError) {
      return NextResponse.json({ error: revenueTriggerError }, { status: 400 })
    }
    const normalizedOrderFlags = normalizeItemOrderFlags({
      dropShipItem: candidateDropShipItem,
      specialOrderItem: candidateSpecialOrderItem,
    })
    const dropShipItem = parsedDropShipItem !== undefined ? normalizedOrderFlags.dropShipItem : undefined
    const specialOrderItem =
      parsedDropShipItem !== undefined || parsedSpecialOrderItem !== undefined
        ? normalizedOrderFlags.specialOrderItem
        : undefined

    const normalizedDeferredRevenueAccountId = directRevenuePosting === true
      ? null
      : deferredRevenueAccountId
    const normalizedDeferredCostAccountId = directRevenuePosting === true
      ? null
      : deferredCostAccountId
    const normalizedInventoryAccountId = itemType !== undefined
      ? (isInventoryItemType(itemType) ? inventoryAccountId : null)
      : inventoryAccountId
    const subsidiaryId = subsidiaryIds !== undefined ? (subsidiaryIds[0] ?? null) : undefined

    const updated = await prisma.item.update({
      where: { id },
      data: {
        ...Object.fromEntries(
          Object.entries({
          name,
          itemId,
          externalId,
          sku,
          itemType,
          itemCategory,
          uom,
          primaryPurchaseUnit,
          primarySaleUnit,
          primaryUnitsType,
          listPrice,
          description,
          salesDescription,
          purchaseDescription,
          revenueStream,
          recognitionMethod,
          recognitionTrigger,
          defaultRevRecTemplateId,
          defaultTermMonths,
          createRevenueArrangementOn,
          createForecastPlanOn,
          createRevenuePlanOn,
          allocationEligible,
          performanceObligationType,
          standaloneSellingPrice,
          billingType,
          billingTrigger,
          standardCost,
          averageCost,
          currencyId,
          subsidiaryId,
          includeChildren,
          departmentId,
          locationId,
          line,
          productLine,
          dropShipItem,
          specialOrderItem,
          canBeFulfilled,
          preferredVendorId,
          incomeAccountId,
          deferredRevenueAccountId: normalizedDeferredRevenueAccountId,
          inventoryAccountId: normalizedInventoryAccountId,
          cogsExpenseAccountId,
          deferredCostAccountId: normalizedDeferredCostAccountId,
          directRevenuePosting,
          active,
          }).filter(([, value]) => value !== undefined)
        ),
        ...(subsidiaryIds !== undefined
          ? {
              itemSubsidiaries: {
                deleteMany: {},
                ...(subsidiaryIds.length > 0
                  ? { create: subsidiaryIds.map((selectedSubsidiaryId) => ({ subsidiaryId: selectedSubsidiaryId })) }
                  : {}),
              },
            }
          : {}),
      },
      include: {
        currency: true,
        subsidiary: true,
        itemSubsidiaries: { include: { subsidiary: true } },
        department: true,
        location: true,
        preferredVendor: true,
        defaultRevRecTemplate: true,
        incomeAccount: true,
        deferredRevenueAccount: true,
        inventoryAccount: true,
        cogsExpenseAccount: true,
        deferredCostAccount: true,
      },
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Unable to update item.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.item.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to delete item.' }, { status: 500 })
  }
}
