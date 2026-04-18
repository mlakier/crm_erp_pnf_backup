import { promises as fs } from 'fs';
import path from 'path';

export type PtpStep = {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  entity: string;
  href: string;
};

export type TriggerCondition = {
  field: string;
  operator: string;
  value: string;
};

export type PtpTrigger = {
  id: string;
  label: string;
  fromStep: string;
  toStep: string;
  enabled: boolean;
  condition: TriggerCondition;
  action: string;
  resultStatus: string;
};

export type ApprovalTier = {
  level: number;
  operator: string;
  value: number;
  approverType: 'role' | 'employee';
  approverValue: string;
};

export type PtpApproval = {
  id: string;
  label: string;
  step: string;
  enabled: boolean;
  tiers: ApprovalTier[];
};

export type PtpWorkflowConfig = {
  steps: PtpStep[];
  triggers: PtpTrigger[];
  approvals: PtpApproval[];
};

const STORE_PATH = path.join(process.cwd(), 'config', 'ptp-workflow.json');

const DEFAULT_CONFIG: PtpWorkflowConfig = {
  steps: [
    { id: 'requisition', label: 'Requisition', enabled: true, order: 1, entity: 'requisition', href: '/purchase-requisitions' },
    { id: 'po', label: 'Purchase Order', enabled: true, order: 2, entity: 'purchase-order', href: '/purchase-orders' },
    { id: 'receipt', label: 'Receipt', enabled: true, order: 3, entity: 'receipt', href: '/receipts' },
    { id: 'bill', label: 'Bill', enabled: true, order: 4, entity: 'bill', href: '/bills' },
    { id: 'payment', label: 'Payment', enabled: false, order: 5, entity: 'payment', href: '/payments' },
  ],
  triggers: [],
  approvals: [],
};

export async function loadPtpWorkflowConfig(): Promise<PtpWorkflowConfig> {
  try {
    const data = await fs.readFile(STORE_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function savePtpWorkflowConfig(config: PtpWorkflowConfig) {
  await fs.writeFile(STORE_PATH, JSON.stringify(config, null, 2), 'utf8');
}
