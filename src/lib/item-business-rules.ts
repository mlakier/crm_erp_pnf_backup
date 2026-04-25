export function normalizeItemOrderFlags({
  dropShipItem,
  specialOrderItem,
}: {
  dropShipItem: boolean
  specialOrderItem: boolean
}) {
  return {
    dropShipItem,
    specialOrderItem: dropShipItem ? false : specialOrderItem,
  }
}

export function validateItemOrderFlags({
  dropShipItem,
  specialOrderItem,
}: {
  dropShipItem: boolean
  specialOrderItem: boolean
}) {
  if (dropShipItem && specialOrderItem) {
    return 'Drop Ship Item and Special Order Item cannot both be checked.'
  }
  return null
}

export function isInventoryItemType(itemType: string | null | undefined) {
  return String(itemType ?? '').trim().toLowerCase() === 'inventory'
}

export function validateItemInventoryRules({
  itemType,
  dropShipItem,
  specialOrderItem,
  inventoryAccountId,
}: {
  itemType?: string | null
  dropShipItem?: boolean
  specialOrderItem?: boolean
  inventoryAccountId?: string | null
}) {
  const inventoryItemType = isInventoryItemType(itemType)
  const normalizedInventoryAccountId = String(inventoryAccountId ?? '').trim()

  if (inventoryItemType && dropShipItem) {
    return 'Drop Ship Item cannot be enabled when Item Type is Inventory.'
  }

  if (specialOrderItem && !inventoryItemType) {
    return 'Special Order Item can only be enabled when Item Type is Inventory.'
  }

  if (inventoryItemType && !normalizedInventoryAccountId) {
    return 'Asset Account is required when Item Type is Inventory.'
  }

  return null
}

const REVENUE_TRIGGER_ORDER: Record<string, number> = {
  'Opportunity Close-Won': 10,
  'Quote Approval': 20,
  'Sales Order Creation': 30,
  'Sales Order Approval': 40,
  'Service Start': 50,
  Fulfillment: 60,
  'Invoice Posting': 70,
  Manual: 999,
}

function normalizeTrigger(value: string | null | undefined) {
  const text = String(value ?? '').trim()
  return text || null
}

function getTriggerOrder(value: string | null | undefined) {
  const normalized = normalizeTrigger(value)
  if (!normalized) return null
  return REVENUE_TRIGGER_ORDER[normalized] ?? null
}

export function validateItemRevenueTriggerSequence({
  directRevenuePosting,
  recognitionTrigger,
  createRevenueArrangementOn,
  createForecastPlanOn,
  createRevenuePlanOn,
}: {
  directRevenuePosting?: boolean
  recognitionTrigger?: string | null
  createRevenueArrangementOn?: string | null
  createForecastPlanOn?: string | null
  createRevenuePlanOn?: string | null
}) {
  if (directRevenuePosting) return null

  const normalizedRecognitionTrigger = normalizeTrigger(recognitionTrigger)
  const arrangementTrigger = normalizeTrigger(createRevenueArrangementOn)
  const forecastTrigger = normalizeTrigger(createForecastPlanOn)
  const revenuePlanTrigger = normalizeTrigger(createRevenuePlanOn)

  const recognitionOrder = getTriggerOrder(normalizedRecognitionTrigger)
  const arrangementOrder = getTriggerOrder(arrangementTrigger)
  const forecastOrder = getTriggerOrder(forecastTrigger)
  const revenuePlanOrder = getTriggerOrder(revenuePlanTrigger)

  if (arrangementTrigger && forecastTrigger && arrangementOrder != null && forecastOrder != null && forecastOrder < arrangementOrder) {
    return 'Create Forecast Plan On cannot be earlier than Create Revenue Arrangement On.'
  }

  if (arrangementTrigger && revenuePlanTrigger && arrangementOrder != null && revenuePlanOrder != null && revenuePlanOrder < arrangementOrder) {
    return 'Create Revenue Plan On cannot be earlier than Create Revenue Arrangement On.'
  }

  if (normalizedRecognitionTrigger && arrangementTrigger && recognitionOrder != null && arrangementOrder != null && recognitionOrder < arrangementOrder) {
    return 'Recognition Trigger cannot be earlier than Create Revenue Arrangement On.'
  }

  if (normalizedRecognitionTrigger && revenuePlanTrigger && recognitionOrder != null && revenuePlanOrder != null && recognitionOrder < revenuePlanOrder) {
    return 'Recognition Trigger cannot be earlier than Create Revenue Plan On.'
  }

  return null
}

export function canReceivePurchaseOrderLine(item?: { dropShipItem: boolean; specialOrderItem: boolean } | null) {
  if (!item) return true
  if (item.dropShipItem) return false
  if (item.specialOrderItem) return true
  return true
}
