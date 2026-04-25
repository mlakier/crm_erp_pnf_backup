import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import MasterDataPageHeader from '@/components/MasterDataPageHeader'
import MasterDataListSection from '@/components/MasterDataListSection'
import { MasterDataBodyCell, MasterDataEmptyStateRow, MasterDataHeaderCell, MasterDataMutedCell } from '@/components/MasterDataTableCells'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { MASTER_DATA_TABLE_DIVIDER_STYLE, getMasterDataRowStyle } from '@/lib/master-data-table'
import { formatMasterDataDate } from '@/lib/master-data-display'
import { loadCompanyPageLogo } from '@/lib/company-page-logo'
import { accountingPeriodListDefinition } from '@/lib/master-data-list-definitions'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'
import { DEFAULT_RECORD_LIST_SORT } from '@/lib/record-list-sort'
import { loadListValues } from '@/lib/load-list-values'

function yesNo(value: boolean) {
  return value ? 'Yes' : 'No'
}

function formatStatusLabel(
  value: string,
  options: Array<{ value: string; label: string }>,
) {
  return options.find((option) => option.value === value)?.label ?? value
}

export default async function AccountingPeriodsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const sort = params.sort ?? DEFAULT_RECORD_LIST_SORT

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { status: { contains: query, mode: 'insensitive' as const } },
          { subsidiary: { is: { subsidiaryId: { contains: query, mode: 'insensitive' as const } } } },
          { subsidiary: { is: { name: { contains: query, mode: 'insensitive' as const } } } },
        ],
      }
    : {}

  const total = await prisma.accountingPeriod.count({ where })
  const pagination = getPagination(total, params.page)
  const [periods, subsidiaries, companyLogoPages, statusValues] = await Promise.all([
    prisma.accountingPeriod.findMany({
      where,
      include: { subsidiary: true, _count: { select: { journalEntries: true } } },
      orderBy:
        sort === 'id'
          ? [{ name: 'asc' as const }, { createdAt: 'desc' as const }]
          : sort === 'oldest'
            ? [{ createdAt: 'asc' as const }]
            : sort === 'name'
              ? [{ name: 'asc' as const }]
              : [{ createdAt: 'desc' as const }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    loadCompanyPageLogo(),
    loadListValues('ACCOUNTING-PERIOD-STATUS'),
  ])

  const subsidiaryOptions = subsidiaries.map((subsidiary) => ({
    value: subsidiary.id,
    label: `${subsidiary.subsidiaryId} - ${subsidiary.name}`,
  }))
  const statusOptions = statusValues.map((value) => ({
    value: value.toLowerCase(),
    label: value,
  }))

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (sort) s.set('sort', sort)
    s.set('page', String(p))
    return `/accounting-periods?${s.toString()}`
  }

  return (
    <div className="min-h-full px-8 py-8">
      <MasterDataPageHeader
        title="Accounting Periods"
        total={total}
        logoUrl={companyLogoPages?.url}
        actions={
          <Link
            href="/accounting-periods/new"
            className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-base font-semibold transition"
            style={{ backgroundColor: 'var(--accent-primary-strong)', color: '#ffffff' }}
          >
            <span className="mr-1.5 text-lg leading-none">+</span>
            New Accounting Period
          </Link>
        }
      />

      <MasterDataListSection
        query={params.q}
        searchPlaceholder={accountingPeriodListDefinition.searchPlaceholder}
        tableId={accountingPeriodListDefinition.tableId}
        exportFileName={accountingPeriodListDefinition.exportFileName}
        exportAllUrl={buildMasterDataExportUrl('accounting-periods', params.q, sort)}
        columns={accountingPeriodListDefinition.columns}
        sort={sort}
        sortOptions={accountingPeriodListDefinition.sortOptions}
      >
        <table className="min-w-full" id={accountingPeriodListDefinition.tableId}>
          <thead>
            <tr style={MASTER_DATA_TABLE_DIVIDER_STYLE}>
              <MasterDataHeaderCell columnId="name">Name</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="start-date">Start Date</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="end-date">End Date</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="subsidiary">Subsidiary</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="status">Status</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="closed">Closed</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="ar-locked">AR Locked</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="ap-locked">AP Locked</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="inventory-locked">Inventory Locked</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="closed-at">Closed At</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="created">Created</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="last-modified">Last Modified</MasterDataHeaderCell>
              <MasterDataHeaderCell columnId="actions">Actions</MasterDataHeaderCell>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 ? (
              <MasterDataEmptyStateRow colSpan={13}>No accounting periods found</MasterDataEmptyStateRow>
            ) : (
              periods.map((period, index) => (
                <tr key={period.id} style={getMasterDataRowStyle(index, periods.length)}>
                  <MasterDataBodyCell columnId="name" className="px-4 py-2 text-sm font-medium text-white">
                    <Link href={`/accounting-periods/${period.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                      {period.name}
                    </Link>
                  </MasterDataBodyCell>
                  <MasterDataMutedCell columnId="start-date">{formatMasterDataDate(period.startDate)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="end-date">{formatMasterDataDate(period.endDate)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="subsidiary">{period.subsidiary ? `${period.subsidiary.subsidiaryId} - ${period.subsidiary.name}` : '-'}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="status">{formatStatusLabel(period.status, statusOptions)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="closed">{yesNo(period.closed)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="ar-locked">{yesNo(period.arLocked)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="ap-locked">{yesNo(period.apLocked)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="inventory-locked">{yesNo(period.inventoryLocked)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="closed-at">{formatMasterDataDate(period.closedAt)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="created">{formatMasterDataDate(period.createdAt)}</MasterDataMutedCell>
                  <MasterDataMutedCell columnId="last-modified">{formatMasterDataDate(period.updatedAt)}</MasterDataMutedCell>
                  <MasterDataBodyCell columnId="actions">
                    <div className="flex items-center gap-2">
                      <EditButton
                        resource="accounting-periods"
                        id={period.id}
                        fields={[
                          { name: 'name', label: 'Name', value: period.name },
                          { name: 'startDate', label: 'Start Date', value: new Date(period.startDate).toISOString().slice(0, 10), type: 'date' },
                          { name: 'endDate', label: 'End Date', value: new Date(period.endDate).toISOString().slice(0, 10), type: 'date' },
                          { name: 'subsidiaryId', label: 'Subsidiary', value: period.subsidiaryId ?? '', type: 'select', options: subsidiaryOptions, placeholder: 'None' },
                          { name: 'status', label: 'Status', value: period.status, type: 'select', options: statusOptions },
                          { name: 'closed', label: 'Closed', value: String(period.closed), type: 'checkbox', placeholder: 'Closed' },
                          { name: 'arLocked', label: 'AR Locked', value: String(period.arLocked), type: 'checkbox', placeholder: 'AR Locked' },
                          { name: 'apLocked', label: 'AP Locked', value: String(period.apLocked), type: 'checkbox', placeholder: 'AP Locked' },
                          { name: 'inventoryLocked', label: 'Inventory Locked', value: String(period.inventoryLocked), type: 'checkbox', placeholder: 'Inventory Locked' },
                        ]}
                      />
                      <DeleteButton resource="accounting-periods" id={period.id} label={period.name} />
                    </div>
                  </MasterDataBodyCell>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <PaginationFooter
          startRow={pagination.startRow}
          endRow={pagination.endRow}
          total={total}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          hasPrevPage={pagination.hasPrevPage}
          hasNextPage={pagination.hasNextPage}
          prevHref={buildPageHref(pagination.currentPage - 1)}
          nextHref={buildPageHref(pagination.currentPage + 1)}
        />
      </MasterDataListSection>
    </div>
  )
}
