import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, fmtPhone } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import DeleteButton from '@/components/DeleteButton'
import LeadDetailCustomizeMode from '@/components/LeadDetailCustomizeMode'
import ConvertLeadButton from '@/components/ConvertLeadButton'
import RecordStatusButton from '@/components/RecordStatusButton'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import RelatedRecordsSection from '@/components/RelatedRecordsSection'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import CommunicationsSection from '@/components/CommunicationsSection'
import SystemNotesSection from '@/components/SystemNotesSection'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import {
  buildLinkedReferenceFieldDefinitions,
  buildLinkedReferencePreviewSources,
} from '@/lib/linked-record-reference-catalogs'
import {
  LEAD_DETAIL_FIELDS,
  LEAD_REFERENCE_SOURCES,
  type LeadDetailFieldKey,
} from '@/lib/lead-detail-customization'
import { loadLeadDetailCustomization } from '@/lib/lead-detail-customization-store'
import { leadPageConfig } from '@/lib/transaction-page-configs/lead'
import { buildTransactionCommunicationComposePayload } from '@/lib/transaction-communications'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
} from '@/lib/transaction-detail-helpers'
import { loadListOptionsForSource } from '@/lib/list-source'
import { loadManagedListDetail } from '@/lib/manage-lists'
import {
  getAvailableWorkflowStatusActions,
  getWorkflowDocumentAction,
  loadOtcWorkflowRuntime,
} from '@/lib/otc-workflow-runtime'
import type { TransactionStatusColorTone } from '@/lib/company-preferences-definitions'
import type { TransactionVisualTone } from '@/lib/transaction-page-config'

function leadName(lead: { firstName: string | null; lastName: string | null; email: string | null }) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  return fullName || lead.email || 'Unnamed Lead'
}

function formatLeadStatus(status: string | null) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
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

function getLeadStatusTone(
  status: string | null,
  configuredTones: Record<string, TransactionStatusColorTone>,
) {
  const key = (status ?? '').toLowerCase()
  return getToneStyle(configuredTones[key] ?? 'default')
}

function getLeadStatusToneKey(
  status: string | null,
  configuredTones: Record<string, TransactionStatusColorTone>,
): TransactionVisualTone {
  const key = (status ?? '').toLowerCase()
  return configuredTones[key] ?? 'default'
}

type LeadHeaderField = RecordHeaderField & { key: LeadDetailFieldKey }

