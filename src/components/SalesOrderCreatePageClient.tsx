'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import TransactionActionStack from '@/components/TransactionActionStack'
import PurchaseOrderHeaderSections, { type PurchaseOrderHeaderField } from '@/components/PurchaseOrderHeaderSections'
import PurchaseOrderLineItemsSection from '@/components/PurchaseOrderLineItemsSection'
import { buildConfiguredTransactionSections } from '@/lib/transaction-detail-helpers'
import {
  SALES_ORDER_DETAIL_FIELDS,
  SALES_ORDER_LINE_COLUMNS,
  type SalesOrderDetailCustomizationConfig,
  type SalesOrderDetailFieldKey,
} from '@/lib/sales-order-detail-customization'
import { fmtCurrency } from '@/lib/format'
import { sumMoney } from '@/lib/money'

type CustomerOption = {
  id: string
  customerId: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  inactive: boolean
  subsidiary: { id: string; subsidiaryId: string; name: string } | null
  currency: { id: string; currencyId: string; code: string; name: string } | null
}

type UserOption = {
  id: string
  userId: string | null
  name: string | null
  email: string
}

type RelatedOption = {
  id: string
  label: string
}

type ItemOption = {
  id: string
  itemId: string
  name: string
  unitPrice: number
}

type DraftLine = {
  itemId: string | null
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  displayOrder: number
}

type SalesOrderHeaderField = {
  key: SalesOrderDetailFieldKey
} & PurchaseOrderHeaderField

const sectionDescriptions: Record<string, string> = {
  Customer: 'Customer contact and default commercial context from the linked master data record.',
  'Sales Order Details': 'Core order control fields and upstream sales context.',
}

