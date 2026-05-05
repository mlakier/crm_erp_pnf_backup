import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import RecordHeaderDetails, { type RecordHeaderField } from '@/components/RecordHeaderDetails'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import { formatGlAccountLabel } from '@/lib/gl-account-label'

export const runtime = 'nodejs'

function buildSourceHref(sourceTransactionType: string | null, sourceTransactionId: string | null) {
  if (!sourceTransactionType || !sourceTransactionId) return null

  const routeByType: Record<string, string> = {
    invoice: '/invoices',
    bill: '/bills',
    'invoice-receipt': '/invoice-receipts',
    'bill-payment': '/bill-payments',
    'customer-refund': '/customer-refunds',
    journal: '/journals',
  }

  const basePath = routeByType[sourceTransactionType]
  return basePath ? `${basePath}/${sourceTransactionId}` : null
}

export default async function OpenItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await connection()
  const { id } = await params
  const { moneySettings } = await loadCompanyDisplaySettings()

  const openItem = await prisma.openItem.findUnique({
    where: { id },
    include: {
      account: true,
    },
  })

  if (!openItem) notFound()

  const [subsidiary, counterparty, transactionCurrency, localCurrency, functionalCurrency, groupCurrency] =
    await Promise.all([
      openItem.subsidiaryId
        ? prisma.subsidiary.findUnique({ where: { id: openItem.subsidiaryId }, select: { id: true, name: true } })
        : Promise.resolve(null),
      openItem.counterpartyId && openItem.counterpartyType === 'customer'
        ? prisma.customer.findUnique({ where: { id: openItem.counterpartyId }, select: { id: true, name: true } })
        : openItem.counterpartyId && openItem.counterpartyType === 'vendor'
          ? prisma.vendor.findUnique({ where: { id: openItem.counterpartyId }, select: { id: true, name: true } })
          : openItem.counterpartyId && openItem.counterpartyType === 'employee'
            ? prisma.employee.findUnique({
                where: { id: openItem.counterpartyId },
                select: { id: true, firstName: true, lastName: true },
              }).then((employee) =>
                employee
                  ? {
                      id: employee.id,
                      name: [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.id,
                    }
                  : null,
              )
            : openItem.counterpartyId
              ? Promise.resolve({ id: openItem.counterpartyId, name: openItem.counterpartyId })
              : Promise.resolve(null),
      openItem.transactionCurrencyId
        ? prisma.currency.findUnique({ where: { id: openItem.transactionCurrencyId }, select: { id: true, code: true, currencyId: true } })
        : Promise.resolve(null),
      openItem.localCurrencyId
        ? prisma.currency.findUnique({ where: { id: openItem.localCurrencyId }, select: { id: true, code: true, currencyId: true } })
        : Promise.resolve(null),
      openItem.functionalCurrencyId
        ? prisma.currency.findUnique({ where: { id: openItem.functionalCurrencyId }, select: { id: true, code: true, currencyId: true } })
        : Promise.resolve(null),
      openItem.groupCurrencyId
        ? prisma.currency.findUnique({ where: { id: openItem.groupCurrencyId }, select: { id: true, code: true, currencyId: true } })
        : Promise.resolve(null),
    ])

  const sourceHref = buildSourceHref(openItem.sourceTransactionType, openItem.sourceTransactionId)
  const transactionCurrencyCode = transactionCurrency?.code ?? transactionCurrency?.currencyId ?? null
  const localCurrencyCode = localCurrency?.code ?? localCurrency?.currencyId ?? null
  const functionalCurrencyCode = functionalCurrency?.code ?? functionalCurrency?.currencyId ?? null
  const groupCurrencyCode = groupCurrency?.code ?? groupCurrency?.currencyId ?? null

  const fields: RecordHeaderField[] = [
    {
      key: 'openItemNumber',
      label: 'Open Item',
      value: openItem.openItemNumber,
      displayValue: openItem.openItemNumber,
      fieldType: 'text',
      column: 1,
      order: 0,
    },
    {
      key: 'status',
      label: 'Status',
      value: openItem.status,
      displayValue: openItem.status,
      fieldType: 'text',
      column: 2,
      order: 0,
    },
    {
      key: 'sourceTransactionType',
      label: 'Source Type',
      value: openItem.sourceTransactionType ?? '',
      displayValue: openItem.sourceTransactionType ?? '-',
      fieldType: 'text',
      column: 3,
      order: 0,
    },
    {
      key: 'sourceTransactionId',
      label: 'Source Transaction',
      value: openItem.sourceTransactionId ?? '',
      displayValue: openItem.sourceTransactionId ?? '-',
      href: sourceHref,
      fieldType: 'text',
      column: 4,
      order: 0,
    },
    {
      key: 'accountId',
      label: 'Account',
      value: openItem.accountId ?? '',
      displayValue: openItem.account ? formatGlAccountLabel(openItem.account) : '-',
      fieldType: 'text',
      column: 1,
      order: 1,
    },
    {
      key: 'subsidiaryId',
      label: 'Subsidiary',
      value: openItem.subsidiaryId ?? '',
      displayValue: subsidiary?.name ?? '-',
      fieldType: 'text',
      column: 2,
      order: 1,
    },
    {
      key: 'counterpartyId',
      label: 'Counterparty',
      value: openItem.counterpartyId ?? '',
      displayValue: counterparty?.name ?? '-',
      fieldType: 'text',
      column: 3,
      order: 1,
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      value: openItem.dueDate?.toISOString() ?? '',
      displayValue: openItem.dueDate ? fmtDocumentDate(openItem.dueDate, moneySettings) : '-',
      fieldType: 'date',
      column: 4,
      order: 1,
    },
    {
      key: 'transactionAmount',
      label: 'TXN Amount',
      value: String(openItem.originalTransactionAmount ?? ''),
      displayValue: fmtCurrency(openItem.originalTransactionAmount, transactionCurrencyCode ?? undefined, moneySettings),
      fieldType: 'currency',
      column: 1,
      order: 2,
    },
    {
      key: 'localAmount',
      label: 'Local Amount',
      value: String(openItem.originalLocalAmount ?? ''),
      displayValue:
        openItem.originalLocalAmount == null
          ? '-'
          : fmtCurrency(openItem.originalLocalAmount, localCurrencyCode ?? undefined, moneySettings),
      fieldType: 'currency',
      column: 2,
      order: 2,
    },
    {
      key: 'functionalAmount',
      label: 'Functional Amount',
      value: String(openItem.originalFunctionalAmount ?? ''),
      displayValue:
        openItem.originalFunctionalAmount == null
          ? '-'
          : fmtCurrency(openItem.originalFunctionalAmount, functionalCurrencyCode ?? undefined, moneySettings),
      fieldType: 'currency',
      column: 3,
      order: 2,
    },
    {
      key: 'groupAmount',
      label: 'Group Amount',
      value: String(openItem.originalGroupAmount ?? ''),
      displayValue:
        openItem.originalGroupAmount == null
          ? '-'
          : fmtCurrency(openItem.originalGroupAmount, groupCurrencyCode ?? undefined, moneySettings),
      fieldType: 'currency',
      column: 4,
      order: 2,
    },
  ]

  return (
    <RecordDetailPageShell
      backHref={sourceHref ?? '/record-to-report'}
      backLabel={sourceHref ? 'Back to Source Transaction' : 'Back to Record To Report'}
      meta="Open Item"
      title={openItem.openItemNumber}
    >
      {sourceHref ? (
        <div className="mb-4">
          <Link href={sourceHref} className="text-sm hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
            Open source transaction
          </Link>
        </div>
      ) : null}
      <RecordHeaderDetails
        editing={false}
        sections={[
          {
            title: 'Open Item Context',
            description: 'Posted open-item identity, source transaction, and multi-currency carrying amounts.',
            rows: 3,
            fields,
          },
        ]}
        columns={4}
      />
    </RecordDetailPageShell>
  )
}
