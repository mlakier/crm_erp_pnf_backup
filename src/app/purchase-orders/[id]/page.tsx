import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtPhone } from '@/lib/format'
import PurchaseOrderDetailCustomizeMode from '@/components/PurchaseOrderDetailCustomizeMode'
import PurchaseOrderDetailExportButton from '@/components/PurchaseOrderDetailExportButton'
import PurchaseOrderGlImpactSection from '@/components/PurchaseOrderGlImpactSection'
import PurchaseOrderHeaderSections, {
  type PurchaseOrderHeaderField,
} from '@/components/PurchaseOrderHeaderSections'
import PurchaseOrderLineItemsSection from '@/components/PurchaseOrderLineItemsSection'
import PurchaseOrderPageActions from '@/components/PurchaseOrderPageActions'
import PurchaseOrderRelatedDocuments from '@/components/PurchaseOrderRelatedDocuments'
import CommunicationsSection from '@/components/CommunicationsSection'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import { parseCommunicationSummary, parseFieldChangeSummary } from '@/lib/activity'
import {
  PURCHASE_ORDER_DETAIL_FIELDS,
  PURCHASE_ORDER_LINE_COLUMNS,
  type PurchaseOrderDetailFieldKey,
} from '@/lib/purchase-order-detail-customization'
import { loadPurchaseOrderDetailCustomization } from '@/lib/purchase-order-detail-customization-store'
import { buildReceiptDisplayNumberMap } from '@/lib/receipt-display-number'
import {
  buildConfiguredTransactionSections,
  buildTransactionCustomizePreviewFields,
  buildTransactionExportHeaderFields,
  getOrderedVisibleTransactionLineColumns,
} from '@/lib/transaction-detail-helpers'

const PURCHASE_ORDER_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
]

