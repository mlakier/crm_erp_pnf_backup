export type TransactionCommunicationLine = {
  line: number
  itemId: string
  description: string
  quantity: number
  receivedQuantity: number
  openQuantity: number
  billedQuantity: number
  unitPrice: number
  lineTotal: number
}

export type TransactionCommunicationComposePayload = {
  recordId: string
  userId?: string | null
  number: string
  counterpartyName: string
  counterpartyEmail?: string | null
  fromEmail?: string | null
  status: string
  total: string
  lineItems: TransactionCommunicationLine[]
  sendEmailEndpoint: string
  recordIdFieldName: string
  documentLabel: string
}

export function buildTransactionCommunicationComposePayload(input: {
  recordId: string
  userId?: string | null
  number: string
  counterpartyName: string
  counterpartyEmail?: string | null
  fromEmail?: string | null
  status: string
  total: string
  lineItems: TransactionCommunicationLine[]
  sendEmailEndpoint?: string
  recordIdFieldName?: string
  documentLabel?: string
}): TransactionCommunicationComposePayload {
  return {
    recordId: input.recordId,
    userId: input.userId ?? null,
    number: input.number,
    counterpartyName: input.counterpartyName,
    counterpartyEmail: input.counterpartyEmail ?? null,
    fromEmail: input.fromEmail ?? null,
    status: input.status,
    total: input.total,
    lineItems: input.lineItems,
    sendEmailEndpoint: input.sendEmailEndpoint ?? '/api/purchase-orders?action=send-email',
    recordIdFieldName: input.recordIdFieldName ?? 'purchaseOrderId',
    documentLabel: input.documentLabel ?? 'Purchase Order',
  }
}
