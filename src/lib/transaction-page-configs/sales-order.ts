import { fmtCurrency } from '@/lib/format'
import type { TransactionPageConfig } from '@/lib/transaction-page-config'

export type SalesOrderPageConfigRecord = {
  id: string
  total: number
  createdFrom: string | null
  lineCount: number
  statusLabel: string
  statusTone?: 'default' | 'blue' | 'green' | 'red'
  customerId: string | null
  customerHref: string | null
  userId: string | null
  quoteId: string | null
  quoteHref: string | null
  opportunityId: string | null
  opportunityHref: string | null
  subsidiaryId: string | null
  currencyId: string | null
  createdAt: string | null
  updatedAt: string | null
  moneySettings?: Parameters<typeof fmtCurrency>[2]
}

export const salesOrderPageConfig: TransactionPageConfig<SalesOrderPageConfigRecord> = {
  sectionDescriptions: {
    Customer: 'Customer contact and default commercial context from the linked master data record.',
    'Sales Order Details': 'Core order control fields and upstream sales context.',
  },
  stats: [
    {
      id: 'total',
      label: 'Sales Order Total',
      accent: true,
      getValue: (record) => fmtCurrency(record.total, undefined, record.moneySettings),
    },
    {
      id: 'createdFrom',
      label: 'Created From',
      getValue: (record) => record.createdFrom ?? '-',
      getHref: (record) => record.quoteHref,
      getValueTone: (record) => (record.quoteHref ? 'accent' : 'default'),
    },
    {
      id: 'lineCount',
      label: 'Sales Order Lines',
      getValue: (record) => record.lineCount,
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (record) => record.statusLabel,
      getValueTone: (record) =>
        record.statusTone === 'green'
          ? 'green'
          : record.statusTone === 'red'
            ? 'red'
            : record.statusTone === 'blue'
              ? 'accent'
              : 'default',
    },
    {
      id: 'customerId',
      label: 'Customer Id',
      getValue: (record) => record.customerId ?? '-',
      getHref: (record) => record.customerHref,
      getValueTone: (record) => (record.customerHref ? 'accent' : 'default'),
    },
    {
      id: 'userId',
      label: 'User Id',
      getValue: (record) => record.userId ?? '-',
    },
    {
      id: 'quoteId',
      label: 'Quote Id',
      getValue: (record) => record.quoteId ?? '-',
      getHref: (record) => record.quoteHref,
      getValueTone: (record) => (record.quoteHref ? 'accent' : 'default'),
    },
    {
      id: 'opportunityId',
      label: 'Opportunity Id',
      getValue: (record) => record.opportunityId ?? '-',
      getHref: (record) => record.opportunityHref,
      getValueTone: (record) => (record.opportunityHref ? 'accent' : 'default'),
    },
    {
      id: 'subsidiaryId',
      label: 'Subsidiary Id',
      getValue: (record) => record.subsidiaryId ?? '-',
    },
    {
      id: 'currencyId',
      label: 'Currency Id',
      getValue: (record) => record.currencyId ?? '-',
    },
    {
      id: 'createdAt',
      label: 'Created',
      getValue: (record) => record.createdAt ?? '-',
    },
    {
      id: 'updatedAt',
      label: 'Last Modified',
      getValue: (record) => record.updatedAt ?? '-',
    },
    {
      id: 'dbId',
      label: 'DB Id',
      getValue: (record) => record.id,
    },
  ],
}
