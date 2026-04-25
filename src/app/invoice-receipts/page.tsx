import type { Prisma } from '@prisma/client'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDocumentDate } from '@/lib/format'
import { loadCompanyDisplaySettings } from '@/lib/company-display-settings'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import DeleteButton from '@/components/DeleteButton'
import { RecordListHeaderLabel } from '@/components/RecordListHeaderLabel'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { loadListValues } from '@/lib/load-list-values'
import { buildMasterDataExportUrl } from '@/lib/master-data-export-url'

const IR_COLUMNS = [
  { id: 'invoice-receipt-id', label: 'Invoice Receipt Id' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'customer', label: 'Customer' },
  { id: 'amount', label: 'Amount' },
  { id: 'date', label: 'Date' },
  { id: 'method', label: 'Method' },
  { id: 'reference', label: 'Reference' },
  { id: 'db-id', label: 'DB Id' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function InvoiceReceiptsPage({ searchParams }: { searchParams: Promise<{ q?: string; method?: string; page?: string }> }) {
  const params = await searchParams
  const { moneySettings } = await loadCompanyDisplaySettings()
  const query = (params.q ?? '').trim()
  const methodFilter = params.method ?? 'all'

  const where: Prisma.CashReceiptWhereInput = {
    ...(query
      ? {
          OR: [
            { number: { contains: query } },
            { id: { contains: query } },
            { invoiceId: { contains: query } },
            { method: { contains: query } },
            { reference: { contains: query } },
            { invoice: { number: { contains: query } } },
          ],
        }
      : {}),
    ...(methodFilter !== 'all' ? { method: methodFilter } : {}),
  }
  const orderBy = [{ createdAt: 'desc' as const }]

  const [totalRows, companySettings, cabinetFiles, paymentMethodValues] = await Promise.all([
    prisma.cashReceipt.count({ where }),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
    loadListValues('PAYMENT-METHOD'),
  ])
  const methodOptions = ['all', ...paymentMethodValues.map((value) => value.toLowerCase())]

  const pagination = getPagination(totalRows, params.page)
  const rows = await prisma.cashReceipt.findMany({ where, include: { invoice: { include: { customer: true } } }, orderBy, skip: pagination.skip, take: pagination.pageSize })

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    if (methodFilter !== 'all') s.set('method', methodFilter)
    s.set('page', String(p))
    return '/invoice-receipts?' + s.toString()
  }

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages = cabinetFiles.find((f) => f.id === selectedLogoValue) ?? cabinetFiles.find((f) => f.originalName === selectedLogoValue) ?? cabinetFiles.find((f) => f.storedName === selectedLogoValue) ?? (!selectedLogoValue ? cabinetFiles[0] : undefined)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? <img src={companyLogoPages.url} alt="Company logo" className="h-16 w-auto rounded" /> : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Invoice Receipts</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{totalRows} total</p>
        </div>
        <Link
          href="/invoice-receipts/new"
          className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          New Receipt
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {methodOptions.map((method) => {
          const active = methodFilter === method
          const href = `/invoice-receipts?${new URLSearchParams({
            ...(params.q ? { q: params.q } : {}),
            method,
            page: '1',
          }).toString()}`
          return (
            <Link
              key={method}
              href={href}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={
                active
                  ? { backgroundColor: 'var(--accent-primary-strong)', color: '#fff' }
                  : { backgroundColor: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--border-muted)' }
              }
            >
              {method === 'all' ? 'All' : method.charAt(0).toUpperCase() + method.slice(1)}
            </Link>
          )
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="method" value={methodFilter} />
          <div className="flex gap-3 items-center flex-nowrap">
            <input type="text" name="q" defaultValue={params.q ?? ''} placeholder="Search invoice receipt id, invoice id, method, reference" className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white" style={{ borderColor: 'var(--border-muted)' }} />
            <ExportButton
              tableId="invoice-receipts-list"
              fileName="invoice-receipts"
              exportAllUrl={buildMasterDataExportUrl('invoice-receipts', params.q)}
            />
            <ColumnSelector tableId="invoice-receipts-list" columns={IR_COLUMNS} />
          </div>
        </form>
        <div className="overflow-x-auto" data-column-selector-table="invoice-receipts-list">
          <table className="min-w-full" id="invoice-receipts-list">
            <thead><tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
              {IR_COLUMNS.map((c) => (
                <th key={c.id} data-column={c.id} className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>
                  <RecordListHeaderLabel label={c.label} tooltip={'tooltip' in c ? c.tooltip : undefined} />
                </th>
              ))}
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No invoice receipts yet.</td></tr>
              ) : rows.map((row, i) => (
                <tr key={row.id} style={i < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                  <td data-column="invoice-receipt-id" className="px-4 py-2 text-sm font-medium">
                    <Link href={`/invoice-receipts/${row.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                      {row.number ?? row.id}
                    </Link>
                  </td>
                  <td data-column="invoice" className="px-4 py-2 text-sm font-medium">
                    {row.invoice ? (
                      <Link href={`/invoices/${row.invoice.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {row.invoice.number}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>{'\u2014'}</span>
                    )}
                  </td>
                  <td data-column="customer" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.invoice?.customer?.name ?? '\u2014'}</td>
                  <td data-column="amount" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtCurrency(row.amount, undefined, moneySettings)}</td>
                  <td data-column="date" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(row.date, moneySettings)}</td>
                  <td data-column="method" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.method}</td>
                  <td data-column="reference" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.reference ?? '\u2014'}</td>
                  <td data-column="db-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{row.id}</td>
                  <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(row.createdAt, moneySettings)}</td>
                  <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{fmtDocumentDate(row.updatedAt, moneySettings)}</td>
                  <td data-column="actions" className="px-4 py-2 text-sm"><span className="flex items-center gap-2">
                    <Link
                      href={`/invoice-receipts/${row.id}?edit=1`}
                      className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                      style={{ backgroundColor: 'var(--accent-primary-strong)' }}
                    >
                      Edit
                    </Link>
                    <DeleteButton id={row.id} endpoint="/api/invoice-receipts" label={row.number ?? row.invoice?.number ?? row.id} />
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationFooter startRow={pagination.startRow} endRow={pagination.endRow} total={totalRows} currentPage={pagination.currentPage} totalPages={pagination.totalPages} hasPrevPage={pagination.hasPrevPage} hasNextPage={pagination.hasNextPage} prevHref={buildPageHref(pagination.currentPage - 1)} nextHref={buildPageHref(pagination.currentPage + 1)} />
      </section>
    </div>
  )
}