export default async function LeadDetailPage({
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

  const [lead, activities, customization, subsidiaries, currencies, leadSourceOptions, leadRatingOptions, leadStatusListDetail, workflow] =
    await Promise.all([
      prisma.lead.findUnique({
        where: { id },
        include: {
          subsidiary: true,
          currency: true,
          customer: true,
          contact: true,
          opportunity: true,
          user: true,
        },
      }),
      prisma.activity.findMany({
        where: { entityType: 'lead', entityId: id },
        orderBy: { createdAt: 'desc' },
      }),
      loadLeadDetailCustomization(),
      prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
      prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, currencyId: true, code: true, name: true } }),
      loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-LEAD-SRC' }),
      loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-LEAD-RAT' }),
      loadManagedListDetail('LEAD-STATUS'),
      loadOtcWorkflowRuntime(),
    ])

  if (!lead) notFound()

  const detailHref = `/leads/${lead.id}`
  const leadStatusColors = Object.fromEntries(
    (leadStatusListDetail?.rows ?? []).map((row) => [row.value.toLowerCase(), row.colorTone ?? 'default']),
  ) as Record<string, TransactionStatusColorTone>
  const statusTone = getLeadStatusTone(lead.status, leadStatusColors)
  const createdByLabel =
    lead.user?.userId && lead.user?.name
      ? `${lead.user.userId} - ${lead.user.name}`
      : lead.user?.userId ?? lead.user?.name ?? lead.user?.email ?? '-'
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const currencyOptions = currencies.map((currency) => ({
    value: currency.id,
    label: `${currency.code ?? currency.currencyId} - ${currency.name}`,
  }))
  const statusOptions = (leadStatusListDetail?.rows ?? []).map((row) => ({ value: row.value, label: row.value }))
  const sourceOptions = leadSourceOptions.map((option) => ({ value: option.value, label: option.label }))
  const ratingOptions = leadRatingOptions.map((option) => ({ value: option.value, label: option.label }))
  const leadCurrencyCode = lead.currency?.code ?? lead.currency?.currencyId ?? undefined

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

  const headerFieldDefinitions: Record<LeadDetailFieldKey, LeadHeaderField> = {
    id: {
      key: 'id',
      label: 'DB Id',
      value: lead.id,
      helpText: 'Internal database identifier for the lead record.',
      fieldType: 'text',
      subsectionTitle: 'Record Keys',
      subsectionDescription: 'Internal identifiers and traceability fields for this lead.',
    },
    leadNumber: {
      key: 'leadNumber',
      label: 'Lead Id',
      value: lead.leadNumber ?? '',
      helpText: 'Generated lead number used across the Lead-to-Cash flow.',
      fieldType: 'text',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Lead number and ownership context for this record.',
    },
    firstName: {
      key: 'firstName',
      label: 'First Name',
      value: lead.firstName ?? '',
      editable: true,
      type: 'text',
      helpText: 'Lead contact first name.',
      fieldType: 'text',
      subsectionTitle: 'Primary Contact',
      subsectionDescription: 'Primary person and company details captured for this lead.',
    },
    lastName: {
      key: 'lastName',
      label: 'Last Name',
      value: lead.lastName ?? '',
      editable: true,
      type: 'text',
      helpText: 'Lead contact last name.',
      fieldType: 'text',
      subsectionTitle: 'Primary Contact',
      subsectionDescription: 'Primary person and company details captured for this lead.',
    },
    email: {
      key: 'email',
      label: 'Email',
      value: lead.email ?? '',
      editable: true,
      type: 'email',
      helpText: 'Primary email address for the lead.',
      fieldType: 'email',
      subsectionTitle: 'Primary Contact',
      subsectionDescription: 'Primary person and company details captured for this lead.',
    },
    phone: {
      key: 'phone',
      label: 'Phone',
      value: lead.phone ?? '',
      displayValue: fmtPhone(lead.phone),
      editable: true,
      type: 'text',
      helpText: 'Primary phone number for the lead.',
      fieldType: 'text',
      subsectionTitle: 'Primary Contact',
      subsectionDescription: 'Primary person and company details captured for this lead.',
    },
    company: {
      key: 'company',
      label: 'Company',
      value: lead.company ?? '',
      editable: true,
      type: 'text',
      helpText: 'Company or organization associated with the lead.',
      fieldType: 'text',
      subsectionTitle: 'Company Context',
      subsectionDescription: 'Company context and supporting details captured for this lead.',
    },
    title: {
      key: 'title',
      label: 'Title',
      value: lead.title ?? '',
      editable: true,
      type: 'text',
      helpText: 'Job title of the lead contact.',
      fieldType: 'text',
      subsectionTitle: 'Primary Contact',
      subsectionDescription: 'Primary person and company details captured for this lead.',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: lead.status ?? '',
      displayValue: formatLeadStatus(lead.status),
      editable: true,
      type: 'select',
      options: statusOptions,
      helpText: 'Current lifecycle stage of the lead.',
      fieldType: 'list',
      sourceText: 'Lead status list',
      subsectionTitle: 'Qualification Summary',
      subsectionDescription: 'Status, source, and rating used to qualify this lead.',
    },
    source: {
      key: 'source',
      label: 'Source',
      value: lead.source ?? '',
      editable: true,
      type: 'select',
      options: sourceOptions,
      helpText: 'How the lead was sourced.',
      fieldType: 'list',
      sourceText: 'Lead source list',
      subsectionTitle: 'Qualification Summary',
      subsectionDescription: 'Status, source, and rating used to qualify this lead.',
    },
    rating: {
      key: 'rating',
      label: 'Rating',
      value: lead.rating ?? '',
      editable: true,
      type: 'select',
      options: ratingOptions,
      helpText: 'Qualification rating assigned to the lead.',
      fieldType: 'list',
      sourceText: 'Lead rating list',
      subsectionTitle: 'Qualification Summary',
      subsectionDescription: 'Status, source, and rating used to qualify this lead.',
    },
    expectedValue: {
      key: 'expectedValue',
      label: 'Expected Value',
      value: lead.expectedValue?.toString() ?? '',
      displayValue: lead.expectedValue != null ? fmtCurrency(lead.expectedValue, leadCurrencyCode, moneySettings) : '-',
      editable: true,
      type: 'number',
      helpText: 'Estimated commercial value associated with the lead.',
      fieldType: 'currency',
      subsectionTitle: 'Commercial Context',
      subsectionDescription: 'Commercial ownership and value context for this lead.',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: lead.subsidiaryId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      displayValue: lead.subsidiary ? `${lead.subsidiary.subsidiaryId} - ${lead.subsidiary.name}` : '-',
      helpText: 'Owning subsidiary for the lead.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
      subsectionTitle: 'Commercial Context',
      subsectionDescription: 'Commercial ownership and value context for this lead.',
    },
    currencyId: {
      key: 'currencyId',
      label: 'Currency',
      value: lead.currencyId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...currencyOptions],
      displayValue: lead.currency ? `${lead.currency.code ?? lead.currency.currencyId} - ${lead.currency.name}` : '-',
      helpText: 'Preferred currency associated with the lead.',
      fieldType: 'list',
      sourceText: 'Currencies master data',
      subsectionTitle: 'Commercial Context',
      subsectionDescription: 'Commercial ownership and value context for this lead.',
    },
    website: {
      key: 'website',
      label: 'Website',
      value: lead.website ?? '',
      editable: true,
      type: 'text',
      helpText: 'Website for the lead or associated company.',
      fieldType: 'text',
      subsectionTitle: 'Company Context',
      subsectionDescription: 'Company context and supporting details captured for this lead.',
    },
    industry: {
      key: 'industry',
      label: 'Industry',
      value: lead.industry ?? '',
      editable: true,
      type: 'text',
      helpText: 'Industry associated with the lead.',
      fieldType: 'text',
      subsectionTitle: 'Company Context',
      subsectionDescription: 'Company context and supporting details captured for this lead.',
    },
    address: {
      key: 'address',
      label: 'Address',
      value: lead.address ?? '',
      editable: true,
      type: 'text',
      helpText: 'Primary address recorded for the lead.',
      fieldType: 'text',
      subsectionTitle: 'Additional Details',
      subsectionDescription: 'Address and internal notes maintained for this lead.',
    },
    notes: {
      key: 'notes',
      label: 'Notes',
      value: lead.notes ?? '',
      editable: true,
      type: 'text',
      helpText: 'Freeform notes recorded against the lead.',
      fieldType: 'text',
      subsectionTitle: 'Additional Details',
      subsectionDescription: 'Address and internal notes maintained for this lead.',
    },
    lastContactedAt: {
      key: 'lastContactedAt',
      label: 'Last Contacted',
      value: lead.lastContactedAt ? lead.lastContactedAt.toISOString().slice(0, 10) : '',
      displayValue: lead.lastContactedAt ? fmtDocumentDate(lead.lastContactedAt, moneySettings) : '-',
      editable: true,
      type: 'date',
      helpText: 'Most recent contact date for the lead.',
      fieldType: 'date',
      subsectionTitle: 'Qualification Dates',
      subsectionDescription: 'Key lifecycle dates for contact, qualification, and conversion.',
    },
    qualifiedAt: {
      key: 'qualifiedAt',
      label: 'Qualified At',
      value: lead.qualifiedAt ? lead.qualifiedAt.toISOString().slice(0, 10) : '',
      displayValue: lead.qualifiedAt ? fmtDocumentDate(lead.qualifiedAt, moneySettings) : '-',
      editable: true,
      type: 'date',
      helpText: 'Date the lead was qualified.',
      fieldType: 'date',
      subsectionTitle: 'Qualification Dates',
      subsectionDescription: 'Key lifecycle dates for contact, qualification, and conversion.',
    },
    convertedAt: {
      key: 'convertedAt',
      label: 'Converted At',
      value: lead.convertedAt ? lead.convertedAt.toISOString().slice(0, 10) : '',
      displayValue: lead.convertedAt ? fmtDocumentDate(lead.convertedAt, moneySettings) : '-',
      editable: true,
      type: 'date',
      helpText: 'Date the lead was converted.',
      fieldType: 'date',
      subsectionTitle: 'Qualification Dates',
      subsectionDescription: 'Key lifecycle dates for contact, qualification, and conversion.',
    },
    inactive: {
      key: 'inactive',
      label: 'Inactive',
      value: lead.inactive ? 'Yes' : 'No',
      helpText: 'Whether the lead is inactive.',
      fieldType: 'checkbox',
      subsectionTitle: 'Record State',
      subsectionDescription: 'System-managed state and lifecycle flags for this lead.',
    },
    createdBy: {
      key: 'createdBy',
      label: 'Created By',
      value: createdByLabel,
      helpText: 'User who created the lead.',
      fieldType: 'text',
      sourceText: 'Users master data',
      subsectionTitle: 'Document Identity',
      subsectionDescription: 'Lead number and ownership context for this record.',
    },
    createdAt: {
      key: 'createdAt',
      label: 'Created',
      value: lead.createdAt.toISOString(),
      displayValue: fmtDocumentDate(lead.createdAt, moneySettings),
      helpText: 'Date/time the lead record was created.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this lead record.',
    },
    updatedAt: {
      key: 'updatedAt',
      label: 'Last Modified',
      value: lead.updatedAt.toISOString(),
      displayValue: fmtDocumentDate(lead.updatedAt, moneySettings),
      helpText: 'Date/time the lead record was last modified.',
      fieldType: 'date',
      subsectionTitle: 'System Dates',
      subsectionDescription: 'System-managed timestamps for this lead record.',
    },
  }

  const customerHref = lead.customer ? `/customers/${lead.customer.id}` : null
  const contactHref = lead.contact ? `/contacts/${lead.contact.id}` : null
  const opportunityHref = lead.opportunity ? `/opportunities/${lead.opportunity.id}` : null
  const ownerHref = lead.user ? `/users/${lead.user.id}` : null
  const subsidiaryHref = lead.subsidiary ? `/subsidiaries/${lead.subsidiary.id}` : null
  const currencyHref = lead.currency ? `/currencies/${lead.currency.id}` : null

  headerFieldDefinitions.subsidiaryId.href = subsidiaryHref
  headerFieldDefinitions.currencyId.href = currencyHref

  const referenceFieldDefinitions = buildLinkedReferenceFieldDefinitions(LEAD_REFERENCE_SOURCES, {
    customer: lead.customer,
    contact: lead.contact,
    opportunity: lead.opportunity,
    owner: lead.user,
    subsidiary: lead.subsidiary,
    currency: lead.currency,
  }, {
    customer: customerHref,
    contact: contactHref,
    opportunity: opportunityHref,
    owner: ownerHref,
    subsidiary: subsidiaryHref,
    currency: currencyHref,
  })

  const allFieldDefinitions: Record<string, RecordHeaderField> = {
    ...headerFieldDefinitions,
    ...referenceFieldDefinitions,
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: LEAD_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions: leadPageConfig.sectionDescriptions,
  })

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: LEAD_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
      id: lead.id,
      leadNumber: lead.leadNumber ?? '',
      phone: fmtPhone(lead.phone),
      status: formatLeadStatus(lead.status),
      expectedValue: lead.expectedValue != null ? fmtCurrency(lead.expectedValue, leadCurrencyCode, moneySettings) : '-',
      subsidiaryId: lead.subsidiary ? `${lead.subsidiary.subsidiaryId} - ${lead.subsidiary.name}` : '-',
      currencyId: lead.currency ? `${lead.currency.code ?? lead.currency.currencyId} - ${lead.currency.name}` : '-',
      inactive: lead.inactive ? 'Yes' : 'No',
      createdBy: createdByLabel,
      createdAt: fmtDocumentDate(lead.createdAt, moneySettings),
      updatedAt: fmtDocumentDate(lead.updatedAt, moneySettings),
      lastContactedAt: lead.lastContactedAt ? fmtDocumentDate(lead.lastContactedAt, moneySettings) : '-',
      qualifiedAt: lead.qualifiedAt ? fmtDocumentDate(lead.qualifiedAt, moneySettings) : '-',
      convertedAt: lead.convertedAt ? fmtDocumentDate(lead.convertedAt, moneySettings) : '-',
    },
  })
  const statsRecord = {
    company: lead.company ?? null,
    source: lead.source ?? null,
    expectedValue: Number(lead.expectedValue ?? 0),
    currencyCode: leadCurrencyCode ?? null,
    statusLabel: formatLeadStatus(lead.status),
    statusTone: getLeadStatusToneKey(lead.status, leadStatusColors),
    createdAt: fmtDocumentDate(lead.createdAt, moneySettings),
    moneySettings,
  } as const
  const statPreviewCards = leadPageConfig.stats.map((stat) => ({
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
  const referenceSourceDefinitions = buildLinkedReferencePreviewSources(LEAD_REFERENCE_SOURCES, {
    customer: lead.customer,
    contact: lead.contact,
    opportunity: lead.opportunity,
    owner: lead.user,
    subsidiary: lead.subsidiary,
    currency: lead.currency,
  })
  const referenceSections = (customization.referenceLayouts ?? [])
    .map((referenceLayout) => {
      const source = LEAD_REFERENCE_SOURCES.find((entry) => entry.id === referenceLayout.referenceId)
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
  const leadRelatedRecordsTabs = [
    {
      key: 'customers',
      label: 'Customers',
      count: lead.customer ? 1 : 0,
      emptyMessage: 'No customer has been linked to this lead yet.',
      rows: lead.customer
        ? [
            {
              id: lead.customer.id,
              type: 'Customer',
              reference: lead.customer.customerId ?? 'Pending',
              name: lead.customer.name,
              details: [lead.customer.email, lead.customer.phone].filter(Boolean).join(' | ') || '-',
              href: `/customers/${lead.customer.id}`,
            },
          ]
        : [],
    },
    {
      key: 'contacts',
      label: 'Contacts',
      count: lead.contact ? 1 : 0,
      emptyMessage: 'No contact has been linked to this lead yet.',
      rows: lead.contact
        ? [
            {
              id: lead.contact.id,
              type: 'Contact',
              reference: lead.contact.contactNumber ?? 'Pending',
              name: `${lead.contact.firstName ?? ''} ${lead.contact.lastName ?? ''}`.trim() || lead.contact.email || '-',
              details: lead.contact.email ?? '-',
              href: `/contacts/${lead.contact.id}`,
            },
          ]
        : [],
    },
    {
      key: 'opportunities',
      label: 'Opportunities',
      count: lead.opportunity ? 1 : 0,
      emptyMessage: 'No opportunity has been linked to this lead yet.',
      rows: lead.opportunity
        ? [
            {
              id: lead.opportunity.id,
              type: 'Opportunity',
              reference: lead.opportunity.opportunityNumber ?? 'Pending',
              name: lead.opportunity.name,
              details: '-',
              href: `/opportunities/${lead.opportunity.id}`,
            },
          ]
        : [],
    },
  ]
  const communicationsToolbarTargetId = 'lead-communications-toolbar'
  const systemNotesToolbarTargetId = 'lead-system-notes-toolbar'
  const leadStatusActions = getAvailableWorkflowStatusActions(workflow, 'lead', lead.status)
  const leadConvertAction = getWorkflowDocumentAction(workflow, 'lead', 'opportunity', lead.status)

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/leads'}
      backLabel={isCustomizing ? '<- Back to Lead Detail' : '<- Back to Leads'}
      meta={lead.leadNumber ?? 'Pending'}
      title={leadName(lead)}
      badge={
        <div className="flex flex-wrap gap-2">
          <span className="inline-block rounded-full px-3 py-0.5 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}>
            Lead
          </span>
          <span className="inline-block rounded-full px-3 py-0.5 text-sm font-medium" style={{ backgroundColor: statusTone.bg, color: statusTone.color }}>
            {formatLeadStatus(lead.status)}
          </span>
        </div>
      }
      widthClassName="w-full max-w-none"
      headerCenter={
        !isCustomizing && !isEditing ? (
          <div className="flex flex-wrap items-start gap-2">
            {leadStatusActions.map((action) => (
              <RecordStatusButton
                key={action.id}
                resource="leads"
                id={lead.id}
                status={action.nextValue}
                label={action.label}
                tone={action.tone}
                fieldName={action.fieldName}
                workflowStep={action.step}
                workflowActionId={action.id}
              />
            ))}
            <ConvertLeadButton
              leadId={lead.id}
              canConvert={Boolean(leadConvertAction)}
              opportunityId={lead.opportunity?.id ?? null}
            />
          </div>
        ) : null
      }
      actions={
          <TransactionActionStack
            mode={isCustomizing ? 'customize' : isEditing ? 'edit' : 'detail'}
            cancelHref={detailHref}
            formId={`inline-record-form-${lead.id}`}
            recordId={lead.id}
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
                  <MasterDataDetailCreateMenu newHref="/leads/new" duplicateHref={`/leads/new?duplicateFrom=${encodeURIComponent(lead.id)}`} />
                  <MasterDataDetailExportMenu
                    title={lead.leadNumber ?? leadName(lead)}
                    fileName={`lead-${lead.leadNumber ?? lead.id}`}
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
                  <DeleteButton resource="leads" id={lead.id} />
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
              stats={leadPageConfig.stats}
              visibleStatCards={customization.statCards}
            />
          )
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
              <LeadDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFields}
                referenceSourceDefinitions={referenceSourceDefinitions}
                sectionDescriptions={leadPageConfig.sectionDescriptions}
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
                  containerDescription="Expanded context from linked records on this lead."
                  showSubsections={false}
                />
              ) : null}
              <RecordHeaderDetails
                purchaseOrderId={lead.id}
                editing={isEditing}
                sections={headerSections}
                columns={customization.formColumns}
                containerTitle="Lead Details"
                containerDescription="Core lead data, organized into customizable sections. Move fields between sections in Customize as needed."
                showSubsections={false}
                showSectionDescriptions={true}
                updateUrl={`/api/leads?id=${encodeURIComponent(lead.id)}`}
              />
            </div>
          )
        }
        lineItems={null}
        relatedRecords={isCustomizing ? null : (
          <RelatedRecordsSection embedded tabs={leadRelatedRecordsTabs} showDisplayControl={false} />
        )}
        relatedRecordsCount={leadRelatedRecordsTabs.reduce((sum, tab) => sum + tab.count, 0)}
        relatedDocuments={isCustomizing ? null : (
          <div className="px-6 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            No related documents are attached to this lead yet.
          </div>
        )}
        relatedDocumentsCount={0}
        communications={isCustomizing ? null : (
          <CommunicationsSection
            embedded
            toolbarTargetId={communicationsToolbarTargetId}
            showDisplayControl={false}
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: lead.id,
              userId: lead.userId,
              number: lead.leadNumber ?? leadName(lead),
              counterpartyName: lead.company ?? leadName(lead),
              counterpartyEmail: lead.email ?? null,
              fromEmail: lead.user?.email ?? null,
              status: formatLeadStatus(lead.status),
              total: lead.expectedValue != null ? fmtCurrency(lead.expectedValue, leadCurrencyCode, moneySettings) : '-',
              lineItems: [],
              sendEmailEndpoint: '/api/leads?action=send-email',
              recordIdFieldName: 'leadId',
              documentLabel: 'Lead',
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
