import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import { formatCustomFieldValue } from '@/lib/custom-fields'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import DepartmentDetailCustomizeMode from '@/components/DepartmentDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import {
  RecordDetailCell,
  RecordDetailField,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadDepartmentFormCustomization } from '@/lib/department-form-customization-store'
import { DEPARTMENT_FORM_FIELDS, type DepartmentFormFieldKey } from '@/lib/department-form-customization'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

function joinSubsidiaryLabels(
  assignments: Array<{ subsidiary: { id: string; subsidiaryId: string; name: string } }>,
  includeChildren: boolean,
) {
  const labels = assignments.map(({ subsidiary }) => `${subsidiary.subsidiaryId} - ${subsidiary.name}`)
  if (labels.length === 0) return ''
  const base = labels.join(', ')
  return includeChildren ? `${base} (+children)` : base
}

export default async function DepartmentDetailPage({
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

  const fieldMetaById = buildFieldMetaById(DEPARTMENT_FORM_FIELDS)

  const [department, fieldOptions, customFields, customFieldValues, formCustomization, formRequirements] = await Promise.all([
    prisma.department.findUnique({
      where: { id },
      include: {
        departmentSubsidiaries: {
          include: { subsidiary: true },
          orderBy: { subsidiary: { subsidiaryId: 'asc' } },
        },
        manager: true,
        approver: true,
        employees: {
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          select: { id: true, firstName: true, lastName: true, employeeId: true, title: true },
        },
      },
    }),
    loadFieldOptionsMap(fieldMetaById, [
      'division',
      'subsidiaryIds',
      'includeChildren',
      'planningCategory',
      'managerEmployeeId',
      'approverEmployeeId',
      'inactive',
    ]),
    prisma.customFieldDefinition.findMany({
      where: { entityType: 'department', active: true },
      orderBy: [{ label: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, label: true, type: true, defaultValue: true },
    }),
    prisma.customFieldValue.findMany({
      where: { entityType: 'department', recordId: id },
      select: { fieldId: true, value: true },
    }),
    loadDepartmentFormCustomization(),
    loadFormRequirements(),
  ])

  if (!department) notFound()

  const customFieldValueMap = new Map(customFieldValues.map((entry) => [entry.fieldId, entry.value]))
  const subsidiaryValue = department.departmentSubsidiaries.map(({ subsidiary }) => subsidiary.id).join(',')
  const subsidiaryDisplay = joinSubsidiaryLabels(department.departmentSubsidiaries, department.includeChildren)
  const detailHref = `/departments/${department.id}`
  const sectionDescriptions: Record<string, string> = {
    Core: 'Identity and descriptive details for the department.',
    Organization: 'Organizational ownership and reporting relationships.',
    Status: 'Availability and active-state controls for the department.',
  }

  const fieldDefinitions: Record<DepartmentFormFieldKey, InlineRecordSection['fields'][number]> = {
    departmentId: {
      name: 'departmentId',
      label: 'Department Id',
      value: department.departmentId,
      helpText: 'Unique department code used across the company.',
    },
    departmentNumber: {
      name: 'departmentNumber',
      label: 'Department Number',
      value: department.departmentNumber ?? '',
      helpText: 'Short numeric or business-facing department number used by the company.',
    },
    name: {
      name: 'name',
      label: 'Name',
      value: department.name,
      helpText: 'Display name of the department.',
    },
    description: {
      name: 'description',
      label: 'Description',
      value: department.description ?? '',
      helpText: 'Longer explanation of the department purpose or scope.',
    },
    division: {
      name: 'division',
      label: 'Division',
      value: department.division ?? '',
      type: 'select',
      options: [{ value: '', label: 'None' }, ...(fieldOptions.division ?? [])],
      helpText: 'Higher-level grouping for management reporting or organizational structure.',
      sourceText: getFieldSourceText(fieldMetaById, 'division'),
    },
    subsidiaryIds: {
      name: 'subsidiaryIds',
      label: 'Subsidiaries',
      value: subsidiaryValue,
      type: 'select',
      multiple: true,
      placeholder: 'Select subsidiaries',
      options: fieldOptions.subsidiaryIds ?? [],
      helpText: 'Subsidiaries where the department is available for use.',
      sourceText: getFieldSourceText(fieldMetaById, 'subsidiaryIds'),
    },
    includeChildren: {
      name: 'includeChildren',
      label: 'Include Children',
      value: String(department.includeChildren),
      type: 'select',
      options: fieldOptions.includeChildren ?? [],
      helpText: 'Includes child subsidiaries when a parent subsidiary is selected.',
      sourceText: getFieldSourceText(fieldMetaById, 'includeChildren'),
    },
    planningCategory: {
      name: 'planningCategory',
      label: 'Department Planning Category',
      value: department.planningCategory ?? '',
      type: 'select',
      placeholder: 'Select planning category',
      options: [{ value: '', label: 'None' }, ...(fieldOptions.planningCategory ?? [])],
      helpText: 'Planning category used for company-specific department planning and reporting.',
      sourceText: getFieldSourceText(fieldMetaById, 'planningCategory'),
    },
    managerEmployeeId: {
      name: 'managerEmployeeId',
      label: 'Department Manager',
      value: department.managerEmployeeId ?? '',
      type: 'select',
      placeholder: 'Select manager',
      options: [{ value: '', label: 'None' }, ...(fieldOptions.managerEmployeeId ?? [])],
      helpText: 'Employee responsible for leading the department.',
      sourceText: getFieldSourceText(fieldMetaById, 'managerEmployeeId'),
    },
    approverEmployeeId: {
      name: 'approverEmployeeId',
      label: 'Department Approver',
      value: department.approverEmployeeId ?? '',
      type: 'select',
      placeholder: 'Select approver',
      options: [{ value: '', label: 'None' }, ...(fieldOptions.approverEmployeeId ?? [])],
      helpText: 'Employee that approves department transactions or requests.',
      sourceText: getFieldSourceText(fieldMetaById, 'approverEmployeeId'),
    },
    inactive: {
      name: 'inactive',
      label: 'Inactive',
      value: String(!department.active),
      type: 'select',
      options: fieldOptions.inactive ?? [],
      helpText: 'Marks the department unavailable for new activity while preserving history.',
      sourceText: getFieldSourceText(fieldMetaById, 'inactive'),
    },
  }

  const customizeFields = buildCustomizePreviewFields(DEPARTMENT_FORM_FIELDS, fieldDefinitions)
  const detailSections: InlineRecordSection[] = buildConfiguredInlineSections({
    fields: DEPARTMENT_FORM_FIELDS,
    layout: formCustomization,
    fieldDefinitions,
    sectionDescriptions,
  })
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'department',
    entityId: department.id,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'department', entityId: department.id })

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/departments'}
      backLabel={isCustomizing ? '<- Back to Department Detail' : '<- Back to Departments'}
      meta={department.departmentId}
      title={department.name}
      badge={(
        <span
          className="inline-block rounded-full px-3 py-0.5 text-sm"
          style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
        >
          {department.active ? 'Active' : 'Inactive'}
        </span>
      )}
      actions={(
        <>
          {isEditing && !isCustomizing ? (
            <>
              <Link
                href={detailHref}
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
                style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </Link>
              <button
                type="submit"
                form={`inline-record-form-${department.id}`}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Save
              </button>
            </>
          ) : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailCreateMenu newHref="/departments/new" duplicateHref={`/departments/new?duplicateFrom=${department.id}`} /> : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailExportMenu title={department.name} fileName={`department-${department.departmentId}`} sections={detailSections} /> : null}
          {!isEditing && !isCustomizing ? (
            <Link
              href={`${detailHref}?customize=1`}
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
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
          {!isCustomizing ? <DeleteButton resource="departments" id={department.id} /> : null}
        </>
      )}
    >
      {isCustomizing ? (
        <DepartmentDetailCustomizeMode
          detailHref={detailHref}
          initialLayout={formCustomization}
          initialRequirements={{ ...formRequirements.departmentCreate }}
          fields={customizeFields}
          sectionDescriptions={sectionDescriptions}
        />
      ) : (
        <InlineRecordDetails
          resource="departments"
          id={department.id}
          title="Department details"
          sections={detailSections}
          editing={isEditing}
          columns={formCustomization.formColumns}
          showInternalActions={false}
        />
      )}

      {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} /> : null}

      <RecordDetailSection title="Subsidiary Availability" count={department.departmentSubsidiaries.length}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <RecordDetailField label="Subsidiaries">{subsidiaryDisplay || '-'}</RecordDetailField>
          <RecordDetailField label="Include Children">{department.includeChildren ? 'Yes' : 'No'}</RecordDetailField>
        </dl>
      </RecordDetailSection>

      {customFields.length > 0 ? (
        <RecordDetailSection title="Custom fields" count={customFields.length}>
          <dl className="grid gap-3 sm:grid-cols-2">
            {customFields.map((field) => (
              <RecordDetailField key={field.id} label={field.label}>
                {formatCustomFieldValue(
                  field.type as 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox',
                  customFieldValueMap.get(field.id) ?? field.defaultValue,
                ) ?? '-'}
              </RecordDetailField>
            ))}
          </dl>
        </RecordDetailSection>
      ) : null}

      <RecordDetailSection title="Employees" count={department.employees.length}>
        {department.employees.length === 0 ? (
          <p className="px-6 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            No employees in this department
          </p>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr>
                <RecordDetailHeaderCell>Employee Id</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                <RecordDetailHeaderCell>Title</RecordDetailHeaderCell>
              </tr>
            </thead>
            <tbody>
              {department.employees.map((employee) => (
                <tr key={employee.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  <RecordDetailCell>
                    <Link
                      href={`/employees/${employee.id}`}
                      className="hover:underline"
                      style={{ color: 'var(--accent-primary-strong)' }}
                    >
                      {employee.employeeId ?? 'Pending'}
                    </Link>
                  </RecordDetailCell>
                  <RecordDetailCell>{employee.firstName} {employee.lastName}</RecordDetailCell>
                  <RecordDetailCell>{employee.title ?? '-'}</RecordDetailCell>
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
