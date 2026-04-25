'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PurchaseOrderHeaderSections, {
  type PurchaseOrderHeaderField,
  type PurchaseOrderHeaderSection,
} from '@/components/PurchaseOrderHeaderSections'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import {
  RecordDetailStatCard,
} from '@/components/RecordDetailPanels'
import PurchaseOrderLineItemsSection from '@/components/PurchaseOrderLineItemsSection'
import { buildConfiguredTransactionSections } from '@/lib/transaction-detail-helpers'
import {
  QUOTE_DETAIL_FIELDS,
  type QuoteDetailCustomizationConfig,
  type QuoteDetailFieldKey,
} from '@/lib/quotes-detail-customization'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'

type OpportunityOption = {
  id: string
  opportunityNumber: string | null
  name: string
  amount: number
  closeDate: string | null
  customer: {
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
  user: {
    id: string
    userId: string | null
    name: string | null
    email: string
  }
  subsidiary: { id: string; subsidiaryId: string; name: string } | null
  currency: { id: string; currencyId: string; code: string; name: string } | null
  lineItems: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: number
    lineTotal: number
    item: { id: string; itemId: string | null; name: string } | null
  }>
}

const sectionDescriptions: Record<string, string> = {
  Customer: 'Customer contact and default commercial context from the linked opportunity.',
  'Quote Details': 'Core quote fields, source opportunity context, and commercial controls.',
}

