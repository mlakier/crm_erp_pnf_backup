'use client'

import SalesOrderRelatedDocuments from '@/components/SalesOrderRelatedDocuments'

type QuoteDoc = {
  id: string
  number: string
  status: string
  total: number
  validUntil: string | null
  opportunityName: string | null
}

type FulfillmentDoc = {
  id: string
  number: string
  status: string
  date: string
  notes: string | null
}

type InvoiceDoc = {
  id: string
  number: string
  status: string
  total: number
  dueDate: string | null
  createdAt: string
}

type CashReceiptDoc = {
  id: string
  amount: number
  date: string
  method: string | null
  reference: string | null
  invoiceNumber: string
}

export default function FulfillmentRelatedDocuments({
  quotes,
  fulfillments,
  invoices,
  cashReceipts,
}: {
  quotes: QuoteDoc[]
  fulfillments: FulfillmentDoc[]
  invoices: InvoiceDoc[]
  cashReceipts: CashReceiptDoc[]
}) {
  return (
    <SalesOrderRelatedDocuments
      quotes={quotes}
      fulfillments={fulfillments}
      invoices={invoices}
      cashReceipts={cashReceipts}
    />
  )
}
