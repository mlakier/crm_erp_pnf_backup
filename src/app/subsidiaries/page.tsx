import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import EntityCreateForm from '@/components/EntityCreateForm'
import MasterDataCustomizeButton from '@/components/MasterDataCustomizeButton'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { generateNextEntityCode } from '@/lib/entity-code'
import { COUNTRY_OPTIONS } from '@/lib/address-country-config'
import SubsidiaryHierarchyModal from '@/components/SubsidiaryHierarchyModal'
import TableHorizontalScrollbar from '@/components/TableHorizontalScrollbar'

type SubsidiaryHierarchyEntity = {
  id: string
  subsidiaryId: string
  name: string
  country: string | null
  entityType: string | null
  taxId: string | null
  parentEntityId: string | null
}

const COLS = [
  { id: 'subsidiary-id', label: 'Subsidiary Id' },
  { id: 'name', label: 'Name' },
  { id: 'country', label: 'Country' },
  { id: 'tax-id', label: 'Tax ID' },
  { id: 'parent-subsidiary', label: 'Parent Subsidiary' },
  { id: 'legal-name', label: 'Legal Name' },
  { id: 'type', label: 'Type' },
  { id: 'default-currency', label: 'Default Currency' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'created', label: 'Created' },
  { id: 'last-modified', label: 'Last Modified' },
  { id: 'actions', label: 'Actions', locked: true },
]

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()

  const where = query
    ? { OR: [{ subsidiaryId: { contains: query } }, { name: { contains: query } }] }
    : {}

  const total = await prisma.entity.count({ where })
  const pagination = getPagination(total, params.page)

  const [entities, currencies, allEntities, nextEntityCode, companySettings, cabinetFiles] = await Promise.all([
    prisma.entity.findMany({ where, include: { defaultCurrency: true, parentEntity: true }, orderBy: { subsidiaryId: 'asc' }, skip: pagination.skip, take: pagination.pageSize }),
    prisma.currency.findMany({ orderBy: { currencyId: 'asc' } }),
    prisma.entity.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true, country: true, entityType: true, taxId: true, parentEntityId: true } }),
    generateNextEntityCode(),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
  ])
  const hierarchyEntities: SubsidiaryHierarchyEntity[] = allEntities

  const buildPageHref = (p: number) => {
    const s = new URLSearchParams()
    if (params.q) s.set('q', params.q)
    s.set('page', String(p))
    return `/subsidiaries?${s.toString()}`
  }

  const selectedLogoValue = companySettings.companyLogoPagesFileId
  const companyLogoPages =
    cabinetFiles.find((file) => file.id === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.originalName === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.storedName === selectedLogoValue)
    ?? cabinetFiles.find((file) => file.url === selectedLogoValue)
    ?? (!selectedLogoValue ? cabinetFiles[0] : undefined)

  return (
    <div className="min-h-full px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        {companyLogoPages ? (
          <img
            src={companyLogoPages.url}
            alt="Company logo"
            className="h-16 w-auto rounded"
          />
        ) : null}
        <div>
          <h1 className="text-xl font-semibold text-white">Subsidiaries</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <MasterDataCustomizeButton tableId="subsidiaries-list" columns={COLS} title="Subsidiaries" />
          <CreateModalButton buttonLabel="New Subsidiary" title="New Subsidiary">
            <EntityCreateForm initialSubsidiaryId={nextEntityCode} currencies={currencies} parentEntities={allEntities.map(({ id, subsidiaryId, name }) => ({ id, subsidiaryId, name }))} />
          </CreateModalButton>
        </div>
      </div>

      <SubsidiaryHierarchyModal
        entities={hierarchyEntities}
        logoUrl={companyLogoPages?.url}
        title={companySettings.companyName ? `${companySettings.companyName} Group of Companies` : 'Group of Companies'}
      />

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search subsidiary id or name"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="page" value="1" />
            <ExportButton tableId="subsidiaries-list" fileName="subsidiaries" compact />
            <ColumnSelector tableId="subsidiaries-list" columns={COLS} />
          </div>
        </form>

        <div id="subsidiaries-list-scroll" className="overflow-x-auto" data-column-selector-table="subsidiaries-list">
          <table className="min-w-[1400px] w-full" id="subsidiaries-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="subsidiary-id" className="sticky top-0 left-0 z-20 w-36 min-w-36 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Subsidiary Id</th>
                <th data-column="name" className="sticky top-0 z-20 w-64 min-w-64 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ left: '9rem', color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
                <th data-column="country" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Country</th>
                <th data-column="tax-id" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Tax ID</th>
                <th data-column="parent-subsidiary" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Parent Subsidiary</th>
                <th data-column="legal-name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Legal Name</th>
                <th data-column="type" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Type</th>
                <th data-column="default-currency" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Default Currency</th>
                <th data-column="inactive" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Inactive</th>
                <th data-column="created" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Created</th>
                <th data-column="last-modified" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Last Modified</th>
                <th data-column="actions" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entities.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No subsidiaries found
                  </td>
                </tr>
              ) : (
                entities.map((entity, index) => (
                  <tr key={entity.id} style={index < entities.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="subsidiary-id" className="sticky left-0 z-10 w-36 min-w-36 px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: 'var(--card)' }}><Link href={`/subsidiaries/${entity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{entity.subsidiaryId}</Link></td>
                    <td data-column="name" className="sticky z-10 w-64 min-w-64 px-4 py-2 text-sm" style={{ left: '9rem', color: 'var(--text-secondary)', backgroundColor: 'var(--card)' }}>{entity.name}</td>
                    <td data-column="country" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.country ?? '—'}</td>
                    <td data-column="tax-id" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.taxId ?? '—'}</td>
                    <td data-column="parent-subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.parentEntity ? `${entity.parentEntity.subsidiaryId} - ${entity.parentEntity.name}` : '—'}</td>
                    <td data-column="legal-name" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.legalName ?? '—'}</td>
                    <td data-column="type" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.entityType ?? '—'}</td>
                    <td data-column="default-currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.defaultCurrency?.currencyId ?? '—'}</td>
                    <td data-column="inactive" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.active ? 'No' : 'Yes'}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(entity.createdAt).toLocaleDateString()}</td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(entity.updatedAt).toLocaleDateString()}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="entities"
                          id={entity.id}
                          fields={[
                            { name: 'subsidiaryId', label: 'Subsidiary Id', value: entity.subsidiaryId },
                            { name: 'name', label: 'Name', value: entity.name },
                            {
                              name: 'parentEntityId',
                              label: 'Parent Subsidiary',
                              value: entity.parentEntityId ?? '',
                              type: 'select',
                              placeholder: 'Select parent subsidiary',
                              options: allEntities
                                .filter((candidate) => candidate.id !== entity.id)
                                .map((candidate) => ({
                                  value: candidate.id,
                                  label: `${candidate.subsidiaryId} - ${candidate.name}`,
                                })),
                            },
                            {
                              name: 'country',
                              label: 'Country',
                              value: entity.country ?? '',
                              type: 'select',
                              placeholder: 'Select country',
                              options: COUNTRY_OPTIONS.map((option) => ({ value: option.code, label: option.label })),
                            },
                            { name: 'taxId', label: 'Tax ID', value: entity.taxId ?? '' },
                            { name: 'address', label: 'Address', value: entity.address ?? '', type: 'address' },
                            { name: 'legalName', label: 'Legal Name', value: entity.legalName ?? '' },
                            { name: 'entityType', label: 'Type', value: entity.entityType ?? '' },
                          ]}
                        />
                        <DeleteButton resource="entities" id={entity.id} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableHorizontalScrollbar targetId="subsidiaries-list-scroll" />
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
      </section>
    </div>
  )
}