export default function QuoteCreatePageClient({
  nextNumber,
  opportunities,
  customers,
  customization,
  statusOptions,
}: {
  nextNumber: string
  opportunities: OpportunityOption[]
  customers: Array<{ id: string; customerId: string | null; name: string }>
  customization: QuoteDetailCustomizationConfig
  statusOptions: Array<{ value: string; label: string }>
}) {
  const router = useRouter()
  const initialOpportunity = opportunities[0] ?? null
  const [headerValues, setHeaderValues] = useState<Record<string, string>>(() => ({
    opportunity: initialOpportunity?.id ?? '',
    customerId: initialOpportunity?.customer.id ?? '',
    customerName: initialOpportunity?.customer.name ?? '',
    number: nextNumber,
    status: 'draft',
    validUntil: initialOpportunity?.closeDate ?? '',
    subsidiaryId: initialOpportunity?.subsidiary?.id ?? '',
    currencyId: initialOpportunity?.currency?.id ?? '',
    notes: initialOpportunity
      ? `Generated from opportunity ${initialOpportunity.opportunityNumber ?? initialOpportunity.name}`
      : '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedOpportunity = useMemo(
    () => opportunities.find((opportunity) => opportunity.id === (headerValues.opportunity ?? '')) ?? null,
    [headerValues.opportunity, opportunities]
  )

  const selectedCustomer = selectedOpportunity?.customer ?? null
  const createdByLabel = selectedOpportunity?.user
    ? selectedOpportunity.user.userId && selectedOpportunity.user.name
      ? `${selectedOpportunity.user.userId} - ${selectedOpportunity.user.name}`
      : selectedOpportunity.user.userId ?? selectedOpportunity.user.name ?? selectedOpportunity.user.email
    : '-'

  const quoteTotal = selectedOpportunity
    ? selectedOpportunity.lineItems.length
      ? selectedOpportunity.lineItems.reduce((sum, line) => sum + line.lineTotal, 0)
      : selectedOpportunity.amount
    : 0

  const opportunityOptions = opportunities.map((opportunity) => ({
    value: opportunity.id,
    label: `${opportunity.opportunityNumber ?? opportunity.name} - ${opportunity.customer.name}`,
  }))
  const customerOptions = customers.map((customer) => ({
    value: customer.id,
    label: `${customer.customerId ?? 'CUSTOMER'} - ${customer.name}`,
  }))
  const subsidiaryOptions = Array.from(
    new Map(
      opportunities
        .map((opportunity) => opportunity.subsidiary)
        .filter((subsidiary): subsidiary is NonNullable<OpportunityOption['subsidiary']> => Boolean(subsidiary))
        .map((subsidiary) => [subsidiary.id, subsidiary])
    ).values()
  ).map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const currencyOptions = Array.from(
    new Map(
      opportunities
        .map((opportunity) => opportunity.currency)
        .filter((currency): currency is NonNullable<OpportunityOption['currency']> => Boolean(currency))
        .map((currency) => [currency.id, currency])
    ).values()
  ).map((currency) => ({
    value: currency.id,
    label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
  }))

  const headerFieldDefinitions: Record<QuoteDetailFieldKey, PurchaseOrderHeaderField & { key: QuoteDetailFieldKey }> = {
    customerId: {
      key: 'customerId',
      label: 'Customer',
      value: headerValues.customerId ?? '',
      displayValue: selectedCustomer ? `${selectedCustomer.customerId ?? 'CUSTOMER'} - ${selectedCustomer.name}` : '-',
      editable: true,
      type: 'select',
      options: customerOptions,
      helpText: 'Customer record linked to this quote.',
      fieldType: 'list',
      sourceText: 'Customers master data',
    },
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
    number: {
      key: 'number',
      label: 'Quote Id',
      value: headerValues.number ?? nextNumber,
      editable: true,
      type: 'text',
      helpText: 'Unique quote number used across OTC workflows.',
      fieldType: 'text',
    },
    createdBy: {
      key: 'createdBy',
      label: 'Created By',
      value: createdByLabel,
      displayValue: createdByLabel,
      helpText: 'User who owns the source opportunity and will seed the quote.',
      fieldType: 'text',
      sourceText: 'Users master data',
    },
    createdFrom: {
      key: 'createdFrom',
      label: 'Created From',
      value: selectedOpportunity?.opportunityNumber ?? selectedOpportunity?.name ?? '',
      displayValue: selectedOpportunity?.opportunityNumber ?? selectedOpportunity?.name ?? '-',
      helpText: 'Source opportunity that will create this quote.',
      fieldType: 'text',
      sourceText: 'Source transaction',
    },
    opportunity: {
      key: 'opportunity',
      label: 'Opportunity',
      value: headerValues.opportunity ?? '',
      editable: true,
      type: 'select',
      options: opportunityOptions,
      helpText: 'Opportunity used to seed the quote.',
      fieldType: 'list',
      sourceText: 'Opportunities',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: headerValues.subsidiaryId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      helpText: 'Subsidiary that will own the quote.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: headerValues.currencyId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      helpText: 'Transaction currency for the quote.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: headerValues.status ?? 'draft',
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Current lifecycle stage of the quote.',
      fieldType: 'list',
      sourceText: 'System quote statuses',
    },
    validUntil: {
      key: 'validUntil',
      label: 'Valid Until',
      value: headerValues.validUntil ?? '',
      displayValue: headerValues.validUntil ? fmtDocumentDate(headerValues.validUntil) : '-',
      editable: true,
      type: 'text',
      helpText: 'Date through which the quote remains valid.',
      fieldType: 'date',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: String(quoteTotal),
      displayValue: fmtCurrency(quoteTotal),
      helpText: 'Document total based on all quote line amounts.',
      fieldType: 'currency',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: headerValues.notes ?? '',
      editable: true,
      type: 'text',
      helpText: 'Internal quote notes or summary context.',
      fieldType: 'text',
    },
  }

  const headerSections: PurchaseOrderHeaderSection[] = buildConfiguredTransactionSections({
    fields: QUOTE_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions,
  })

  async function handleCreate(values: Record<string, string>) {
    setSaving(true)
    setError('')

    const opportunityId = values.opportunity?.trim()
    if (!opportunityId) {
      setSaving(false)
      setError('Opportunity is required')
      return { ok: false, error: 'Opportunity is required' }
    }

    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId,
          number: values.number?.trim() || nextNumber,
          customerId: values.customerId?.trim() || null,
          status: values.status?.trim() || 'draft',
          validUntil: values.validUntil?.trim() || null,
          notes: values.notes?.trim() || null,
          subsidiaryId: values.subsidiaryId?.trim() || null,
          currencyId: values.currencyId?.trim() || null,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        const nextError = body?.error || 'Unable to create quote'
        setError(nextError)
        return { ok: false, error: nextError }
      }

      router.push(`/quotes/${body.id}`)
      return { ok: true }
    } catch {
      const nextError = 'Unable to create quote'
      setError(nextError)
      return { ok: false, error: nextError }
    } finally {
      setSaving(false)
    }
  }

  return (
    <RecordDetailPageShell
      backHref="/quotes"
      backLabel="<- Back to Quotes"
      meta={headerValues.number ?? nextNumber}
      title={selectedCustomer?.name ?? 'New Quote'}
      badge={
        <div className="flex flex-wrap gap-2">
          <span className="inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
            Quote
          </span>
          <span className="inline-block rounded-full px-3 py-0.5 text-sm font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}>
            Draft
          </span>
        </div>
      }
      widthClassName="w-full max-w-none"
      actions={
        <>
          <button
            type="button"
            onClick={() => router.push('/quotes')}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="new-quote-form"
            disabled={saving}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <RecordDetailStatCard label="Quote Total" value={fmtCurrency(quoteTotal)} accent />
        <RecordDetailStatCard label="Valid Until" value={headerValues.validUntil ? fmtDocumentDate(headerValues.validUntil) : '-'} />
        <RecordDetailStatCard label="Quote Lines" value={selectedOpportunity?.lineItems.length ?? 0} />
        <RecordDetailStatCard label="Status" value={headerValues.status ? headerValues.status.charAt(0).toUpperCase() + headerValues.status.slice(1) : 'Draft'} />
      </div>

      <PurchaseOrderHeaderSections
        editing
        sections={headerSections}
        columns={customization.formColumns}
        formId="new-quote-form"
        submitMode="controlled"
        onSubmit={handleCreate}
        onValuesChange={(nextValues) => {
          setHeaderValues((previousValues) => {
            const opportunityChanged = nextValues.opportunity !== previousValues.opportunity
            if (!opportunityChanged) return nextValues

            const nextOpportunity = opportunities.find((opportunity) => opportunity.id === nextValues.opportunity)
            if (!nextOpportunity) return nextValues

            return {
              ...nextValues,
              validUntil: nextValues.validUntil || nextOpportunity.closeDate || '',
              subsidiaryId: nextValues.subsidiaryId || nextOpportunity.subsidiary?.id || '',
              currencyId: nextValues.currencyId || nextOpportunity.currency?.id || '',
              customerId: nextOpportunity.customer.id,
              customerName: nextOpportunity.customer.name,
              notes:
                nextValues.notes ||
                `Generated from opportunity ${nextOpportunity.opportunityNumber ?? nextOpportunity.name}`,
            }
          })
        }}
      />

      <PurchaseOrderLineItemsSection
        rows={(selectedOpportunity?.lineItems ?? []).map((line, index) => ({
          id: line.id,
          displayOrder: index,
          itemRecordId: line.item?.id ?? null,
          itemId: line.item?.itemId ?? null,
          itemName: line.item?.name ?? null,
          description: line.description,
          quantity: line.quantity,
          receivedQuantity: 0,
          billedQuantity: 0,
          openQuantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
        }))}
        editing
        purchaseOrderId="draft-quote"
        userId=""
        itemOptions={(selectedOpportunity?.lineItems ?? [])
          .filter((line) => line.item)
          .map((line) => ({
            id: line.item!.id,
            itemId: line.item!.itemId ?? 'ITEM',
            name: line.item!.name,
            unitPrice: line.unitPrice,
          }))}
        draftMode
        sectionTitle="Quote Line Items"
      />

      {error ? (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
    </RecordDetailPageShell>
  )
}
