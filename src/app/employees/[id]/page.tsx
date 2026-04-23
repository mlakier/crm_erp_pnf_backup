import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DeleteButton from '@/components/DeleteButton'
import InlineRecordDetails, { type InlineRecordSection } from '@/components/InlineRecordDetails'
import MasterDataDetailCreateMenu from '@/components/MasterDataDetailCreateMenu'
import MasterDataDetailExportMenu from '@/components/MasterDataDetailExportMenu'
import MasterDataSystemInfoSection from '@/components/MasterDataSystemInfoSection'
import EmployeeDetailCustomizeMode from '@/components/EmployeeDetailCustomizeMode'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import SystemNotesSection from '@/components/SystemNotesSection'
import {
  RecordDetailCell,
  RecordDetailEmptyState,
  RecordDetailHeaderCell,
  RecordDetailSection,
} from '@/components/RecordDetailPanels'
import { buildConfiguredInlineSections, buildCustomizePreviewFields } from '@/lib/detail-page-helpers'
import { loadEmployeeFormCustomization } from '@/lib/employee-form-customization-store'
import { EMPLOYEE_FORM_FIELDS, type EmployeeFormFieldKey } from '@/lib/employee-form-customization'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { buildFieldMetaById, getFieldSourceText, loadFieldOptionsMap } from '@/lib/field-source-helpers'
import { loadMasterDataSystemInfo } from '@/lib/master-data-system-info'
import { loadMasterDataSystemNotes } from '@/lib/master-data-system-notes'