const SYSTEM_NOTE_CURRENCY_FIELDS = new Set(['Total', 'Unit Price', 'Line Total'])
type PurchaseOrderDetailHeaderField = PurchaseOrderHeaderField & { key: PurchaseOrderDetailFieldKey }

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string; customize?: string }>
}) {
  const { id } = await params
  const { edit, customize } = await searchParams
  const isEditing = edit === '1'
  const isCustomizing = customize === '1'

  const [po, vendors, subsidiaries, items, allReceiptIds, activities, customization] = await Promise.all([
    prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        subsidiary: true,
        currency: true,
        user: {
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
          },
        },
        lineItems: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            item: {
              select: { id: true, itemId: true, name: true, listPrice: true },
            },
          },
        },
        vendor: {
          include: {
            subsidiary: true,
            currency: true,
          },
        },
        receipts: { orderBy: { date: 'desc' } },
        requisition: true,
        bills: {
          orderBy: { date: 'desc' },
          include: {
            lineItems: {
              select: {
                id: true,
                quantity: true,
              },
            },
            billPayments: {
              orderBy: { date: 'desc' },
            },
          },
        },
      },
    }),
    prisma.vendor.findMany({
      orderBy: { vendorNumber: 'asc' },
      select: {
        id: true,
        vendorNumber: true,
        name: true,
        subsidiaryId: true,
        currencyId: true,
        inactive: true,
      },
    }),
    prisma.subsidiary.findMany({
      orderBy: { subsidiaryId: 'asc' },
      select: { id: true, subsidiaryId: true, name: true },
    }),
    prisma.item.findMany({
      orderBy: [{ itemId: 'asc' }, { name: 'asc' }],
      select: { id: true, itemId: true, name: true, listPrice: true },
    }),
    prisma.receipt.findMany({
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.activity.findMany({
      where: {
        entityType: 'purchase-order',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    }),
    loadPurchaseOrderDetailCustomization(),
  ])

  if (!po) notFound()

  const receivedQuantity = po.receipts.reduce((sum, receipt) => sum + receipt.quantity, 0)
  const billedQuantity = po.bills.reduce(
    (sum, bill) => sum + bill.lineItems.reduce((lineSum, lineItem) => lineSum + lineItem.quantity, 0),
    0
  )
  const detailHref = `/purchase-orders/${po.id}`
  const receiptNumberMap = buildReceiptDisplayNumberMap(allReceiptIds)
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
      user.userId && user.name
        ? `${user.userId} - ${user.name}`
        : user.userId ?? user.name ?? user.email,
    ])
  )
  const approvedStatusActivity = activities.find((activity) => {
    const parsed = parseFieldChangeSummary(activity.summary)
    return (
      parsed?.fieldName === 'Status' &&
      parsed.newValue.toLowerCase() === 'approved'
    )
  })
  const approvedByLabel = approvedStatusActivity?.userId
    ? activityUserLabelById.get(approvedStatusActivity.userId) ?? approvedStatusActivity.userId
    : ''
  const systemNotes = activities
    .map((activity) => {
      const parsed = parseFieldChangeSummary(activity.summary)
      if (!parsed) return null

      return {
        id: activity.id,
          date: new Date(activity.createdAt).toLocaleString(),
          setBy: activity.userId ? activityUserLabelById.get(activity.userId) ?? activity.userId : 'System',
          context: parsed.context,
          fieldName: parsed.fieldName,
          oldValue: formatSystemNoteValue(parsed.fieldName, parsed.oldValue),
          newValue: formatSystemNoteValue(parsed.fieldName, parsed.newValue),
        }
      })
      .filter((note): note is Exclude<typeof note, null> => Boolean(note))
  const communications = activities
    .map((activity) => {
      const parsed = parseCommunicationSummary(activity.summary)
      if (!parsed) return null

      return {
        id: activity.id,
        date: new Date(activity.createdAt).toLocaleString(),
        direction: parsed.direction || '-',
        channel: parsed.channel || '-',
        subject: parsed.subject || '-',
        from: parsed.from || '-',
        to: parsed.to || '-',
        status: parsed.status || '-',
      }
    })
    .filter((communication): communication is Exclude<typeof communication, null> => Boolean(communication))
  const derivedLineRows = po.lineItems.reduce<Array<{
    id: string
    displayOrder: number
    itemRecordId: string | null
    itemId: string | null
    itemName: string | null
    description: string
    quantity: number
    receivedQuantity: number
    billedQuantity: number
    openQuantity: number
    unitPrice: number
    lineTotal: number
  }>>((acc, item) => {
    const allocatedReceived = acc.reduce((sum, row) => sum + row.receivedQuantity, 0)
    const remainingReceived = Math.max(0, receivedQuantity - allocatedReceived)
    const lineReceivedQuantity = Math.min(item.quantity, remainingReceived)
    const allocatedBilled = acc.reduce((sum, row) => sum + row.billedQuantity, 0)
    const remainingBilled = Math.max(0, billedQuantity - allocatedBilled)
    const lineBilledQuantity = Math.min(item.quantity, remainingBilled)

    acc.push({
      id: item.id,
      displayOrder: item.displayOrder,
      itemRecordId: item.item?.id ?? null,
      itemId: item.item?.itemId ?? null,
      itemName: item.item?.name ?? null,
      description: item.description,
      quantity: item.quantity,
      receivedQuantity: lineReceivedQuantity,
      billedQuantity: lineBilledQuantity,
      openQuantity: Math.max(0, item.quantity - lineReceivedQuantity),
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })

    return acc
  }, [])
  const computedTotal = derivedLineRows.reduce((sum, row) => sum + row.lineTotal, 0)
  const glSourceRefs = [
    { sourceType: 'purchase-order', sourceId: po.id, sourceNumber: po.number },
    ...po.receipts.map((receipt) => ({
      sourceType: 'receipt',
      sourceId: receipt.id,
      sourceNumber: receiptNumberMap.get(receipt.id) ?? receipt.id,
    })),
    ...po.bills.map((bill) => ({
      sourceType: 'bill',
      sourceId: bill.id,
      sourceNumber: bill.number,
    })),
    ...po.bills.flatMap((bill) =>
      bill.billPayments.map((payment) => ({
        sourceType: 'bill-payment',
        sourceId: payment.id,
        sourceNumber: payment.number,
      }))
    ),
  ]
  const glImpactEntries = glSourceRefs.length
    ? await prisma.journalEntry.findMany({
        where: {
          OR: glSourceRefs.map((ref) => ({
            sourceType: ref.sourceType,
            sourceId: ref.sourceId,
          })),
        },
        include: {
          lineItems: {
            include: {
              account: {
                select: { accountId: true, name: true },
              },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      })
    : []
  const glSourceNumberByKey = new Map(
    glSourceRefs.map((ref) => [`${ref.sourceType}:${ref.sourceId}`, ref.sourceNumber])
  )
  const glImpactRows = glImpactEntries.flatMap((entry) =>
    entry.lineItems.map((line) => ({
      id: line.id,
      journalNumber: entry.number,
      date: new Date(entry.date).toLocaleDateString(),
      sourceType: formatSourceType(entry.sourceType),
      sourceNumber: glSourceNumberByKey.get(`${entry.sourceType}:${entry.sourceId}`) ?? entry.sourceId ?? '-',
      account: `${line.account.accountId} - ${line.account.name}`,
      description: line.description ?? line.memo ?? entry.description ?? '-',
      debit: line.debit,
      credit: line.credit,
    }))
  )

  const sectionDescriptions: Record<string, string> = {
    Vendor: 'Supplier master data linked to this purchase order.',
    'Purchase Order Details': 'Core purchase order fields and procurement lifecycle status.',
  }

  const vendorOptions = vendors.map((vendor) => ({
    value: vendor.id,
    label: `${vendor.vendorNumber} - ${vendor.name}`,
  }))
  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))

  const headerFieldDefinitions: Record<PurchaseOrderDetailFieldKey, PurchaseOrderDetailHeaderField> = {
    vendorName: {
      key: 'vendorName',
      label: 'Vendor Name',
      value: po.vendor.name,
      helpText: 'Display name from the linked vendor record.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
    },
    vendorNumber: {
      key: 'vendorNumber',
      label: 'Vendor #',
      value: po.vendor.vendorNumber ?? '',
      displayValue:
        po.vendor.vendorNumber != null ? (
          <Link href={`/vendors/${po.vendor.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
            {po.vendor.vendorNumber}
          </Link>
        ) : (
          '-'
        ),
      helpText: 'Internal vendor identifier from the linked vendor record.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
    },
    vendorEmail: {
      key: 'vendorEmail',
      label: 'Email',
      value: po.vendor.email ?? '',
      helpText: 'Primary vendor email address.',
      fieldType: 'email',
      sourceText: 'Vendors master data',
    },
    vendorPhone: {
      key: 'vendorPhone',
      label: 'Phone',
      value: fmtPhone(po.vendor.phone),
      helpText: 'Primary vendor phone number.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
    },
    vendorTaxId: {
      key: 'vendorTaxId',
      label: 'Tax ID',
      value: po.vendor.taxId ?? '',
      helpText: 'Vendor tax registration or identification number.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
    },
    vendorAddress: {
      key: 'vendorAddress',
      label: 'Address',
      value: po.vendor.address ?? '',
      helpText: 'Mailing or remittance address from the linked vendor record.',
      fieldType: 'text',
      sourceText: 'Vendors master data',
    },
    vendorPrimarySubsidiary: {
      key: 'vendorPrimarySubsidiary',
      label: 'Primary Subsidiary',
      value: po.vendor.subsidiary ? `${po.vendor.subsidiary.subsidiaryId} - ${po.vendor.subsidiary.name}` : '',
      helpText: 'Default subsidiary context from the linked vendor record.',
      fieldType: 'list',
      sourceText: 'Vendors master data',
    },
    vendorPrimaryCurrency: {
      key: 'vendorPrimaryCurrency',
      label: 'Primary Currency',
      value: po.vendor.currency ? `${po.vendor.currency.code} - ${po.vendor.currency.name}` : '',
      helpText: 'Default transaction currency from the linked vendor record.',
      fieldType: 'list',
      sourceText: 'Vendors master data',
    },
    vendorInactive: {
      key: 'vendorInactive',
      label: 'Inactive',
      value: po.vendor.inactive ? 'Yes' : 'No',
      helpText: 'Indicates whether the linked vendor is inactive for new activity.',
      fieldType: 'checkbox',
      sourceText: 'Vendors master data',
    },
    number: {
      key: 'number',
      label: 'Purchase Order Id',
      value: po.number,
      editable: true,
      type: 'text',
      helpText: 'Unique purchase order number used across procurement workflows.',
      fieldType: 'text',
    },
    createdBy: {
      key: 'createdBy',
      label: 'Created By',
      value: po.user?.userId ?? po.user?.name ?? po.user?.email ?? '',
      displayValue:
        po.user?.userId && po.user?.name
          ? `${po.user.userId} - ${po.user.name}`
          : po.user?.userId ?? po.user?.name ?? po.user?.email ?? '-',
      helpText: 'User who created the purchase order.',
      fieldType: 'text',
      sourceText: 'Users master data',
    },
    createdFrom: {
      key: 'createdFrom',
      label: 'Created From',
      value: po.requisition?.number ?? '',
      displayValue: po.requisition ? (
        <Link href={`/purchase-requisitions/${po.requisition.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {po.requisition.number}
        </Link>
      ) : (
        '-'
      ),
      helpText: 'Source transaction that created this purchase order.',
      fieldType: 'text',
      sourceText: 'Source transaction',
    },
    approvedBy: {
      key: 'approvedBy',
      label: 'Approved By',
      value: approvedByLabel,
      displayValue: approvedByLabel || '-',
      helpText: 'User who approved the purchase order based on the approval activity trail.',
      fieldType: 'text',
      sourceText: 'System Notes / activity history',
    },
    subsidiaryId: {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: po.subsidiaryId ?? '',
      editable: true,
      type: 'select',
      options: [{ value: '', label: 'None' }, ...subsidiaryOptions],
      helpText: 'Legal Subsidiary or subsidiary that owns the purchase order.',
      fieldType: 'list',
      sourceText: 'Subsidiaries master data',
    },
    vendorId: {
      key: 'vendorId',
      label: 'Vendor',
      value: po.vendorId,
      editable: true,
      type: 'select',
      options: vendorOptions,
      helpText: 'Vendor record linked to this purchase order.',
      fieldType: 'list',
      sourceText: 'Vendors master data',
    },
    status: {
      key: 'status',
      label: 'Status',
      value: po.status ?? '',
      editable: true,
      type: 'select',
      options: PURCHASE_ORDER_STATUS_OPTIONS,
      helpText: 'Current lifecycle stage of the purchase order.',
      fieldType: 'list',
      sourceText: 'System purchase order statuses',
    },
    total: {
      key: 'total',
      label: 'Total',
      value: computedTotal.toString(),
      displayValue: fmtCurrency(computedTotal),
      helpText: 'Current document total based on all purchase order line amounts.',
      fieldType: 'currency',
    },
  }

  const headerSections = buildConfiguredTransactionSections({
    fields: PURCHASE_ORDER_DETAIL_FIELDS,
    layout: customization,
    fieldDefinitions: headerFieldDefinitions,
    sectionDescriptions,
  })

  const customizeFields = buildTransactionCustomizePreviewFields({
    fields: PURCHASE_ORDER_DETAIL_FIELDS,
    fieldDefinitions: headerFieldDefinitions,
    previewOverrides: {
      vendorId: vendorOptions.find((option) => option.value === po.vendorId)?.label ?? po.vendor.name,
      status:
        PURCHASE_ORDER_STATUS_OPTIONS.find((option) => option.value === (po.status ?? ''))?.label ??
        (po.status ?? ''),
      createdBy:
        po.user?.userId && po.user?.name
          ? `${po.user.userId} - ${po.user.name}`
          : po.user?.userId ?? po.user?.name ?? po.user?.email ?? '',
      createdFrom: po.requisition?.number ?? '',
      approvedBy: approvedByLabel,
      subsidiaryId: po.subsidiary ? `${po.subsidiary.subsidiaryId} - ${po.subsidiary.name}` : '',
      total: fmtCurrency(computedTotal),
      vendorPrimarySubsidiary: po.vendor.subsidiary ? `${po.vendor.subsidiary.subsidiaryId} - ${po.vendor.subsidiary.name}` : '',
      vendorPrimaryCurrency: po.vendor.currency ? `${po.vendor.currency.code} - ${po.vendor.currency.name}` : '',
      vendorInactive: po.vendor.inactive ? 'Yes' : 'No',
    },
  })

  const exportHeaderFields = buildTransactionExportHeaderFields<PurchaseOrderDetailFieldKey, PurchaseOrderDetailHeaderField>(headerSections, {
    total: () => fmtCurrency(computedTotal),
  })

  const orderedVisibleLineColumns = getOrderedVisibleTransactionLineColumns(
    PURCHASE_ORDER_LINE_COLUMNS,
    customization
  )

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/purchase-orders'}
      backLabel={isCustomizing ? '<- Back to Purchase Order Detail' : '<- Back to Purchase Orders'}
      meta={po.number}
      title={po.vendor.name}
      badge={
        <div className="flex flex-wrap gap-2">
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm"
            style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
          >
            Purchase Order
          </span>
          <StatusBadge status={po.status} />
        </div>
      }
      widthClassName="w-full max-w-none"
      actions={
        isCustomizing ? null : (
          <>
            <PurchaseOrderDetailExportButton
              number={po.number}
              vendorName={po.vendor.name}
              vendorEmail={po.vendor.email ?? null}
              status={po.status ? po.status.charAt(0).toUpperCase() + po.status.slice(1).toLowerCase() : 'Unknown'}
              total={fmtCurrency(computedTotal)}
              headerFields={exportHeaderFields}
              headerMap={{
                purchaseOrderNumber: po.number,
                vendorNumber: po.vendor.vendorNumber ?? '',
                vendorName: po.vendor.name,
                subsidiary: po.subsidiary ? `${po.subsidiary.subsidiaryId} - ${po.subsidiary.name}` : '',
                status: po.status ? po.status.charAt(0).toUpperCase() + po.status.slice(1).toLowerCase() : 'Unknown',
                total: fmtCurrency(computedTotal),
                createdBy:
                  po.user?.userId && po.user?.name
                    ? `${po.user.userId} - ${po.user.name}`
                    : po.user?.userId ?? po.user?.name ?? po.user?.email ?? '',
                createdFrom: po.requisition?.number ?? '',
                approvedBy: approvedByLabel,
              }}
              lineItems={derivedLineRows.map((row, index) => ({
                line: index + 1,
                itemId: row.itemId ?? '-',
                itemName: row.itemName ?? '-',
                description: row.description,
                quantity: row.quantity,
                receivedQuantity: row.receivedQuantity,
                openQuantity: row.openQuantity,
                billedQuantity: row.billedQuantity,
                unitPrice: row.unitPrice,
                lineTotal: row.lineTotal,
              }))}
            />
            {!isEditing ? (
              <Link
                href={`${detailHref}?customize=1`}
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                Customize
              </Link>
            ) : null}
            <PurchaseOrderPageActions purchaseOrderId={po.id} detailHref={detailHref} editing={isEditing} />
          </>
        )
      }
    >
      {isCustomizing ? (
        <PurchaseOrderDetailCustomizeMode
          detailHref={detailHref}
          initialLayout={customization}
          fields={customizeFields}
          sectionDescriptions={sectionDescriptions}
        />
      ) : (
        <PurchaseOrderHeaderSections
          purchaseOrderId={po.id}
          editing={isEditing}
          sections={headerSections}
          columns={customization.formColumns}
        />
      )}

      <PurchaseOrderLineItemsSection
        editing={isEditing}
        rows={derivedLineRows}
        purchaseOrderId={po.id}
        userId={po.userId}
        lineColumns={orderedVisibleLineColumns}
        itemOptions={items.map((item) => ({
          id: item.id,
          itemId: item.itemId ?? 'Pending',
          name: item.name,
          unitPrice: item.listPrice ?? 0,
          itemDrivenValues: {
            description: item.name,
            unitPrice: String(item.listPrice ?? 0),
          },
        }))}
      />

      <PurchaseOrderRelatedDocuments
        requisitions={
          po.requisition
            ? [
                {
                  id: po.requisition.id,
                  number: po.requisition.number,
                  status: po.requisition.status,
                  total: po.requisition.total,
                  title: po.requisition.title ?? null,
                  priority: po.requisition.priority ?? null,
                  createdAt: po.requisition.createdAt.toISOString(),
                },
              ]
            : []
        }
        receipts={po.receipts.map((receipt) => ({
          id: receipt.id,
          number: receiptNumberMap.get(receipt.id) ?? receipt.id,
          date: receipt.date.toISOString(),
          status: receipt.status,
          quantity: receipt.quantity,
          createdAt: receipt.createdAt.toISOString(),
          notes: receipt.notes ?? null,
        }))}
        bills={po.bills.map((bill) => ({
          id: bill.id,
          number: bill.number,
          status: bill.status,
          total: bill.total,
          date: bill.date.toISOString(),
          dueDate: bill.dueDate ? bill.dueDate.toISOString() : null,
          notes: bill.notes ?? null,
        }))}
        billPayments={po.bills.flatMap((bill) =>
          bill.billPayments.map((payment) => ({
            id: payment.id,
            number: payment.number,
            amount: payment.amount,
            date: payment.date.toISOString(),
            method: payment.method ?? null,
            status: payment.status,
            billNumber: bill.number,
            reference: payment.reference ?? null,
          }))
        )}
      />

      <PurchaseOrderGlImpactSection rows={glImpactRows} />

      <CommunicationsSection
        rows={communications}
        compose={{
          purchaseOrderId: po.id,
          userId: po.userId,
          number: po.number,
          vendorName: po.vendor.name,
          vendorEmail: po.vendor.email ?? null,
          fromEmail: po.user?.email ?? null,
          status: po.status ?? 'Draft',
          total: fmtCurrency(computedTotal),
          lineItems: derivedLineRows.map((row, index) => ({
            line: index + 1,
            itemId: row.itemId ?? '-',
            description: row.description,
            quantity: row.quantity,
            receivedQuantity: row.receivedQuantity,
            openQuantity: row.openQuantity,
            billedQuantity: row.billedQuantity,
            unitPrice: row.unitPrice,
            lineTotal: row.lineTotal,
          })),
        }}
      />

      <SystemNotesSection notes={systemNotes} />
    </RecordDetailPageShell>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const key = (status ?? '').toLowerCase()
  const styles: Record<string, { backgroundColor: string; color: string }> = {
    draft: { backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
    pending: { backgroundColor: 'rgba(245,158,11,0.16)', color: '#fcd34d' },
    approved: { backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' },
    received: { backgroundColor: 'rgba(34,197,94,0.16)', color: '#86efac' },
    cancelled: { backgroundColor: 'rgba(239,68,68,0.18)', color: '#fca5a5' },
  }
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Unknown'
  return (
    <span
      className="inline-block rounded-full px-3 py-0.5 text-sm font-medium"
      style={styles[key] ?? { backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}
    >
      {label}
    </span>
  )
}

function formatSourceType(value: string | null | undefined) {
  if (!value) return 'Unknown'
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatSystemNoteValue(fieldName: string, value: string | null | undefined) {
  if (!value || !value.trim()) return '-'

  if (SYSTEM_NOTE_CURRENCY_FIELDS.has(fieldName)) {
    const numericValue = Number(value)
    if (!Number.isNaN(numericValue)) {
      return fmtCurrency(numericValue)
    }
  }

  return value
}
