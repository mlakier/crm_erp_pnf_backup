export const SYSTEM_NAME = "CRM ERP PNF";

export const APP_MODULES = [
  "platform",
  "crm",
  "q2c",
  "p2p",
  "ap-portal",
  "r2r",
  "revenue-recognition",
  "lease-accounting",
  "fixed-assets",
  "inventory",
  "projects",
  "work-orders",
  "forecasting",
  "cash-forecasting",
  "reporting"
] as const;

export const JOB_NAMES = [
  "email-intake",
  "ocr-processing",
  "workflow-dispatch",
  "billing-run",
  "posting-run",
  "notification-dispatch"
] as const;

export type AppModule = (typeof APP_MODULES)[number];
export type JobName = (typeof JOB_NAMES)[number];

export interface AuditEvent {
  actorUserId?: string;
  entityType: string;
  entityId: string;
  action: string;
  occurredAt: string;
}

export interface CustomFieldDefinitionContract {
  entityType: string;
  internalName: string;
  label: string;
  dataType: "text" | "number" | "currency" | "date" | "datetime" | "checkbox" | "select" | "multiselect" | "json";
  isRequired: boolean;
  isActive: boolean;
}