export default async function EmployeeDetailPage({
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

  const fieldMetaById = buildFieldMetaById(EMPLOYEE_FORM_FIELDS)

  const [employee, fieldOptions, allUsers, linkedUsers, formCustomization, formRequirements] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: {
        subsidiary: true,
        employeeSubsidiaries: {
          include: { subsidiary: true },
          orderBy: { subsidiary: { subsidiaryId: 'asc' } },
        },
        departmentRef: true,
        user: { select: { id: true, userId: true, name: true, email: true } },
        manager: { select: { id: true, firstName: true, lastName: true, title: true, employeeId: true } },
        directReports: {
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          select: { id: true, firstName: true, lastName: true, title: true, email: true, employeeId: true },
        },
      },
    }),
    loadFieldOptionsMap(fieldMetaById, ['subsidiaryIds', 'departmentId', 'managerId', 'laborType', 'inactive']),
    prisma.user.findMany({
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: { id: true, userId: true, name: true, email: true },
    }),
    prisma.employee.findMany({
      where: { id: { not: id }, userId: { not: null } },
      select: { userId: true },
    }),
    loadEmployeeFormCustomization(),
    loadFormRequirements(),
  ])

  if (!employee) notFound()

  const linkedUserIdSet = new Set(linkedUsers.map((entry) => entry.userId).filter((value): value is string => Boolean(value)))
  const users = allUsers.filter((user) => user.id === employee.userId || !linkedUserIdSet.has(user.id))

  const detailHref = `/employees/${employee.id}`
  const sectionDescriptions: Record<string, string> = {
    Core: 'Identity and primary contact details for the employee.',
    Organization: 'Reporting structure and organizational placement.',
    Access: 'User account linkage and access context.',
    Employment: 'Dates and employment lifecycle details.',
    Status: 'Availability and active-state controls.',
  }

  const fieldDefinitions: Record<EmployeeFormFieldKey, InlineRecordSection['fields'][number]> = {
    employeeId: {
      name: 'employeeId',
      label: 'Employee ID',
      value: employee.employeeId ?? '',
      helpText: 'Unique employee number or code.',
    },
    eid: {
      name: 'eid',
      label: 'EID',
      value: employee.eid ?? '',
      helpText: 'External or enterprise employee identifier.',
    },
    firstName: {
      name: 'firstName',
      label: 'First Name',
      value: employee.firstName,
      helpText: 'Given name of the employee.',
    },
    lastName: {
      name: 'lastName',
      label: 'Last Name',
      value: employee.lastName,
      helpText: 'Family name of the employee.',
    },
    email: {
      name: 'email',
      label: 'Email',
      value: employee.email ?? '',
      type: 'email',
      helpText: 'Primary work email address.',
    },
    phone: {
      name: 'phone',
      label: 'Phone',
      value: employee.phone ?? '',
      helpText: 'Primary work phone number.',
    },
    title: {
      name: 'title',
      label: 'Title',
      value: employee.title ?? '',
      helpText: 'Job title or role label.',
    },
    laborType: {
      name: 'laborType',
      label: 'Labor Type',
      value: employee.laborType ?? '',
      type: 'select',
      placeholder: 'Select labor type',
      options: fieldOptions.laborType ?? [],
      helpText: 'Labor classification used for staffing, costing, or billing.',
      sourceText: getFieldSourceText(fieldMetaById, 'laborType'),
    },
    departmentId: {
      name: 'departmentId',
      label: 'Department',
      value: employee.departmentId ?? '',
      type: 'select',
      placeholder: 'Select department',
      options: fieldOptions.departmentId ?? [],
      helpText: 'Department the employee belongs to.',
      sourceText: getFieldSourceText(fieldMetaById, 'departmentId'),
    },
    subsidiaryIds: {
      name: 'subsidiaryIds',
      label: 'Subsidiaries',
      value: employee.employeeSubsidiaries.map((assignment) => assignment.subsidiaryId).join(','),
      type: 'select',
      multiple: true,
      placeholder: 'Select subsidiaries',
      options: fieldOptions.subsidiaryIds ?? [],
      helpText: 'Subsidiaries where the employee is available.',
      sourceText: getFieldSourceText(fieldMetaById, 'subsidiaryIds'),
    },
    includeChildren: {
      name: 'includeChildren',
      label: 'Include Children',
      value: String(employee.includeChildren),
      type: 'checkbox',
      placeholder: 'Include Children',
      helpText: 'If enabled, child subsidiaries under selected subsidiaries also inherit employee availability.',
    },
    managerId: {
      name: 'managerId',
      label: 'Manager',
      value: employee.managerId ?? '',
      type: 'select',
      placeholder: 'Select manager',
      options: fieldOptions.managerId ?? [],
      helpText: 'Direct manager of the employee.',
      sourceText: getFieldSourceText(fieldMetaById, 'managerId'),
    },
    userId: {
      name: 'userId',
      label: 'Linked User',
      value: employee.userId ?? '',
      type: 'select',
      placeholder: 'Select user',
      options: users.map((user) => ({
        value: user.id,
        label: `${user.name ?? user.email}${user.userId ? ` (${user.userId})` : ''}`,
      })),
      helpText: 'User account linked to this employee.',
      sourceText: getFieldSourceText(fieldMetaById, 'userId'),
    },
    hireDate: {
      name: 'hireDate',
      label: 'Hire Date',
      value: employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : '',
      type: 'date',
      helpText: 'Date the employee joined the company.',
    },
    terminationDate: {
      name: 'terminationDate',
      label: 'Termination Date',
      value: employee.terminationDate ? new Date(employee.terminationDate).toISOString().split('T')[0] : '',
      type: 'date',
      helpText: 'Date the employee left the company, if applicable.',
    },
    inactive: {
      name: 'inactive',
      label: 'Inactive',
      value: String(!employee.active),
      type: 'select',
      options: fieldOptions.inactive ?? [],
      helpText: 'Marks the employee unavailable for new activity while preserving history.',
      sourceText: getFieldSourceText(fieldMetaById, 'inactive'),
    },
  }

  const customizeFields = buildCustomizePreviewFields(EMPLOYEE_FORM_FIELDS, fieldDefinitions)
  const detailSections: InlineRecordSection[] = buildConfiguredInlineSections({
    fields: EMPLOYEE_FORM_FIELDS,
    layout: formCustomization,
    fieldDefinitions,
    sectionDescriptions,
  })
  const systemInfo = await loadMasterDataSystemInfo({
    entityType: 'employee',
    entityId: employee.id,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  })
  const systemNotes = await loadMasterDataSystemNotes({ entityType: 'employee', entityId: employee.id })

  return (
    <RecordDetailPageShell
      backHref={isCustomizing ? detailHref : '/employees'}
      backLabel={isCustomizing ? '<- Back to Employee Detail' : '<- Back to Employees'}
      meta={employee.employeeId ?? 'No Employee ID'}
      title={`${employee.firstName} ${employee.lastName}`}
      badge={
        employee.title ? (
          <span
            className="inline-block rounded-full px-3 py-0.5 text-sm"
            style={{ backgroundColor: 'rgba(59,130,246,0.18)', color: 'var(--accent-primary-strong)' }}
          >
            {employee.title}
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
                form={`inline-record-form-${employee.id}`}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Save
              </button>
            </>
          ) : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailCreateMenu newHref="/employees/new" duplicateHref={`/employees/new?duplicateFrom=${employee.id}`} /> : null}
          {!isEditing && !isCustomizing ? <MasterDataDetailExportMenu title={`${employee.firstName} ${employee.lastName}`} fileName={`employee-${employee.employeeId ?? employee.id}`} sections={detailSections} /> : null}
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
          {!isCustomizing ? <DeleteButton resource="employees" id={employee.id} /> : null}
        </>
      }
    >
        {isCustomizing ? (
          <EmployeeDetailCustomizeMode
            detailHref={detailHref}
            initialLayout={formCustomization}
            initialRequirements={{ ...formRequirements.employeeCreate }}
            fields={customizeFields}
            sectionDescriptions={sectionDescriptions}
          />
        ) : (
          <InlineRecordDetails
            resource="employees"
            id={employee.id}
            title="Employee details"
            sections={detailSections}
            editing={isEditing}
            columns={formCustomization.formColumns}
            showInternalActions={false}
          />
        )}

        {!isCustomizing ? <MasterDataSystemInfoSection info={systemInfo} /> : null}

        <RecordDetailSection title="Direct Reports" count={employee.directReports.length}>
          {employee.directReports.length === 0 ? (
            <RecordDetailEmptyState message="No direct reports" />
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <RecordDetailHeaderCell>Employee ID</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Title</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Email</RecordDetailHeaderCell>
                </tr>
              </thead>
              <tbody>
                {employee.directReports.map((report) => (
                  <tr key={report.id} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                    <RecordDetailCell>
                      <Link href={`/employees/${report.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>
                        {report.employeeId ?? 'Pending'}
                      </Link>
                    </RecordDetailCell>
                    <RecordDetailCell>{report.firstName} {report.lastName}</RecordDetailCell>
                    <RecordDetailCell>{report.title ?? '-'}</RecordDetailCell>
                    <RecordDetailCell>{report.email ?? '-'}</RecordDetailCell>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </RecordDetailSection>

        <RecordDetailSection title="Linked User" count={employee.user ? 1 : 0}>
          {employee.user ? (
            <table className="min-w-full">
              <thead>
                <tr>
                  <RecordDetailHeaderCell>User ID</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Name</RecordDetailHeaderCell>
                  <RecordDetailHeaderCell>Email</RecordDetailHeaderCell>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <RecordDetailCell><Link href={`/users/${employee.user.id}`} className="hover:underline" style={{ color: 'var(--accent-primary-strong)' }}>{employee.user.userId ?? 'Pending'}</Link></RecordDetailCell>
                  <RecordDetailCell>{employee.user.name ?? '-'}</RecordDetailCell>
                  <RecordDetailCell>{employee.user.email}</RecordDetailCell>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <RecordDetailEmptyState message="No linked user" />
              <Link
                href={`/users/new?employeeId=${employee.id}`}
                className="rounded-md px-3 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent-primary-strong)' }}
              >
                Add User
              </Link>
            </div>
          )}
        </RecordDetailSection>
        <SystemNotesSection notes={systemNotes} />
    </RecordDetailPageShell>
  )
}
