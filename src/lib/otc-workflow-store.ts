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
}

export type ApprovalCondition = {
  field: string
  operator: string
  value: number
}

export type OtcApproval = {
  id: string
  label: string
  step: string
  enabled: boolean
  condition: ApprovalCondition
  approverRole: string
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
  ],
  triggers: [
    { id: 'lead-qualified', label: 'Lead → Opportunity', fromStep: 'lead', toStep: 'opportunity', enabled: false, condition: { field: 'status', operator: 'equals', value: 'qualified' }, action: 'create_next' },
    { id: 'opportunity-won', label: 'Opportunity → Quote', fromStep: 'opportunity', toStep: 'quote', enabled: false, condition: { field: 'stage', operator: 'equals', value: 'closed_won' }, action: 'create_next' },
    { id: 'quote-accepted', label: 'Quote → Sales Order', fromStep: 'quote', toStep: 'sales-order', enabled: false, condition: { field: 'status', operator: 'equals', value: 'accepted' }, action: 'create_next' },
    { id: 'salesorder-fulfilled', label: 'Sales Order → Invoice', fromStep: 'sales-order', toStep: 'invoice', enabled: false, condition: { field: 'status', operator: 'equals', value: 'fulfilled' }, action: 'create_next' },
  ],
  approvals: [
    { id: 'quote-approval', label: 'Quote Approval', step: 'quote', enabled: false, condition: { field: 'total', operator: '>=', value: 10000 }, approverRole: 'manager' },
    { id: 'sales-order-approval', label: 'Sales Order Approval', step: 'sales-order', enabled: false, condition: { field: 'total', operator: '>=', value: 25000 }, approverRole: 'manager' },
    { id: 'invoice-approval', label: 'Invoice Approval', step: 'invoice', enabled: false, condition: { field: 'total', operator: '>=', value: 50000 }, approverRole: 'manager' },
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
    }
  })

  // Approvals
  const rawApprovals = Array.isArray(root.approvals) ? root.approvals : []
  const approvals: OtcApproval[] = DEFAULT_CONFIG.approvals.map((def) => {
    const match = rawApprovals.find((a: Record<string, unknown>) => a && a.id === def.id) as Record<string, unknown> | undefined
    if (!match) return { ...def }
    const cond = match.condition && typeof match.condition === 'object' ? match.condition as Record<string, unknown> : {}
    return {
      ...def,
      enabled: typeof match.enabled === 'boolean' ? match.enabled : def.enabled,
      condition: {
        field: typeof cond.field === 'string' ? cond.field : def.condition.field,
        operator: typeof cond.operator === 'string' ? cond.operator : def.condition.operator,
        value: typeof cond.value === 'number' ? cond.value : (typeof cond.value === 'string' ? parseFloat(cond.value) || def.condition.value : def.condition.value),
      },
      approverRole: typeof match.approverRole === 'string' ? match.approverRole : def.approverRole,
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
