import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreateModalButton from '@/components/CreateModalButton'
import EntityCreateForm from '@/components/EntityCreateForm'
import EditButton from '@/components/EditButton'
import DeleteButton from '@/components/DeleteButton'
import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import PaginationFooter from '@/components/PaginationFooter'
import { getPagination } from '@/lib/pagination'
import { loadCompanyInformationSettings } from '@/lib/company-information-settings-store'
import { loadCompanyCabinetFiles } from '@/lib/company-file-cabinet-store'
import { generateNextEntityCode } from '@/lib/entity-code'

type HierarchyEntity = {
  id: string
  code: string
  name: string
  parentEntityId: string | null
}

type HierarchyNode = HierarchyEntity & {
  children: HierarchyNode[]
}

const COLS = [
  { id: 'code', label: 'Code' },
  { id: 'name', label: 'Name' },
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
    ? { OR: [{ code: { contains: query } }, { name: { contains: query } }] }
    : {}

  const total = await prisma.entity.count({ where })
  const pagination = getPagination(total, params.page)

  const [entities, currencies, allEntities, nextEntityCode, companySettings, cabinetFiles] = await Promise.all([
    prisma.entity.findMany({ where, include: { defaultCurrency: true, parentEntity: true }, orderBy: { code: 'asc' }, skip: pagination.skip, take: pagination.pageSize }),
    prisma.currency.findMany({ orderBy: { code: 'asc' } }),
    prisma.entity.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true, parentEntityId: true } }),
    generateNextEntityCode(),
    loadCompanyInformationSettings(),
    loadCompanyCabinetFiles(),
  ])
  const subsidiaryTree = buildSubsidiaryTree(allEntities)

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
        <CreateModalButton buttonLabel="New Subsidiary" title="New Subsidiary">
          <EntityCreateForm initialCode={nextEntityCode} currencies={currencies} parentEntities={allEntities.map(({ id, code, name }) => ({ id, code, name }))} />
        </CreateModalButton>
      </div>

      <section className="mb-6 overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="border-b px-6 py-4" style={{ borderColor: 'var(--border-muted)' }}>
          <h2 className="text-base font-semibold text-white">Subsidiary Hierarchy</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Consolidation roll-up view of parent and child subsidiaries.
          </p>
        </div>
        <div className="px-6 py-5">
          {subsidiaryTree.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No subsidiaries available.</p>
          ) : (
            <div className="space-y-2">
              {subsidiaryTree.map((node) => (
                <HierarchyTreeNode key={node.id} node={node} depth={0} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <form className="border-b px-6 py-4" method="get" style={{ borderColor: 'var(--border-muted)' }}>
          <div className="flex gap-3 items-center flex-nowrap">
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search code or name"
              className="flex-1 min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm text-white"
              style={{ borderColor: 'var(--border-muted)' }}
            />
            <input type="hidden" name="page" value="1" />
            <div className="flex items-center gap-2">
              <Link href="/subsidiaries" className="rounded-md border px-3 py-2 text-sm font-medium text-center" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>Reset</Link>
              <ExportButton tableId="subsidiaries-list" fileName="subsidiaries" />
            </div>
            <ColumnSelector tableId="subsidiaries-list" columns={COLS} />
          </div>
        </form>

        <div className="overflow-x-auto" data-column-selector-table="subsidiaries-list">
          <table className="min-w-full" id="subsidiaries-list">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                <th data-column="code" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Code</th>
                <th data-column="name" className="sticky top-0 z-10 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--card)' }}>Name</th>
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
                  <td colSpan={10} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No subsidiaries found
                  </td>
                </tr>
              ) : (
                entities.map((entity, index) => (
                  <tr key={entity.id} style={index < entities.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <td data-column="code" className="px-4 py-2 text-sm font-medium text-white"><Link href={`/subsidiaries/${entity.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{entity.code}</Link></td>
                    <td data-column="name" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.name}</td>
                    <td data-column="parent-subsidiary" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.parentEntity ? `${entity.parentEntity.code} - ${entity.parentEntity.name}` : '—'}</td>
                    <td data-column="legal-name" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.legalName ?? '—'}</td>
                    <td data-column="type" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.entityType ?? '—'}</td>
                    <td data-column="default-currency" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.defaultCurrency?.code ?? '—'}</td>
                    <td data-column="inactive" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{entity.active ? 'No' : 'Yes'}</td>
                    <td data-column="created" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(entity.createdAt).toLocaleDateString()}</td>
                    <td data-column="last-modified" className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{new Date(entity.updatedAt).toLocaleDateString()}</td>
                    <td data-column="actions" className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <EditButton
                          resource="entities"
                          id={entity.id}
                          fields={[
                            { name: 'code', label: 'Code', value: entity.code },
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
                                  label: `${candidate.code} - ${candidate.name}`,
                                })),
                            },
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

function buildSubsidiaryTree(entities: HierarchyEntity[]): HierarchyNode[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]))
  const childrenByParent = new Map<string | null, HierarchyEntity[]>()

  for (const entity of entities) {
    const parentId = entity.parentEntityId && byId.has(entity.parentEntityId) ? entity.parentEntityId : null
    const group = childrenByParent.get(parentId) ?? []
    group.push(entity)
    childrenByParent.set(parentId, group)
  }

  const buildNodes = (parentId: string | null, lineage: Set<string>): HierarchyNode[] => {
    const group = childrenByParent.get(parentId) ?? []
    return group.map((entity) => {
      if (lineage.has(entity.id)) {
        return { ...entity, children: [] }
      }

      const nextLineage = new Set(lineage)
      nextLineage.add(entity.id)
      return {
        ...entity,
        children: buildNodes(entity.id, nextLineage),
      }
    })
  }

  return buildNodes(null, new Set())
}

function HierarchyTreeNode({ node, depth }: { node: HierarchyNode; depth: number }) {
  return (
    <div>
      <div
        className="flex items-center gap-3 rounded-lg border px-4 py-3"
        style={{
          marginLeft: `${depth * 24}px`,
          borderColor: 'var(--border-muted)',
          backgroundColor: depth === 0 ? 'rgba(59,130,246,0.08)' : 'transparent',
        }}
      >
        <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{node.code}</span>
        <Link href={`/subsidiaries/${node.id}`} className="text-sm font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
          {node.name}
        </Link>
      </div>
      {node.children.length > 0 ? (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <HierarchyTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
