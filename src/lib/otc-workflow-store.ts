import { promises as fs } from 'fs'
import path from 'path'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type OtcStep = {
  id: string
  label: string
  enabled: boolean
  order: number
  entity: string
  href: string
}

export type TriggerCondition = {
  field: string
  operator: string
  value: string
}

export type OtcTrigger = {
  id: string
  label: string
  fromStep: string
  toStep: string
  enabled: boolean
  condition: TriggerCondition
  action: string
  resultStatus: string
}

export type ApprovalTier = {
  level: number
  operator: string
  value: number
  approverType: 'role' | 'employee'
  approverValue: string
}

export type OtcApproval = {
  id: string
  label: string
  step: string
  enabled: boolean
  tiers: ApprovalTier[]
}

export type OtcWorkflowConfig = {
  steps: OtcStep[]
  triggers: OtcTrigger[]
  approvals: OtcApproval[]
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const STORE_PATH = path.join(process.cwd(), 'config', 'otc-workflow.json')

const DEFAULT_CONFIG: OtcWorkflowConfig = {
  steps: [
    { id: 'lead', label: 'Lead', enabled: true, order: 1, entity: 'lead', href: '/leads' },
    { id: 'opportunity', label: 'Opportunity', enabled: true, order: 2, entity: 'opportunity', href: '/opportunities' },
    { id: 'quote', label: 'Quote', enabled: true, order: 3, entity: 'quote', href: '/quotes' },
    { id: 'sales-order', label: 'Sales Order', enabled: true, order: 4, entity: 'salesOrder', href: '/sales-orders' },
    { id: 'invoice', label: 'Invoice', enabled: true, order: 5, entity: 'invoice', href: '/invoices' },
    { id: 'fulfillment', label: 'Fulfillment', enabled: true, order: 6, entity: 'fulfillment', href: '/fulfillments' },
    { id: 'invoice-receipt', label: 'Invoice Receipt', enabled: true, order: 7, entity: 'invoiceReceipt', href: '/invoice-receipts' },
  ],
  triggers: [
    { id: 'lead-qualified', label: 'Lead → Opportunity', fromStep: 'lead', toStep: 'opportunity', enabled: false, condition: { field: 'status', operator: 'equals', value: 'qualified' }, action: 'create_next', resultStatus: '' },
    { id: 'opportunity-won', label: 'Opportunity → Quote', fromStep: 'opportunity', toStep: 'quote', enabled: false, condition: { field: 'stage', operator: 'equals', value: 'closed_won' }, action: 'create_next', resultStatus: '' },
    { id: 'quote-accepted', label: 'Quote → Sales Order', fromStep: 'quote', toStep: 'sales-order', enabled: false, condition: { field: 'status', operator: 'equals', value: 'accepted' }, action: 'create_next', resultStatus: '' },
    { id: 'salesorder-fulfilled', label: 'Sales Order → Invoice', fromStep: 'sales-order', toStep: 'invoice', enabled: false, condition: { field: 'status', operator: 'equals', value: 'fulfilled' }, action: 'create_next', resultStatus: '' },
    { id: 'salesorder-fulfillment', label: 'Sales Order → Fulfillment', fromStep: 'sales-order', toStep: 'fulfillment', enabled: false, condition: { field: 'status', operator: 'equals', value: 'fulfilled' }, action: 'create_next', resultStatus: '' },
    { id: 'invoice-receipt', label: 'Invoice → Invoice Receipt', fromStep: 'invoice', toStep: 'invoice-receipt', enabled: false, condition: { field: 'status', operator: 'equals', value: 'paid' }, action: 'create_next', resultStatus: '' },
  ],
  approvals: [
    { id: 'quote-approval', label: 'Quote Approval', step: 'quote', enabled: false, tiers: [{ level: 1, operator: '>=', value: 10000, approverType: 'role', approverValue: 'sales_manager' }, { level: 2, operator: '>=', value: 50000, approverType: 'role', approverValue: 'director' }] },
    { id: 'sales-order-approval', label: 'Sales Order Approval', step: 'sales-order', enabled: false, tiers: [{ level: 1, operator: '>=', value: 25000, approverType: 'role', approverValue: 'sales_manager' }, { level: 2, operator: '>=', value: 100000, approverType: 'role', approverValue: 'vp' }] },
    { id: 'invoice-approval', label: 'Invoice Approval', step: 'invoice', enabled: false, tiers: [{ level: 1, operator: '>=', value: 50000, approverType: 'role', approverValue: 'finance_manager' }, { level: 2, operator: '>=', value: 100000, approverType: 'role', approverValue: 'cfo' }] },
    { id: 'fulfillment-approval', label: 'Fulfillment Approval', step: 'fulfillment', enabled: false, tiers: [{ level: 1, operator: '>=', value: 50000, approverType: 'role', approverValue: 'warehouse_manager' }] },
    { id: 'invoice-receipt-approval', label: 'Invoice Receipt Approval', step: 'invoice-receipt', enabled: false, tiers: [{ level: 1, operator: '>=', value: 100000, approverType: 'role', approverValue: 'finance_manager' }, { level: 2, operator: '>=', value: 250000, approverType: 'role', approverValue: 'cfo' }] },
  ],
}

/* ------------------------------------------------------------------ */
/*  Sanitise                                                           */
/* ------------------------------------------------------------------ */

function sanitize(input: unknown): OtcWorkflowConfig {
  if (!input || typeof input !== 'object') return structuredClone(DEFAULT_CONFIG)
  const root = input as Record<string, unknown>

  // Steps
  const rawSteps = Array.isArray(root.steps) ? root.steps : []
  const steps: OtcStep[] = DEFAULT_CONFIG.steps.map((def) => {
    const match = rawSteps.find((s: Record<string, unknown>) => s && s.id === def.id) as Record<string, unknown> | undefined
    return {
      ...def,
      enabled: match && typeof match.enabled === 'boolean' ? match.enabled : def.enabled,
    }
  })

  // Triggers
  const rawTriggers = Array.isArray(root.triggers) ? root.triggers : []
  const triggers: OtcTrigger[] = DEFAULT_CONFIG.triggers.map((def) => {
    const match = rawTriggers.find((t: Record<string, unknown>) => t && t.id === def.id) as Record<string, unknown> | undefined
    if (!match) return { ...def }
    const cond = match.condition && typeof match.condition === 'object' ? match.condition as Record<string, unknown> : {}
    return {
      ...def,
      enabled: typeof match.enabled === 'boolean' ? match.enabled : def.enabled,
      condition: {
        field: typeof cond.field === 'string' ? cond.field : def.condition.field,
        operator: typeof cond.operator === 'string' ? cond.operator : def.condition.operator,
        value: typeof cond.value === 'string' ? cond.value : def.condition.value,
      },
      action: typeof match.action === 'string' ? match.action : def.action,
      resultStatus: typeof match.resultStatus === 'string' ? match.resultStatus : def.resultStatus,
    }
  })

  // Approvals (tier-based)
  const rawApprovals = Array.isArray(root.approvals) ? root.approvals : []
  const approvals: OtcApproval[] = DEFAULT_CONFIG.approvals.map((def) => {
    const match = rawApprovals.find((a: Record<string, unknown>) => a && a.id === def.id) as Record<string, unknown> | undefined
    if (!match) return { ...def }
    const rawTiers = Array.isArray(match.tiers) ? match.tiers : []
    const tiers: ApprovalTier[] = rawTiers.length > 0
      ? rawTiers.map((t: Record<string, unknown>, i: number) => ({
          level: typeof t.level === 'number' ? t.level : i + 1,
          operator: typeof t.operator === 'string' ? t.operator : '>=',
          value: typeof t.value === 'number' ? t.value : 0,
          approverType: (t.approverType === 'role' || t.approverType === 'employee') ? t.approverType : 'role',
          approverValue: typeof t.approverValue === 'string' ? t.approverValue : (typeof t.approverRole === 'string' ? t.approverRole : 'manager'),
        }))
      : def.tiers
    return {
      ...def,
      enabled: typeof match.enabled === 'boolean' ? match.enabled : def.enabled,
      tiers,
    }
  })

  return { steps, triggers, approvals }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function loadOtcWorkflow(): Promise<OtcWorkflowConfig> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    return sanitize(JSON.parse(raw))
  } catch {
    return structuredClone(DEFAULT_CONFIG)
  }
}

export async function saveOtcWorkflow(input: unknown): Promise<OtcWorkflowConfig> {
  const config = sanitize(input)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return config
}
