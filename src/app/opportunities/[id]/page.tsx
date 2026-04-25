import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate, fmtPhone, toNumericValue } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import DeleteButton from '@/components/DeleteButton'
import OpportunityCreateQuoteButton from '@/components/OpportunityCreateQuoteButton'
import OpportunityDetailCustomizeMode from '@/components/OpportunityDetailCustomizeMode'
import OpportunityLineItemForm from '@/components/OpportunityLineItemForm'
import PurchaseOrderHeaderSections, { type PurchaseOrderHeaderField } from '@/components/PurchaseOrderHeaderSections'
import PurchaseOrderLineItemsSection from '@/components/PurchaseOrderLineItemsSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import TransactionDetailFrame from '@/components/TransactionDetailFrame'
import TransactionStatsRow from '@/components/TransactionStatsRow'
import CommunicationsSection from '@/components/CommunicationsSection'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import TransactionActionStack from '@/components/TransactionActionStack'
import InvoiceGlImpactSection, { type InvoiceGlImpactRow } from '@/components/InvoiceGlImpactSection'
import { RecordDetailSection, RecordDetailEmptyState, RecordDetailCell, RecordDetailHeaderCell } from '@/components/RecordDetailPanels'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  OPPORTUNITY_DETAIL_FIELDS,
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
import { loadListOptionsForSource } from '@/lib/list-source'

type OpportunityHeaderField = PurchaseOrderHeaderField & { key: OpportunityDetailFieldKey }

function formatStage(stage: string | null) {
  if (!stage) return 'Unknown'
  return stage.charAt(0).toUpperCase() + stage.slice(1)
}