export default function SalesOrderCreatePageClient({
  nextNumber,
  customers,
  users,
  quotes,
  subsidiaries,
  currencies,
  items,
  customization,
  statusOptions,
}: {
  nextNumber: string
  customers: CustomerOption[]
  users: UserOption[]
  quotes: RelatedOption[]
  subsidiaries: Array<{ id: string; subsidiaryId: string; name: string }>
  currencies: Array<{ id: string; currencyId: string; code: string; name: string }>
  items: ItemOption[]
  customization: SalesOrderDetailCustomizationConfig
  statusOptions: Array<{ value: string; label: string }>
}) {
  const router = useRouter()
  const defaultUser = users[0] ?? null
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    id: '',
    customerId: '',
    customerName: '',
    customerNumber: '',
    customerEmail: '',
    customerPhone: '',
    customerAddress: '',
    customerPrimarySubsidiary: '',
    customerPrimaryCurrency: '',
    customerInactive: '',
    number: nextNumber,
    userId: defaultUser?.id ?? '',
    quoteId: '',
    createdBy: defaultUser ? `${defaultUser.userId ?? defaultUser.email}${defaultUser.name ? ` - ${defaultUser.name}` : ''}` : '',
    createdFrom: '',
    opportunityId: '',
    subsidiaryId: '',
    currencyId: '',
    status: 'draft',
    total: '0',
    createdAt: '',
    updatedAt: '',
  })
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])
  const [error, setError] = useState('')

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === (headerValues.customerId ?? '')) ?? null,
    [customers, headerValues.customerId]
  )
  const selectedUser = useMemo(
    () => users.find((user) => user.id === (headerValues.userId ?? '')) ?? null,
    [users, headerValues.userId]
  )

  const customerOptions = customers.map((customer) => ({
    value: customer.id,
    label: `${customer.customerId ?? 'CUSTOMER'} - ${customer.name}`,
  }))
  const userOptions = users.map((user) => ({
    value: user.id,
    label: user.userId && user.name ? `${user.userId} - ${user.name}` : user.userId ?? user.name ?? user.email,
  }))
  const quoteOptions = quotes.map((quote) => ({
    value: quote.id,
    label: quote.label,
  }))
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const currencyOptions = currencies.map((currency) => ({
    value: currency.id,
    label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
  }))

  const computedTotal = useMemo(() => sumMoney(draftLines.map((line) => line.lineTotal)), [draftLines])
  const headerFieldDefinitions: Record<SalesOrderDetailFieldKey, SalesOrderHeaderField> = {
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: selectedCustomer?.name ?? '',
      displayValue: selectedCustomer?.name ?? '-',
      helpText: 'Display name from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerNumber: {
      key: 'customerNumber',
      label: 'Customer #',
      value: selectedCustomer?.customerId ?? '',
      displayValue: selectedCustomer?.customerId ?? '-',
      helpText: 'Internal customer identifier from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerEmail: {
      key: 'customerEmail',
      label: 'Email',
      value: selectedCustomer?.email ?? '',
      displayValue: selectedCustomer?.email ?? '-',
      helpText: 'Primary customer email address.',
      fieldType: 'email',
      sourceText: 'Customers master data',
    },
    customerPhone: {
      key: 'customerPhone',
      label: 'Phone',
      value: selectedCustomer?.phone ?? '',
      displayValue: selectedCustomer?.phone ?? '-',
      helpText: 'Primary customer phone number.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerAddress: {
      key: 'customerAddress',
      label: 'Billing Address',
      value: selectedCustomer?.address ?? '',
      displayValue: selectedCustomer?.address ?? '-',
      helpText: 'Main billing address from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerPrimarySubsidiary: {
      key: 'customerPrimarySubsidiary',
      label: 'Primary Subsidiary',
      value: selectedCustomer?.subsidiary ? `${selectedCustomer.subsidiary.subsidiaryId} - ${selectedCustomer.subsidiary.name}` : '',
      displayValue: selectedCustomer?.subsidiary ? `${selectedCustomer.subsidiary.subsidiaryId} - ${selectedCustomer.subsidiary.name}` : '-',
      helpText: 'Default subsidiary context from the linked customer record.',
      fieldType: 'list',
      sourceText: 'Customers master data',
    },
    customerPrimaryCurrency: {
      key: 'customerPrimaryCurrency',
      label: 'Primary Currency',
      value: selectedCustomer?.currency ? `${selectedCustomer.currency.code ?? selectedCustomer.currency.currencyId} - ${selectedCustomer.currency.name}` : '',
      displayValue: selectedCustomer?.currency ? `${selectedCustomer.currency.code ?? selectedCustomer.currency.currencyId} - ${selectedCustomer.currency.name}` : '-',
      helpText: 'Default transaction currency from the linked customer record.',
      fieldType: 'list',
      sourceText: 'Customers master data',
    },
    customerInactive: {
      key: 'customerInactive',
      label: 'Inactive',
      value: selectedCustomer ? (selectedCustomer.inactive ? 'Yes' : 'No') : '',
      displayValue: selectedCustomer ? (selectedCustomer.inactive ? 'Yes' : 'No') : '-',
      helpText: 'Indicates whether the linked customer is inactive for new activity.',
      fieldType: 'checkbox',
      sourceText: 'Customers master data',
    },
    id: {
      key: 'id',
      label: 'DB Id',
      value: '',
      displayValue: '-',
      helpText: 'Internal database identifier for the sales order record.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    customerId: {
      key: 'customerId',
      label: 'Customer Id',
      value: headerValues.customerId,
      editable: true,
      type: 'select',
      options: customerOptions,
      displayValue: selectedCustomer?.customerId ?? '-',
      helpText: 'Customer identifier linked to this sales order.',
      fieldType: 'text',
      sourceText: 'Customers master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    userId: {
      key: 'userId',
      label: 'User Id',
      value: headerValues.userId,
      editable: true,
      type: 'select',
      options: userOptions,
      displayValue: selectedUser?.userId ?? '-',
      helpText: 'User identifier for the creator/owner of the sales order.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    quoteId: {
      key: 'quoteId',
      label: 'Quote Id',
      value: headerValues.quoteId,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...quoteOptions],
      displayValue: quotes.find((quote) => quote.id === headerValues.quoteId)?.label ?? '-',
      helpText: 'Quote identifier linked to this sales order.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    number: {
      key: 'number',
      label: 'Sales Order Id',
      value: headerValues.number,
      editable: true,
      type: 'text',
      helpText: 'Unique sales order number used across OTC workflows.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Sales order number, source context, and ownership for this document.',
    },
    createdBy: {
      key: 'createdBy',
      label: 'Created By',
      value: selectedUser?.userId ?? '',
      displayValue: selectedUser ? (selectedUser.userId && selectedUser.name ? `${selectedUser.userId} - ${selectedUser.name}` : selectedUser.userId ?? selectedUser.name ?? selectedUser.email) : '-',
      helpText: 'User who created the sales order.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Sales order number, source context, and ownership for this document.',
    },
    createdFrom: {
      key: 'createdFrom',
      label: 'Created From',
      value: headerValues.quoteId ? (quotes.find((quote) => quote.id === headerValues.quoteId)?.label ?? '') : '',
      displayValue: quotes.find((quote) => quote.id === headerValues.quoteId)?.label ?? '-',
      helpText: 'Source quote that created this sales order.',
      fieldType: 'text',
      sourceText: 'Source transaction',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Sales order number, source context, and ownership for this document.',
    },
    opportunityId: {
      key: 'opportunityId',
      label: 'Opportunity Id',
      value: '',
      displayValue: '-',
      helpText: 'Opportunity identifier linked through the source quote.',
      fieldType: 'text',
      sourceText: 'Opportunities',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal and foreign-key references for this sales order.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: headerValues.subsidiaryId,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      displayValue: subsidiaries.find((subsidiary) => subsidiary.id === headerValues.subsidiaryId)
        ? `${subsidiaries.find((subsidiary) => subsidiary.id === headerValues.subsidiaryId)?.subsidiaryId} - ${subsidiaries.find((subsidiary) => subsidiary.id === headerValues.subsidiaryId)?.name}`
        : '-',
      helpText: 'Subsidiary that owns the sales order.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, fulfillment status, and monetary context for the order.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: headerValues.currencyId,
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      displayValue: currencies.find((currency) => currency.id === headerValues.currencyId)
        ? `${currencies.find((currency) => currency.id === headerValues.currencyId)?.code ?? currencies.find((currency) => currency.id === headerValues.currencyId)?.currencyId} - ${currencies.find((currency) => currency.id === headerValues.currencyId)?.name}`
        : '-',
      helpText: 'Transaction currency for the sales order.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, fulfillment status, and monetary context for the order.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: headerValues.status,
      editable: true,
      type: 'select',
      options: statusOptions,
      displayValue: statusOptions.find((option) => option.value === headerValues.status)?.label ?? 'Draft',
      helpText: 'Current lifecycle stage of the sales order.',
      fieldType: 'list',
      sourceText: 'System sales order statuses',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, fulfillment status, and monetary context for the order.',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: String(computedTotal),
      displayValue: fmtCurrency(computedTotal),
      helpText: 'Current document total based on all sales order line amounts.',
      fieldType: 'currency',
      subsectionTitle: 'Commercial Terms',
      subsectionDescription: 'Commercial controls, fulfillment status, and monetary context for the order.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: '',
      displayValue: '-',
      helpText: 'Date/time the sales order record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this sales order record.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: '',
      displayValue: '-',
      helpText: 'Date/time the sales order record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this sales order record.',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: SALES_ORDER_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions,
  })

  async function handleSubmit(values: Record<string, string>) {
    setError('')

    const response = await fetch('/api/sales-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: values.number,
        customerId: values.customerId,
        userId: values.userId,
        quoteId: values.quoteId || null,
        subsidiaryId: values.subsidiaryId || null,
        currencyId: values.currencyId || null,
        status: values.status || 'draft',
        lineItems: draftLines,
      }),
    })

    const body = await response.json()
    if (!response.ok) {
      setError(body?.error ?? 'Unable to create sales order')
      return { ok: false, error: body?.error ?? 'Unable to create sales order' }
    }

    router.push(`/sales-orders/${body.id}`)
    return { ok: true }
  }

  const poCompatibleLineColumns = SALES_ORDER_LINE_COLUMNS.map((column) => {
    if (column.id === 'fulfilled-qty') return { id: 'received-qty' as const, label: column.label }
    return column.id === 'line' ||
      column.id === 'item-id' ||
      column.id === 'description' ||
      column.id === 'quantity' ||
      column.id === 'open-qty' ||
      column.id === 'unit-price' ||
      column.id === 'line-total'
      ? { id: column.id, label: column.label }
      : null
  }).filter((column): column is { id: 'line' | 'item-id' | 'description' | 'quantity' | 'received-qty' | 'open-qty' | 'unit-price' | 'line-total'; label: string } => Boolean(column))

  return (
    <RecordDetailPageShell
      backHref="/sales-orders"
      backLabel="<- Back to Sales Orders"
      meta="New"
      title="Sales Order"
      badge={
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm"
            style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
          >
            Sales Order
          </span>
          <span
            className="inline-flex rounded-full px-3 py-0.5 text-sm font-medium"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}
          >
            Draft
          </span>
        </div>
      }
      widthClassName="w-full max-w-none"
      actions={<TransactionActionStack mode="create" cancelHref="/sales-orders" formId="create-sales-order-form" />}
    >
      <PurchaseOrderHeaderSections
        editing
        sections={headerSections}
        columns={customization.formColumns}
        formId="create-sales-order-form"
        submitMode="controlled"
        onValuesChange={setHeaderValues}
        onSubmit={handleSubmit}
      />

      {error ? (
        <p className="mb-4 text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}

      <PurchaseOrderLineItemsSection
        rows={[]}
        editing
        purchaseOrderId="draft-sales-order"
        userId={headerValues.userId || defaultUser?.id || 'draft-user'}
        itemOptions={items}
        lineColumns={poCompatibleLineColumns}
        sectionTitle="Sales Order Line Items"
        draftMode
        onDraftRowsChange={setDraftLines}
      />
    </RecordDetailPageShell>
  )
}
