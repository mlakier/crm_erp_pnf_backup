import { fmtCurrency } from '@/lib/format'
import type { TransactionPageConfig } from '@/lib/transaction-page-config'

export type PurchaseOrderPageConfigRecord = {
  total: number
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const purchaseOrderPageConfig: TransactionPageConfig<PurchaseOrderPageConfigRecord> = {
  sectionDescriptions: {
    Vendor: 'Supplier master data linked to this purchase order.',
    'Purchase Order Details': 'Core purchase order fields and procurement lifecycle status.',
  },
  stats: [],
}
