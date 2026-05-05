import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, fmtPhone, toNumericValue } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import DeleteButton from '@/components/DeleteButton'
import OpportunityCreateQuoteButton from '@/components/OpportunityCreateQuoteButton'
import RecordStatusButton from '@/components/RecordStatusButton'
import OpportunityDetailCustomizeMode from '@/components/OpportunityDetailCustomizeMode'
import OpportunityRelatedDocumentsSection from '@/components/OpportunityRelatedDocumentsSection'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import TransactionLineItemsSection from '@/components/TransactionLineItemsSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import CommunicationsSection from '@/components/CommunicationsSection'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  buildLinkedReferenceFieldDefinitions,
  buildLinkedReferencePreviewSources,
} from '@/lib/linked-record-reference-catalogs'
import {
  OPPORTUNITY_DETAIL_FIELDS,
  OPPORTUNITY_REFERENCE_SOURCES,
  OPPORTUNITY_LINE_COLUMNS,
  type OpportunityDetailFieldKey,
} from '@/lib/opportunity-detail-customization'
import { loadOpportunityDetailCustomization } from '@/lib/opportunity-detail-customization-store'
import { opportunityPageConfig } from '@/lib/transaction-page-configs/opportunity'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'
import { loadManagedListDetail } from '@/lib/manage-lists'
import {
  getAvailableWorkflowStatusActions,
  getWorkflowDocumentAction,
  loadOtcWorkflowRuntime,
} from '@/lib/otc-workflow-runtime'
import type { TransactionStatusColorTone } from '@/lib/company-preferences-definitions'
import type { TransactionVisualTone } from '@/lib/transaction-page-config'

type OpportunityHeaderField = RecordHeaderField & { key: OpportunityDetailFieldKey }

function formatStage(stage: string | null) {
  if (!stage) return 'Unknown'
  return stage.charAt(0).toUpperCase() + stage.slice(1)
}

