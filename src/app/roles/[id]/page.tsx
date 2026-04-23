import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import RoleDetailCustomizeMode from '@/components/RoleDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadRoleFormCustomization } from '@/lib/role-form-customization-store'
import { ROLE_FORM_FIELDS, type RoleFormFieldKey } from '@/lib/role-form-customization'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

export default async function RoleDetailPage({
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
  const fieldMetaById = buildFieldMetaById(ROLE_FORM_FIELDS)

  const [role, fieldOptions, formCustomization, formRequirements] = await Promise.all([
    prisma.role.findUnique({
      where: { id },
      include: {
        users: {
          orderBy: { name: 'asc' },
          select: { id: true, userId: true, name: true, email: true, inactive: true },
        },
      },
    }),
    loadFieldOptionsMap(fieldMetaById, ['inactive']),
    loadRoleFormCustomization(),
    loadFormRequirements(),
  ])
  const inactiveOptions = fieldOptions.inactive ?? []

  if (!role) notFound()

  const activeUsers = role.users.filter((user) => !user.inactive)
  const inactiveUsers = role.users.filter((user) => user.inactive)
  const detailHref = `/roles/${role.id}`
  const sectionDescriptions: Record<string, string> = {
    Core: 'Primary identity fields for the role record.',
    Status: 'Availability and active-state controls.',
  }

  const fieldDefinitions: Record<RoleFormFieldKey, InlineRecordSection['fields'][number]> = {
    roleId: {
      name: 'roleId',
      label: 'Role ID',
      value: role.roleId,
      helpText: 'System-generated role identifier.',
    },
    name: {
      name: 'name',
      label: 'Name',
      value: role.name,
      helpText: 'Role name shown to admins and users.',
    },
    description: {
      name: 'description',
      label: 'Description',
      value: role.description ?? '',
      helpText: 'Short explanation of the role purpose.',
    },
    inactive: {
      name: 'inactive',
      label: 'Inactive',
      value: role.active ? 'false' : 'true',
      type: 'select',
      options: inactiveOptions,
      helpText: 'Marks the role unavailable for new assignments while preserving history.',
      sourceText: getFieldSourceText(fieldMetaById, 'inactive'),
    },
  }

  const customizeFields = buildCustomizePreviewFields(ROLE_FORM_FIELDS, fieldDefinitions)
  const detailSections: InlineRecordSection[] = buildConfiguredInlineSections({
    fields: ROLE_FORM_FIELDS,
    layout: formCustomization,
    fieldDefinitions,
    sectionDescriptions,
  })
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'role',
    entityId: role.id,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'role', entityId: role.id })

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/roles'}
      backLabel={isCustomizing ? '<- Back to Role Detail' : '<- Back to Roles'}
      meta={role.roleId}
      title={role.name}
      badge={
        !role.active ? (
          <span className="inline-block rounded-full px-3 py-0.5 text-xs font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.18)', color: 'var(--danger)' }}>
            Inactive
          </span>
        ) : null
      }
      actions={
        <>
          {isEditing && !isCustomizing ? (
            <>
              <Link href={detailHref} className="rounded-md border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
                Cancel
              </Link>
              <button
                type="submit"
                form={`inline-record-form-${role.id}`}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Save
              </button>
            </>
          ) : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailCreateMenu newHref="/roles/new" duplicateHref={`/roles/new?duplicateFrom=${role.id}`} /> : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailExportMenu title={role.name} fileName={`role-${role.roleId}`} sections={detailSections} /> : null}
          {!isEditing && !isCustomizing ? (
            <Link href={`${detailHref}?customize=1`} className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}>
              Customize
            </Link>
          ) : null}
          {!isEditing && !isCustomizing ? (
            <Link
              href={`${detailHref}?edit=1`}
              className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              Edit
            </Link>
          ) : null}
          {!isCustomizing ? <DeleteButton resource="roles" id={role.id} /> : null}
        </>
      }
    >
        {isCustomizing ? (
          <RoleDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={formCustomization}
            initialRequirements={{ ...formRequirements.roleCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
          />
        ) : (
          <InlineRecordDetails
            resource="roles"
            id={role.id}
            title="Role details"
            sections={detailSections}
            editing={isEditing}
            columns={formCustomization.formColumns}
            showInternalActions={false}
          />
        )}

        {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} /> : null}

        <RecordDetailSection title="Users" count={role.users.length}>
          <div className="px-6 pt-6">
            {inactiveUsers.length > 0 ? (
              <p className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                {activeUsers.length} active, {inactiveUsers.length} inactive
              </p>
            ) : null}
          </div>
          {role.users.length === 0 ? (
            <RecordDetailEmptyState message="No users assigned to this role." />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  <RecordDetailHeaderCell>User ID</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Email</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Status</RecordDetailHeaderCell>
                </tr>
              </thead>
              <tbody>
                {role.users.map((user, index) => (
                  <tr key={user.id} style={index < role.users.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : {}}>
                    <RecordDetailCell>
                      <Link href={`/users/${user.id}`} className="font-medium hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {user.userId ?? 'Pending'}
                      </Link>
                    </RecordDetailCell>
                    <RecordDetailCell>{user.name ?? '-'}</RecordDetailCell>
                    <RecordDetailCell>{user.email}</RecordDetailCell>
                    <RecordDetailCell>{user.inactive ? 'Inactive' : 'Active'}</RecordDetailCell>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </RecordDetailSection>
        <SystemNotesSection notes={systemNotes} />
    </RecordDetailPageShell>
  )
}