function formatStageTone(stage: string | null) {
  const key = (stage ?? '').toLowerCase()
  const styles: Record<string, { bg: string; color: string }> = {
    prospecting: { bg: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
    qualified: { bg: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    proposal: { bg: 'rgba(168,85,247,0.18)', color: '#d8b4fe' },
    negotiation: { bg: 'rgba(245,158,11,0.18)', color: '#fcd34d' },
    won: { bg: 'rgba(34,197,94,0.16)', color: '#86efac' },
    lost: { bg: 'rgba(239,68,68,0.18)', color: '#fca5a5' },
  }
  return styles[key] ?? styles.prospecting
}

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ edit?: string; customize?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = (await searchParams) ?? {}
  const isEditing = resolvedSearchParams.edit === '1'
  const isCustomizing = resolvedSearchParams.customize === '1'
  const { moneySettings } = await loadCompanyDisplaySettings()

  const [opportunity, activities, customization, items, stageOptions] = await Promise.all([
    prisma.opportunity.findUnique({
      where: { id },
      include: {
        quote: true,
        user: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
          },
        },
        lineItems: {
          orderBy: { createdAt: 'asc' },
          include: { item: true },
        },
        customer: {
          include: {
            contacts: { orderBy: { firstName: 'asc' } },
          },
        },
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
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-OPP-STAGE' }),
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

  const statusTone = formatStageTone(opportunity.stage)
  const stageSelectOptions = stageOptions.map((option) => ({ value: option.value, label: option.label }))
  const lineRows = opportunity.lineItems.map((line, index) => ({
    id: line.id,
    lineNumber: index + 1,
    itemId: line.item?.itemId ?? null,
    itemName: line.item?.name ?? null,
    description: line.description,
    quantity: line.quantity,
    unitPrice: toNumericValue(line.unitPrice, 0),
    lineTotal: toNumericValue(line.lineTotal, 0),
    notes: line.notes ?? null,
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
      displayValue: fmtCurrency(opportunity.amount, undefined, moneySettings),
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

  const headerSections = buildConfiguredTransactionSections({
    fields: OPPORTUNITY_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions: opportunityPageConfig.sectionDescriptions,
  })
  const visibleStatIds = customization.statCards.filter((slot) => slot.visible).map((slot) => slot.metric)
  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: OPPORTUNITY_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
  })
  const visibleLineColumns = getOrderedVisibleTransactionLineColumns(OPPORTUNITY_LINE_COLUMNS, customization)
  const glImpactRows: InvoiceGlImpactRow[] = []

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
      headerCenter={!isCustomizing && !isEditing ? <OpportunityCreateQuoteButton opportunityId={opportunity.id} existingQuoteId={opportunity.quote?.id} /> : null}
      actions={
        isCustomizing ? null : (
          <TransactionActionStack
            mode={isEditing ? 'edit' : 'detail'}
            cancelHref={detailHref}
            formId={`inline-record-form-${opportunity.id}`}
            recordId={opportunity.id}
            primaryActions={
              !isEditing ? (
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
              ) : null
            }
          />
        )
      }
    >
      <TransactionDetailFrame
        stats={
          <TransactionStatsRow
            record={{
              amount: toNumericValue(opportunity.amount, 0),
              closeDate: opportunity.closeDate,
              lineCount: lineRows.length,
              quoteNumber: opportunity.quote?.number ?? null,
              quoteHref: opportunity.quote ? `/quotes/${opportunity.quote.id}` : null,
              stageLabel: formatStage(opportunity.stage),
              stageTone:
                opportunity.stage === 'won'
                  ? 'green'
                  : opportunity.stage === 'lost'
                    ? 'red'
                    : opportunity.stage === 'negotiation'
                      ? 'yellow'
                      : opportunity.stage === 'qualified'
                        ? 'accent'
                        : 'default',
              moneySettings,
            }}
            stats={opportunityPageConfig.stats}
            visibleStatIds={visibleStatIds}
          />
        }
        header={
          isCustomizing ? (
            <div className="mb-7">
              <OpportunityDetailCustomizeMode
                detailHref={detailHref}
                initialLayout={customization}
                fields={customizeFields}
                sectionDescriptions={opportunityPageConfig.sectionDescriptions}
              />
            </div>
          ) : (
            <PurchaseOrderHeaderSections
              purchaseOrderId={opportunity.id}
              editing={isEditing}
              sections={headerSections}
              columns={customization.formColumns}
              updateUrl={`/api/opportunities?id=${encodeURIComponent(opportunity.id)}`}
            />
          )
        }
        lineItems={
          <div>
            {isEditing ? (
              <OpportunityLineItemForm
                opportunityId={opportunity.id}
                items={items.map((item) => ({ ...item, listPrice: toNumericValue(item.listPrice, 0) }))}
              />
            ) : null}
            <PurchaseOrderLineItemsSection
              rows={lineRows.map((row, index) => ({
                id: row.id,
                displayOrder: index,
                itemRecordId: opportunity.lineItems[index]?.item?.id ?? null,
                itemId: row.itemId,
                itemName: row.itemName,
                description: row.description,
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
              sectionTitle="Opportunity Line Items"
              lineItemApiBasePath="/api/opportunities/line-items"
              deleteResource="opportunities/line-items"
              parentIdFieldName="opportunityId"
              tableId="opportunity-line-items"
              allowAddLines={isEditing}
            />
          </div>
        }
        relatedDocuments={
          <RecordDetailSection
            title="Related Documents"
            count={opportunity.quote ? 1 : 0}
            summary={opportunity.quote ? 'Generated quote' : undefined}
            collapsible
          >
            {!opportunity.quote ? (
              <RecordDetailEmptyState message="No related documents yet." />
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr>
                    <RecordDetailHeaderCell>Quote</RecordDetailHeaderCell>
                    <RecordDetailHeaderCell>Status</RecordDetailHeaderCell>
                    <RecordDetailHeaderCell className="text-right">Total</RecordDetailHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <RecordDetailCell>
                      <Link href={`/quotes/${opportunity.quote.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {opportunity.quote.number}
                      </Link>
                    </RecordDetailCell>
                    <RecordDetailCell>{opportunity.quote.status ?? '-'}</RecordDetailCell>
                    <RecordDetailCell className="text-right">{fmtCurrency(opportunity.quote.total, undefined, moneySettings)}</RecordDetailCell>
                  </tr>
                </tbody>
              </table>
            )}
          </RecordDetailSection>
        }
        supplementarySections={[
          opportunity.customer.contacts.length > 0 ? (
            <RecordDetailSection
              title="Customer Contacts"
              count={opportunity.customer.contacts.length}
              summary={`${opportunity.customer.contacts.length} contacts`}
              collapsible
            >
              <table className="min-w-full">
                <thead>
                  <tr>
                    <RecordDetailHeaderCell>Contact #</RecordDetailHeaderCell>
                    <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                    <RecordDetailHeaderCell>Email</RecordDetailHeaderCell>
                    <RecordDetailHeaderCell>Position</RecordDetailHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {opportunity.customer.contacts.map((contact, index) => (
                    <tr
                      key={contact.id}
                      style={index < opportunity.customer.contacts.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
                    >
                      <RecordDetailCell>
                        <Link href={`/contacts/${contact.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                          {contact.contactNumber ?? 'Pending'}
                        </Link>
                      </RecordDetailCell>
                      <RecordDetailCell>{contact.firstName} {contact.lastName}</RecordDetailCell>
                      <RecordDetailCell>{contact.email ?? '-'}</RecordDetailCell>
                      <RecordDetailCell>{contact.position ?? '-'}</RecordDetailCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </RecordDetailSection>
          ) : null,
          <InvoiceGlImpactSection key="gl-impact" rows={glImpactRows} />,
        ]}
        communications={
          <CommunicationsSection
            rows={communications}
            compose={buildTransactionCommunicationComposePayload({
              recordId: opportunity.id,
              userId: opportunity.userId,
              number: opportunity.opportunityNumber ?? opportunity.name,
              counterpartyName: opportunity.customer.name,
              counterpartyEmail: opportunity.customer.email ?? null,
              fromEmail: opportunity.user?.email ?? null,
              status: formatStage(opportunity.stage),
              total: fmtCurrency(opportunity.amount, undefined, moneySettings),
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
        }
        systemNotes={<SystemNotesSection notes={systemNotes} />}
      />
    </RecordDetailPageShell>
  )
}