function getToneStyle(tone: TransactionStatusColorTone) {
  if (tone === 'gray') {
    return { bg: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }
  }
  if (tone === 'accent') {
    return { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }
  }
  if (tone === 'teal') {
    return { bg: 'rgba(20,184,166,0.18)', color: '#5eead4' }
  }
  if (tone === 'yellow') {
    return { bg: 'rgba(245,158,11,0.18)', color: '#fcd34d' }
  }
  if (tone === 'orange') {
    return { bg: 'rgba(249,115,22,0.18)', color: '#fdba74' }
  }
  if (tone === 'green') {
    return { bg: 'rgba(34,197,94,0.16)', color: '#86efac' }
  }
  if (tone === 'red') {
    return { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' }
  }
  if (tone === 'purple') {
    return { bg: 'rgba(168,85,247,0.18)', color: '#d8b4fe' }
  }
  if (tone === 'pink') {
    return { bg: 'rgba(236,72,153,0.18)', color: '#f9a8d4' }
  }
  return { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }
}

function getOpportunityStageTone(
  stage: string | null,
  configuredTones: Record<string, TransactionStatusColorTone>,
) {
  const key = (stage ?? '').toLowerCase()
  const configuredTone =
    key === 'prospecting' || key === 'qualified' || key === 'proposal' || key === 'negotiation' || key === 'won' || key === 'lost'
      ? configuredTones[key]
      : 'default'
  return getToneStyle(configuredTone)
}

function getOpportunityStageToneKey(
  stage: string | null,
  configuredTones: Record<string, TransactionStatusColorTone>,
): TransactionVisualTone {
  const key = (stage ?? '').toLowerCase()
  return key === 'prospecting' || key === 'qualified' || key === 'proposal' || key === 'negotiation' || key === 'won' || key === 'lost'
    ? configuredTones[key]
    : 'default'
}

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ edit?: string; customize?: string }>
}) {
  await connection()
  const { id } = await params
  const resolvedSearchParams = (await searchParams) ?? {}
  const isEditing = resolvedSearchParams.edit === '1'
  const isCustomizing = resolvedSearchParams.customize === '1'
  const { moneySettings } = await loadCompanyDisplaySettings()

  const [opportunity, activities, customization, items, stageListDetail, subsidiaries, currencies, workflow] = await Promise.all([
    prisma.opportunity.findUnique({
      where: { id },
      include: {
        quote: {
          include: {
            salesOrder: {
              include: {
                fulfillments: {
                  orderBy: { createdAt: 'desc' },
                  select: {
                    id: true,
                    number: true,
                    status: true,
                    date: true,
                    notes: true,
                  },
                },
            invoices: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                number: true,
                status: true,
                total: true,
                currencyId: true,
                dueDate: true,
                createdAt: true,
                    cashReceipts: {
                      orderBy: { date: 'desc' },
                      select: {
                        id: true,
                        number: true,
                        amount: true,
                        date: true,
                        method: true,
                        reference: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        user: true,
        lineItems: {
          orderBy: { createdAt: 'asc' },
          include: { item: true },
        },
        customer: {
          include: {
            contacts: { orderBy: { firstName: 'asc' } },
          },
        },
        subsidiary: true,
        currency: true,
      },
    }),
    prisma.activity.findMany({
      where: { entityType: 'opportunity', entityId: id },
      orderBy: { createdAt: 'desc' },
    }),
    loadOpportunityDetailCustomization(),
    prisma.item.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, listPrice: true, itemId: true },
    }),
    loadManagedListDetail('OPP-STAGE'),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, currencyId: true, code: true, name: true } }),
    loadOtcWorkflowRuntime(),
  ])

  if (!opportunity) notFound()

  const detailHref = `/opportunities/${opportunity.id}`
  const activityUserIds = Array.from(new Set(activities.map((activity) => activity.userId).filter(Boolean))) as string[]
  const activityUsers = activityUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: activityUserIds } },
        select: { id: true, userId: true, name: true, email: true },
      })
    : []
  const activityUserLabelById = new Map(
    activityUsers.map((user) => [
      user.id,
      user.userId && user.name ? `${user.userId} - ${user.name}` : user.userId ?? user.name ?? user.email,
    ]),
  )

  const opportunityStageColors = Object.fromEntries(
    (stageListDetail?.rows ?? []).map((row) => [row.value.toLowerCase(), row.colorTone ?? 'default']),
  ) as Record<string, TransactionStatusColorTone>
  const statusTone = getOpportunityStageTone(opportunity.stage, opportunityStageColors)
  const stageSelectOptions = (stageListDetail?.rows ?? []).map((row) => ({ value: row.value, label: row.value }))
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const currencyOptions = currencies.map((currency) => ({
    value: currency.id,
    label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
  }))
  const currencyCodeById = new Map(currencies.map((currency) => [currency.id, currency.code ?? currency.currencyId ?? null]))
  const lineRows = opportunity.lineItems.map((line, index) => ({
    id: line.id,
    lineNumber: index + 1,
    itemId: line.item?.itemId ?? null,
    itemName: line.item?.name ?? null,
    description: line.description,
    notes: line.notes ?? null,
    quantity: line.quantity,
    unitPrice: toNumericValue(line.unitPrice, 0),
    lineTotal: toNumericValue(line.lineTotal, 0),
  }))
  const systemNotes = activities
    .map((activity) => {
      const parsed = parseFieldChangeSummary(activity.summary)
      if (!parsed) return null
      return {
        id: activity.id,
        date: fmtDocumentDate(activity.createdAt, moneySettings),
        setBy: activity.userId ? activityUserLabelById.get(activity.userId) ?? activity.userId : 'System',
        context: parsed.context,
        fieldName: parsed.fieldName,
        oldValue: parsed.oldValue,
        newValue: parsed.newValue,
      }
    })
    .filter((note): note is Exclude<typeof note, null> => Boolean(note))
  const communications = activities
    .map((activity) => {
      const parsed = parseCommunicationSummary(activity.summary)
      if (!parsed) return null
      return {
        id: activity.id,
        date: fmtDocumentDate(activity.createdAt, moneySettings),
        direction: parsed.direction || '-',
        channel: parsed.channel || '-',
        subject: parsed.subject || '-',
        from: parsed.from || '-',
        to: parsed.to || '-',
        status: parsed.status || '-',
      }
    })
    .filter((communication): communication is Exclude<typeof communication, null> => Boolean(communication))

  const headerFieldDefinitions: Record<OpportunityDetailFieldKey, OpportunityHeaderField> = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: opportunity.id,
      helpText: 'Internal database identifier for the opportunity record.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Core identifiers and forecast metadata for this opportunity.',
    },
    customerId: {
      key: 'customerId',
      label: 'Customer Id',
      value: opportunity.customerId,
      displayValue: opportunity.customer.customerId ?? '-',
      helpText: 'Internal customer identifier linked to the opportunity.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerName: {
      key: 'customerName',
      label: 'Customer Name',
      value: opportunity.customer.name,
      helpText: 'Display name from the linked customer record.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    customerEmail: {
      key: 'customerEmail',
      label: 'Email',
      value: opportunity.customer.email ?? '',
      displayValue: opportunity.customer.email ?? '-',
      helpText: 'Primary customer email address.',
      fieldType: 'email',
      sourceText: 'Customers master data',
    },
    customerPhone: {
      key: 'customerPhone',
      label: 'Phone',
      value: opportunity.customer.phone ?? '',
      displayValue: fmtPhone(opportunity.customer.phone),
      helpText: 'Primary customer phone number.',
      fieldType: 'text',
      sourceText: 'Customers master data',
    },
    userId: {
      key: 'userId',
      label: 'User Id',
      value: opportunity.userId,
      displayValue: opportunity.user?.userId ?? '-',
      helpText: 'Internal user identifier for the opportunity owner.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Core identifiers and forecast metadata for this opportunity.',
    },
    opportunityNumber: {
      key: 'opportunityNumber',
      label: 'Opportunity Id',
      value: opportunity.opportunityNumber ?? '',
      displayValue: opportunity.opportunityNumber ?? '-',
      editable: true,
      type: 'text',
      helpText: 'Unique identifier for the opportunity.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Core identifiers and forecast metadata for this opportunity.',
    },
    name: {
      key: 'name',
      label: 'Opportunity Name',
      value: opportunity.name,
      editable: true,
      type: 'text',
      helpText: 'Display name for the opportunity.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Core identifiers and forecast metadata for this opportunity.',
    },
    stage: {
      key: 'stage',
      label: 'Stage',
      value: opportunity.stage ?? '',
      displayValue: formatStage(opportunity.stage),
      editable: true,
      type: 'select',
      options: stageSelectOptions,
      helpText: 'Current lifecycle stage of the opportunity.',
      fieldType: 'list',
      sourceText: 'Opportunity stage list',
      subsectionTitle: 'Forecast Terms',
      subsectionDescription: 'Forecast amount, stage, close date, and downstream quote context.',
    },
    amount: {
      key: 'amount',
      label: 'Amount',
      value: String(toNumericValue(opportunity.amount, 0)),
      displayValue: fmtCurrency(
        opportunity.amount,
        opportunity.currency?.code ?? opportunity.currency?.currencyId ?? undefined,
        moneySettings,
      ),
      editable: true,
      type: 'number',
      helpText: 'Current estimated amount or total of the opportunity.',
      fieldType: 'currency',
      subsectionTitle: 'Forecast Terms',
      subsectionDescription: 'Forecast amount, stage, close date, and downstream quote context.',
    },
    closeDate: {
      key: 'closeDate',
      label: 'Close Date',
      value: opportunity.closeDate ? opportunity.closeDate.toISOString().slice(0, 10) : '',
      displayValue: opportunity.closeDate ? fmtDocumentDate(opportunity.closeDate, moneySettings) : '-',
      editable: true,
      type: 'date',
      helpText: 'Expected close date for the opportunity.',
      fieldType: 'date',
      subsectionTitle: 'Forecast Terms',
      subsectionDescription: 'Forecast amount, stage, close date, and downstream quote context.',
    },
    probability: {
      key: 'probability',
      label: 'Probability',
      value: opportunity.probability != null ? String(opportunity.probability) : '',
      displayValue: opportunity.probability != null ? `${Math.round(opportunity.probability)}%` : '-',
      editable: true,
      type: 'number',
      helpText: 'Forecast probability percentage for the opportunity.',
      fieldType: 'number',
      subsectionTitle: 'Forecast Terms',
      subsectionDescription: 'Forecast amount, stage, close date, and downstream quote context.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: opportunity.subsidiaryId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      displayValue: opportunity.subsidiary ? `${opportunity.subsidiary.subsidiaryId} - ${opportunity.subsidiary.name}` : '-',
      helpText: 'Owning subsidiary for the opportunity.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Forecast Terms',
      subsectionDescription: 'Forecast amount, stage, close date, and downstream quote context.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: opportunity.currencyId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      displayValue: opportunity.currency ? `${opportunity.currency.code ?? opportunity.currency.currencyId} - ${opportunity.currency.name}` : '-',
      helpText: 'Transaction currency for the opportunity.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Forecast Terms',
      subsectionDescription: 'Forecast amount, stage, close date, and downstream quote context.',
    },
    quoteNumber: {
      key: 'quoteNumber',
      label: 'Quote',
      value: opportunity.quote?.number ?? '',
      displayValue: opportunity.quote ? (
        <Link href={`/quotes/${opportunity.quote.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {opportunity.quote.number}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Quote generated from this opportunity.',
      fieldType: 'text',
      sourceText: 'Quote transaction',
      subsectionTitle: 'Forecast Terms',
      subsectionDescription: 'Forecast amount, stage, close date, and downstream quote context.',
    },
    inactive: {
      key: 'inactive',
      label: 'Inactive',
      value: opportunity.inactive ? 'Yes' : 'No',
      displayValue: opportunity.inactive ? 'Yes' : 'No',
      helpText: 'Whether the opportunity is inactive.',
      fieldType: 'checkbox',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this opportunity.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: opportunity.createdAt.toISOString(),
      displayValue: fmtDocumentDate(opportunity.createdAt, moneySettings),
      helpText: 'Date/time the opportunity record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this opportunity.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: opportunity.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(opportunity.updatedAt, moneySettings),
      helpText: 'Date/time the opportunity record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this opportunity.',
    },
  }

  const customerHref = `/customers/${opportunity.customer.id}`
  const ownerHref = opportunity.user ? `/users/${opportunity.user.id}` : null
  const quoteHref = opportunity.quote ? `/quotes/${opportunity.quote.id}` : null
  const subsidiaryHref = opportunity.subsidiary ? `/subsidiaries/${opportunity.subsidiary.id}` : null
  const currencyHref = opportunity.currency ? `/currencies/${opportunity.currency.id}` : null

  headerFieldDefinitions.customerId.href = customerHref
  headerFieldDefinitions.userId.href = ownerHref
  headerFieldDefinitions.quoteNumber.href = quoteHref
  headerFieldDefinitions.subsidiaryId.href = subsidiaryHref
  headerFieldDefinitions.currencyId.href = currencyHref

  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(OPPORTUNITY_REFERENCE_SOURCES, {
    customer: opportunity.customer,
    owner: opportunity.user,
    quote: opportunity.quote,
    subsidiary: opportunity.subsidiary,
    currency: opportunity.currency,
  }, {
    customer: customerHref,
    owner: ownerHref,
    quote: quoteHref,
    subsidiary: subsidiaryHref,
    currency: currencyHref,
  })
  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...headerFieldDefinitions,
    ...referenceFieldDefinitions,
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: OPPORTUNITY_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions: opportunityPageConfig.sectionDescriptions,
  })
  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: OPPORTUNITY_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
  })
  const visibleLineColumns = getOrderedVisibleTransactionLineColumns(OPPORTUNITY_LINE_COLUMNS, customization)
  const statsRecord = {
    amount: toNumericValue(opportunity.amount, 0),
    currencyCode: opportunity.currency?.code ?? opportunity.currency?.currencyId ?? null,
    closeDate: opportunity.closeDate,
    lineCount: lineRows.length,
    quoteNumber: opportunity.quote?.number ?? null,
    quoteHref: opportunity.quote ? `/quotes/${opportunity.quote.id}` : null,
    stageLabel: formatStage(opportunity.stage),
    stageTone: getOpportunityStageToneKey(opportunity.stage, opportunityStageColors),
    moneySettings,
  } as const
  const statPreviewCards = opportunityPageConfig.stats.map((stat) => ({
    id: stat.id,
    label: stat.label,
    value: stat.getValue(statsRecord),
    href: stat.getHref?.(statsRecord) ?? null,
    accent: stat.accent,
    valueTone: stat.getValueTone?.(statsRecord),
    cardTone: stat.getCardTone?.(statsRecord),
    supportsColorized: Boolean(stat.accent || stat.getValueTone || stat.getCardTone),
    supportsLink: Boolean(stat.getHref),
  }))
  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(OPPORTUNITY_REFERENCE_SOURCES, {
    customer: opportunity.customer,
    owner: opportunity.user,
    quote: opportunity.quote,
    subsidiary: opportunity.subsidiary,
    currency: opportunity.currency,
  })
  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = OPPORTUNITY_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
      if (!source) return null
      const fields = source.fields
        .filter((field) => referenceLayout.fields[field.id]?.visible)
        .sort((left, right) => {
          const leftConfig = referenceLayout.fields[left.id]
          const rightConfig = referenceLayout.fields[right.id]
          if (!leftConfig || !rightConfig) return 0
          if (leftConfig.column !== rightConfig.column) return leftConfig.column - rightConfig.column
          return leftConfig.order - rightConfig.order
        })
        .map((field) => ({
          ...allFieldDefinitions[field.id],
          column: referenceLayout.fields[field.id]?.column ?? 1,
          order: referenceLayout.fields[field.id]?.order ?? 0,
        }))

      if (fields.length === 0) return null

      return {
        title: source.label,
        description: source.description,
        columns: referenceLayout.formColumns,
        rows: Math.max(1, ...fields.map((field) => Math.max(1, (field.order ?? 0) + 1))),
        fields,
      }
    })
    .filter((section): section is NonNullable<typeof section> => Boolean(section))
  const referenceColumns = Math.max(1, ...referenceSections.map((section) => section.columns))
  const opportunityStatusActions = getAvailableWorkflowStatusActions(workflow, 'opportunity', opportunity.stage)
  const createQuoteAction = getWorkflowDocumentAction(workflow, 'opportunity', 'quote', opportunity.stage)
  const relatedDocumentsCount =
    (opportunity.quote ? 1 : 0) +
    opportunity.customer.contacts.length +
    (opportunity.quote?.salesOrder ? 1 : 0) +
    (opportunity.quote?.salesOrder?.fulfillments.length ?? 0) +
    (opportunity.quote?.salesOrder?.invoices.length ?? 0) +
    (opportunity.quote?.salesOrder?.invoices.flatMap((invoice) => invoice.cashReceipts).length ?? 0)
  const communicationsToolbarTargetId = 'opportunity-communications-toolbar'
  const systemNotesToolbarTargetId = 'opportunity-system-notes-toolbar'

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/opportunities'}
      backLabel={isCustomizing ? '<- Back to Opportunity Detail' : '<- Back to Opportunities'}
      meta={opportunity.opportunityNumber ?? 'Pending'}
      title={opportunity.name}
      badge={
        <div className="flex flex-wrap gap-2">
          <span className="inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
            Opportunity
          </span>
          <span className="inline-block rounded-full px-3 py-0.5 text-sm font-medium" style={{ backgroundColor: statusTone.bg, color: statusTone.color }}>
            {formatStage(opportunity.stage)}
          </span>
        </div>
      }
      widthClassName="w-full max-w-none"
      headerCenter={
        !isCustomizing && !isEditing ? (
          <div className="flex flex-wrap items-start gap-2">
            {opportunityStatusActions.map((action) => (
              <RecordStatusButton
                key={action.id}
                resource="opportunities"
                id={opportunity.id}
                status={action.nextValue}
                label={action.label}
                tone={action.tone}
                fieldName={action.fieldName}
                workflowStep={action.step}
                workflowActionId={action.id}
              />
            ))}
            {createQuoteAction || opportunity.quote ? (
              <OpportunityCreateQuoteButton
                opportunityId={opportunity.id}
                existingQuoteId={opportunity.quote?.id ?? null}
              />
            ) : null}
          </div>
        ) : null
      }
      actions={
          <TransactionActionStack
            mode={isCustomizing ? 'customize' : isEditing ? 'edit' : 'detail'}
            cancelHref={detailHref}
            formId={`inline-record-form-${opportunity.id}`}
            recordId={opportunity.id}
            primaryActions={
              isEditing ? (
                <Link
                  href={`${detailHref}?customize=1`}
                  className="rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                >
                  Customize
                </Link>
              ) : (
                <>
                  <MasterDataDetailCreateMenu newHref="/opportunities/new" duplicateHref={`/opportunities/new?duplicateFrom=${encodeURIComponent(opportunity.id)}`} />
                  <MasterDataDetailExportMenu
                    title={opportunity.opportunityNumber ?? opportunity.name}
                    fileName={`opportunity-${opportunity.opportunityNumber ?? opportunity.id}`}
                    sections={headerSections.map((section) => ({
                      title: section.title,
                      fields: section.fields.map((field) => ({
                        label: field.label,
                        value: field.value ?? '',
                        type: field.type,
                        options: field.options,
                      })),
                    }))}
                  />
                  <Link
                    href={`${detailHref}?customize=1`}
                    className="rounded-md border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
                  >
                    Customize
                  </Link>
                  <Link
                    href={`${detailHref}?edit=1`}
                    className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                    style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                  >
                    Edit
                  </Link>
                  <DeleteButton resource="opportunities" id={opportunity.id} />
                </>
              )
            }
          />
      }
    >
      <TransactionDetailFrame
        showFooterSections={!isCustomizing}
        stats={
          isCustomizing ? null : (
            <TransactionStatsRow
              record={statsRecord}
              stats={opportunityPageConfig.stats}
              visibleStatCards={customization.statCards}
            />
          )
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
              <OpportunityDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFields}
                referenceSourceDefinitions={referenceSourceDefinitions}
                sectionDescriptions={opportunityPageConfig.sectionDescriptions}
                statPreviewCards={statPreviewCards}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {referenceSections.length > 0 ? (
                <RecordHeaderDetails
                  editing={false}
                  sections={referenceSections.map((section) => ({
                    title: section.title,
                    description: section.description,
                    rows: section.rows,
                    fields: section.fields,
                  }))}
                  columns={referenceColumns}
                  containerTitle="Reference Details"
                  containerDescription="Expanded context from linked records on this opportunity."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                purchaseOrderId={opportunity.id}
                editing={isEditing}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Opportunity Details"
                containerDescription="Core opportunity fields organized into configurable sections."
                showSubsections={false}
                updateUrl={`/api/opportunities?id=${encodeURIComponent(opportunity.id)}`}
              />
            </div>
          )
        }
        lineItems={
          isCustomizing ? null : (
            <div>
              <TransactionLineItemsSection
                rows={lineRows.map((row, index) => ({
                  id: row.id,
                  displayOrder: index,
                  itemRecordId: opportunity.lineItems[index]?.item?.id ?? null,
                  itemId: row.itemId,
                  itemName: row.itemName,
                  description: row.description,
                  notes: row.notes,
                  quantity: row.quantity,
                  receivedQuantity: 0,
                  billedQuantity: 0,
                  openQuantity: row.quantity,
                  unitPrice: row.unitPrice,
                  lineTotal: row.lineTotal,
                }))}
                editing={isEditing}
                purchaseOrderId={opportunity.id}
                userId={opportunity.userId}
                itemOptions={items.map((item) => ({
                  id: item.id,
                  itemId: item.itemId ?? 'ITEM',
                  name: item.name,
                  unitPrice: toNumericValue(item.listPrice, 0),
                }))}
                lineColumns={visibleLineColumns}
                lineSettings={customization.lineSettings}
                lineColumnCustomization={customization.lineColumns}
                sectionTitle="Opportunity Line Items"
                lineItemApiBasePath="/api/opportunities/line-items"
                deleteResource="opportunities/line-items"
                parentIdFieldName="opportunityId"
                tableId="opportunity-line-items"
                allowAddLines={isEditing}
              />
            </div>
          )
        }
        relatedRecords={isCustomizing ? null : (
          <RelatedRecordsSection
            embedded
            showDisplayControl={false}
            tabs={[
              {
                key: 'customer',
                label: 'Customer',
                count: 1,
                emptyMessage: 'No related customer is linked to this opportunity.',
                rows: [
                  {
                    id: opportunity.customer.id,
                    type: 'Customer',
                    reference: opportunity.customer.customerId ?? opportunity.customer.id,
                    name: opportunity.customer.name,
                    details: [opportunity.customer.email, opportunity.customer.phone].filter(Boolean).join(' | ') || '-',
                    href: `/customers/${opportunity.customer.id}`,
                  },
                ],
              },
              {
                key: 'contacts',
                label: 'Contacts',
                count: opportunity.customer.contacts.length,
                emptyMessage: 'No related contacts are linked to this opportunity.',
                rows: opportunity.customer.contacts.map((contact) => ({
                  id: contact.id,
                  type: 'Contact',
                  reference: contact.contactNumber ?? contact.id,
                  name: `${contact.firstName} ${contact.lastName}`.trim(),
                  details: [contact.email, contact.position].filter(Boolean).join(' | ') || '-',
                  href: `/contacts/${contact.id}`,
                })),
              },
            ]}
          />
        )}
        relatedRecordsCount={1 + opportunity.customer.contacts.length}
        relatedDocuments={isCustomizing ? null : (
            <OpportunityRelatedDocumentsSection
              embedded
              showDisplayControl={false}
              defaultCurrencyCode={opportunity.currency?.code ?? opportunity.currency?.currencyId ?? null}
            quote={
              opportunity.quote
                ? {
                    id: opportunity.quote.id,
                    href: `/quotes/${opportunity.quote.id}`,
                    number: opportunity.quote.number,
                    status: opportunity.quote.status ?? '-',
                    total: toNumericValue(opportunity.quote.total, 0),
                    currencyCode: currencyCodeById.get(opportunity.quote.currencyId ?? '') ?? null,
                  }
                : null
            }
            salesOrders={
              opportunity.quote?.salesOrder
                ? [
                    {
                      id: opportunity.quote.salesOrder.id,
                      href: `/sales-orders/${opportunity.quote.salesOrder.id}`,
                      number: opportunity.quote.salesOrder.number,
                      status: opportunity.quote.salesOrder.status,
                      total: toNumericValue(opportunity.quote.salesOrder.total, 0),
                      currencyCode: currencyCodeById.get(opportunity.quote.salesOrder.currencyId ?? '') ?? null,
                    },
                  ]
                : []
            }
            fulfillments={
              opportunity.quote?.salesOrder?.fulfillments.map((fulfillment) => ({
                id: fulfillment.id,
                href: `/fulfillments/${fulfillment.id}`,
                number: fulfillment.number,
                status: fulfillment.status,
                date: fulfillment.date.toISOString(),
                notes: fulfillment.notes,
              })) ?? []
            }
            invoices={
              opportunity.quote?.salesOrder?.invoices.map((invoice) => ({
                id: invoice.id,
                href: `/invoices/${invoice.id}`,
                number: invoice.number,
                status: invoice.status,
                total: toNumericValue(invoice.total, 0),
                currencyCode: currencyCodeById.get(invoice.currencyId ?? '') ?? null,
                dueDate: invoice.dueDate?.toISOString() ?? null,
                createdAt: invoice.createdAt.toISOString(),
              })) ?? []
            }
            invoiceReceipts={
              opportunity.quote?.salesOrder?.invoices.flatMap((invoice) =>
                invoice.cashReceipts.map((receipt) => ({
                  id: receipt.id,
                  href: `/invoice-receipts/${receipt.id}`,
                  number: receipt.number ?? 'Pending',
                  amount: toNumericValue(receipt.amount, 0),
                  currencyCode: currencyCodeById.get(invoice.currencyId ?? '') ?? null,
                  date: receipt.date.toISOString(),
                  method: receipt.method,
                  reference: receipt.reference,
                })),
              ) ?? []
            }
            contacts={[]}
          />
        )}
        relatedDocumentsCount={relatedDocumentsCount}
        supplementarySections={isCustomizing ? null : []}
        communications={isCustomizing ? null : (
          <CommunicationsSection
            embedded
            toolbarTargetId={communicationsToolbarTargetId}
            showDisplayControl={false}
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: opportunity.id,
              userId: opportunity.userId,
              number: opportunity.opportunityNumber ?? opportunity.name,
              counterpartyName: opportunity.customer.name,
              counterpartyEmail: opportunity.customer.email ?? null,
              fromEmail: opportunity.user?.email ?? null,
              status: formatStage(opportunity.stage),
              total: fmtCurrency(
                opportunity.amount,
                opportunity.currency?.code ?? opportunity.currency?.currencyId ?? undefined,
                moneySettings,
              ),
              lineItems: lineRows.map((row) => ({
                line: row.lineNumber,
                itemId: row.itemId ?? '-',
                description: row.description,
                quantity: row.quantity,
                receivedQuantity: 0,
                openQuantity: row.quantity,
                billedQuantity: 0,
                unitPrice: row.unitPrice,
                lineTotal: row.lineTotal,
              })),
            })}
          />
        )}
        communicationsCount={communications.length}
        communicationsToolbarTargetId={communicationsToolbarTargetId}
        communicationsToolbarPlacement="tab-bar"
        systemNotes={isCustomizing ? null : <SystemNotesSection embedded toolbarTargetId={systemNotesToolbarTargetId} showDisplayControl={false} notes={systemNotes} />}
        systemNotesCount={systemNotes.length}
        systemNotesToolbarTargetId={systemNotesToolbarTargetId}
        systemNotesToolbarPlacement="tab-bar"
      />
    </RecordDetailPageShell>
  )
}
