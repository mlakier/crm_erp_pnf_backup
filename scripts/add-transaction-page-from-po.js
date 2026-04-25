#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const rawName = process.argv[2]
const flowArg = (process.argv[3] || '').trim().toUpperCase()

if (!rawName) {
  console.error('Usage: node scripts/add-transaction-page-from-po.js <entity-name> [OTC|PTP|RTR]')
  process.exit(1)
}

function toPascal(value) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')
}

function singularizeSlug(value) {
  const parts = value.split('-').filter(Boolean)
  if (parts.length === 0) return value

  const last = parts[parts.length - 1]
  let singularLast = last

  if (last.endsWith('ies') && last.length > 3) {
    singularLast = `${last.slice(0, -3)}y`
  } else if (last.endsWith('ses') && last.length > 3) {
    singularLast = last.slice(0, -2)
  } else if (last.endsWith('s') && !last.endsWith('ss') && last.length > 1) {
    singularLast = last.slice(0, -1)
  }

  return [...parts.slice(0, -1), singularLast].join('-')
}

function writeFileIfMissing(filePath, content, results) {
  if (fs.existsSync(filePath)) {
    results.push({ path: filePath, action: 'skipped-existing' })
    return
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
  results.push({ path: filePath, action: 'created' })
}

const slug = rawName
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const singularSlug = singularizeSlug(slug)
const pascal = toPascal(singularSlug)
const routePascal = toPascal(slug)
const constant = singularSlug.toUpperCase().replace(/-/g, '_')
const routeConstant = slug.toUpperCase().replace(/-/g, '_')
const detailKeyType = `${pascal}DetailFieldKey`
const detailConfigType = `${pascal}DetailCustomizationConfig`
const detailFieldsConst = `${constant}_DETAIL_FIELDS`
const routeBase = `src/app/${slug}`
const formKey = `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}Create`
const repoRoot = process.cwd()

const displayName = rawName.trim()
const singularDisplayName = pascal.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
const pluralDisplayName = routePascal.replace(/([a-z0-9])([A-Z])/g, '$1 $2')

const flowLabel =
  flowArg === 'OTC' ? 'Order to Cash'
    : flowArg === 'PTP' ? 'Procure to Pay'
      : flowArg === 'RTR' ? 'Record to Report'
        : 'Transaction'

const checklist = [
  `PO-style transaction scaffold memory for ${pluralDisplayName} (${slug})`,
  '',
  `Goal: make ${pluralDisplayName} behave like Purchase Orders for + New, detail, edit detail, and customize layout.`,
  '',
  'Required files / edits:',
  `1. prisma/schema.prisma: confirm ${singularDisplayName} header + line model fields, relations, indexes, and status/source columns needed for PO-style page parity.`,
  `2. src/lib/company-preferences-definitions.ts: add ${slug} transaction Id setting if missing.`,
  `3. src/lib/${slug}-number.ts: generated transaction number helper using Company Prefs.`,
  `4. src/lib/${slug}-detail-customization.ts: define ${detailKeyType}, ${detailConfigType}, ${detailFieldsConst}, line columns if applicable, default sections, rows, and formColumns.`,
  `5. src/lib/${slug}-detail-customization-store.ts: load/save/merge/normalize customization config.`,
  `6. src/app/api/config/${slug}-detail-customization/route.ts: GET/POST customization API.`,
  `7. src/components/${pascal}DetailCustomizeMode.tsx: copy PO live section/grid customizer pattern, including section add/rename/reorder/delete, row counts, drag/drop field placement, visibility, required toggles, and line-column toggles if applicable.`,
  `8. src/components/${pascal}CreatePageClient.tsx: PO-style full-page create shell using RecordDetailPageShell + PurchaseOrderHeaderSections equivalent.`,
  `9. src/components/${pascal}PageActions.tsx: top-right action row with + menu, export, Customize, Edit, Delete, Save/Cancel in edit mode.`,
  `10. src/components/${pascal}HeaderSections.tsx or reuse PurchaseOrderHeaderSections: sectioned/grid header rendering for view/edit/new.`,
  `11. src/components/${pascal}CreateForm.tsx and/or line form sections: ensure create uses the same section/grid layout as edit.`,
  `12. src/app/${slug}/new/page.tsx: full page only, no modal. Must match edit layout and support duplicateFrom.`,
  `13. src/app/${slug}/[id]/page.tsx: regular detail, edit detail, customize mode; wire Customize button, + New/Duplicate menu, export, related sections, system info, system notes.`,
  `14. src/app/${slug}/page.tsx: list page should link first identifier column to detail page, not rely on modal edit as the primary experience.`,
  `15. src/app/api/${slug}/route.ts: CRUD plus activity logging and field-change system notes. Make sure create/update return all relations needed by detail page.`,
  `16. src/lib/form-requirements.ts: add ${formKey} defaults and labels so required toggles work in customize mode.`,
  `17. src/lib/list-source.ts and src/lib/managed-list-registry.ts: all list fields on ${singularDisplayName} must be backed by managed/reference/system sources; no hardcoded page-local arrays.`,
  `18. src/components/SystemNotesSection.tsx + load system info/notes helpers: add bottom sections exactly like PO/detail standard.`,
  `19. Related sections: copy PO standard for child/related docs as applicable to ${flowLabel} flow (e.g. quotes->SOs->invoices for OTC, requisitions->POs->receipts/bills for PTP).`,
  `20. Export: wire PO-style detail export and list export behavior.`,
  `21. Verification: lint changed files, tsc, route smoke test, ${slug}/new load, ${slug}/[id]?edit=1 load, ${slug}/[id]?customize=1 load.`,
  '',
  'PO pattern principles to preserve:',
  '- + New is always a full page, never a modal.',
  '- Detail regular mode shows top actions: + menu, export, Customize, Edit, Delete.',
  '- Customize mode uses the same sections and grid cells as edit mode, not a separate simplified layout.',
  '- Edit mode and New mode share the same header sections and field placements.',
  '- System Notes and System Info live at the bottom.',
  '- If the transaction has lines, GL impact, or related docs, they sit in framed sections below the header area.',
  '',
  'Implementation notes:',
  '- Prefer reusing RecordDetailPageShell, PurchaseOrderHeaderSections, PurchaseOrderDetailExportButton, and the journal transaction pattern where practical.',
  '- Safe starter stubs may be generated, but existing files must never be overwritten.',
]

const starter = {
  generatedAt: new Date().toISOString(),
  entity: {
    name: displayName,
    slug,
    singularSlug,
    pascal,
    routePascal,
    constant,
    routeConstant,
    singularDisplayName,
    pluralDisplayName,
    formKey,
    flow: flowArg || null,
    flowLabel,
  },
  purchaseOrderPattern: {
    referenceRoute: 'src/app/purchase-orders/[id]/page.tsx',
    referenceNewRoute: 'src/app/purchase-orders/new/page.tsx',
    referenceCreateClient: 'src/components/PurchaseOrderCreatePageClient.tsx',
    referenceCustomizeMode: 'src/components/PurchaseOrderDetailCustomizeMode.tsx',
    referenceCustomizationLib: 'src/lib/purchase-order-detail-customization.ts',
    referenceCustomizationStore: 'src/lib/purchase-order-detail-customization-store.ts',
  },
  targetFiles: [
    `src/lib/${slug}-detail-customization.ts`,
    `src/lib/${slug}-detail-customization-store.ts`,
    `src/app/api/config/${slug}-detail-customization/route.ts`,
    `src/components/${pascal}DetailCustomizeMode.tsx`,
    `src/components/${pascal}CreatePageClient.tsx`,
    `src/components/${pascal}PageActions.tsx`,
    `src/app/${slug}/new/page.tsx`,
    `src/app/${slug}/[id]/page.tsx`,
  ],
}

function detailCustomizationStub() {
  return `export type ${detailKeyType} =
  | 'number'
  | 'date'
  | 'status'
  | 'description'

export type ${pascal}DetailFieldMeta = {
  id: ${detailKeyType}
  label: string
  fieldType: string
  source?: string
  description?: string
}

export type ${pascal}DetailFieldCustomization = {
  visible: boolean
  section: string
  order: number
  column: number
}

export type ${detailConfigType} = {
  formColumns: number
  sections: string[]
  sectionRows: Record<string, number>
  fields: Record<${detailKeyType}, ${pascal}DetailFieldCustomization>
}

export const ${detailFieldsConst}: ${pascal}DetailFieldMeta[] = [
  { id: 'number', label: '${singularDisplayName} Number', fieldType: 'text', description: 'Primary transaction identifier.' },
  { id: 'date', label: 'Date', fieldType: 'date', description: 'Transaction date.' },
  { id: 'status', label: 'Status', fieldType: 'list', description: 'Current workflow state.' },
  { id: 'description', label: 'Description', fieldType: 'text', description: 'Header memo or description.' },
]

export function default${pascal}DetailCustomization(): ${detailConfigType} {
  return {
    formColumns: 2,
    sections: ['Overview', 'Controls'],
    sectionRows: {
      Overview: 2,
      Controls: 2,
    },
    fields: {
      number: { visible: true, section: 'Overview', order: 0, column: 1 },
      date: { visible: true, section: 'Overview', order: 0, column: 2 },
      status: { visible: true, section: 'Controls', order: 0, column: 1 },
      description: { visible: true, section: 'Controls', order: 1, column: 1 },
    },
  }
}
`
}

function detailCustomizationStoreStub() {
  return `import { promises as fs } from 'fs'
import path from 'path'
import {
  default${pascal}DetailCustomization,
  ${detailFieldsConst},
  type ${detailConfigType},
} from '@/lib/${slug}-detail-customization'

const STORE_PATH = path.join(process.cwd(), 'config', '${slug}-detail-customization.json')

function cloneDefaults(): ${detailConfigType} {
  return JSON.parse(JSON.stringify(default${pascal}DetailCustomization())) as ${detailConfigType}
}

function mergeWithDefaults(overrides: Partial<${detailConfigType}>): ${detailConfigType} {
  const merged = cloneDefaults()
  if (!overrides || typeof overrides !== 'object') return merged

  if (typeof overrides.formColumns === 'number' && Number.isFinite(overrides.formColumns)) {
    merged.formColumns = Math.min(4, Math.max(1, Math.trunc(overrides.formColumns)))
  }

  if (Array.isArray(overrides.sections)) {
    const sections = overrides.sections.map((section) => String(section ?? '').trim()).filter(Boolean)
    if (sections.length > 0) merged.sections = Array.from(new Set(sections))
  }

  if (overrides.sectionRows && typeof overrides.sectionRows === 'object') {
    for (const section of merged.sections) {
      const nextValue = overrides.sectionRows[section]
      if (typeof nextValue === 'number' && Number.isFinite(nextValue)) {
        merged.sectionRows[section] = Math.min(12, Math.max(1, Math.trunc(nextValue)))
      }
    }
  }

  if (overrides.fields && typeof overrides.fields === 'object') {
    for (const field of ${detailFieldsConst}) {
      const nextField = overrides.fields[field.id]
      if (!nextField || typeof nextField !== 'object') continue
      merged.fields[field.id] = {
        visible: nextField.visible === undefined ? merged.fields[field.id].visible : nextField.visible === true,
        section: String(nextField.section ?? merged.fields[field.id].section).trim() || merged.fields[field.id].section,
        order: typeof nextField.order === 'number' && Number.isFinite(nextField.order) ? nextField.order : merged.fields[field.id].order,
        column: typeof nextField.column === 'number' && Number.isFinite(nextField.column)
          ? Math.min(merged.formColumns, Math.max(1, Math.trunc(nextField.column)))
          : merged.fields[field.id].column,
      }
    }
  }

  return merged
}

export async function load${pascal}DetailCustomization(): Promise<${detailConfigType}> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<${detailConfigType}>
    return mergeWithDefaults(parsed)
  } catch {
    return cloneDefaults()
  }
}

export async function save${pascal}DetailCustomization(nextConfig: ${detailConfigType}): Promise<${detailConfigType}> {
  const merged = mergeWithDefaults(nextConfig)
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, \`\${JSON.stringify(merged, null, 2)}\\n\`, 'utf8')
  return merged
}
`
}

function configRouteStub() {
  return `import { NextRequest, NextResponse } from 'next/server'
import {
  default${pascal}DetailCustomization,
  ${detailFieldsConst},
  type ${detailConfigType},
} from '@/lib/${slug}-detail-customization'
import {
  load${pascal}DetailCustomization,
  save${pascal}DetailCustomization,
} from '@/lib/${slug}-detail-customization-store'

function sanitizeInput(input: unknown): ${detailConfigType} {
  const defaults = default${pascal}DetailCustomization()
  if (!input || typeof input !== 'object') return defaults
  return {
    ...defaults,
    ...(input as Partial<${detailConfigType}>),
  }
}

export async function GET() {
  try {
    const config = await load${pascal}DetailCustomization()
    return NextResponse.json({ config, fields: ${detailFieldsConst} })
  } catch {
    return NextResponse.json({ error: 'Failed to load ${slug} detail customization' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const inputConfig = (body as { config?: unknown })?.config
    const sanitized = sanitizeInput(inputConfig)
    const saved = await save${pascal}DetailCustomization(sanitized)
    return NextResponse.json({ config: saved, fields: ${detailFieldsConst} })
  } catch {
    return NextResponse.json({ error: 'Failed to save ${slug} detail customization' }, { status: 500 })
  }
}
`
}

function customizeModeStub() {
  return `'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ${detailConfigType}, ${detailKeyType} } from '@/lib/${slug}-detail-customization'

type CustomizeField = {
  id: ${detailKeyType}
  label: string
  fieldType: string
  source?: string
  description?: string
  previewValue?: string
}

export default function ${pascal}DetailCustomizeMode({
  detailHref,
  initialLayout,
  initialRequirements,
  fields,
}: {
  detailHref: string
  initialLayout: ${detailConfigType}
  initialRequirements: Record<string, boolean>
  fields: CustomizeField[]
}) {
  const [layout] = useState(initialLayout)
  const [requirements] = useState(initialRequirements)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Customize Layout
            </h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Starter scaffold generated from the PO transaction pattern. Replace this starter with the live section/grid customizer before rollout.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={detailHref}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </Link>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--accent-primary-strong)' }}
            >
              Save layout
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
              <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Sections
              </h3>
              <div className="mt-3 space-y-3">
                {layout.sections.map((section) => (
                  <div key={section} className="rounded-md border p-3" style={{ borderColor: 'var(--border-muted)' }}>
                    <p className="text-sm font-medium text-white">{section}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Rows: {layout.sectionRows[section] ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-muted)' }}>
              <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Fields
              </h3>
              <div className="mt-3 space-y-3">
                {fields.map((field) => (
                  <div key={field.id} className="rounded-md border p-3" style={{ borderColor: 'var(--border-muted)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{field.label}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{field.previewValue || '-'}</p>
                        {field.description ? (
                          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{field.description}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span>{layout.fields[field.id].visible ? 'Visible' : 'Hidden'}</span>
                        <span>{requirements[field.id] ? 'Required' : 'Optional'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-4">
            {layout.sections.map((section) => {
              const sectionFields = fields.filter((field) => layout.fields[field.id].section === section && layout.fields[field.id].visible)
              return (
                <div key={section} className="rounded-xl border p-4" style={{ borderColor: 'var(--border-muted)', backgroundColor: 'var(--card)' }}>
                  <h3 className="text-sm font-semibold text-white">{section}</h3>
                  <div
                    className="mt-4 grid gap-3"
                    style={{ gridTemplateColumns: \`repeat(\${layout.formColumns}, minmax(0, 1fr))\` }}
                  >
                    {sectionFields.map((field) => (
                      <div
                        key={field.id}
                        className="rounded-md border p-3"
                        style={{
                          borderColor: 'var(--border-muted)',
                          gridColumnStart: layout.fields[field.id].column,
                          gridRowStart: layout.fields[field.id].order + 1,
                        }}
                      >
                        <p className="text-sm font-medium text-white">{field.label}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{field.previewValue || '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          TODO: replace this starter with the live PO-style customize editor (section add/rename/reorder/delete, row counts, drag/drop field placement, required toggles, and line-column controls if applicable).
        </p>
      </div>
    </div>
  )
}
`
}

function createPageClientStub() {
  return `'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import PurchaseOrderHeaderSections, { type PurchaseOrderHeaderSection } from '@/components/PurchaseOrderHeaderSections'
import type { ${detailConfigType} } from '@/lib/${slug}-detail-customization'

export default function ${pascal}CreatePageClient({
  customization,
}: {
  customization: ${detailConfigType}
}) {
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({
    number: '',
    date: '',
    status: '',
    description: '',
  })

  const headerSections: PurchaseOrderHeaderSection[] = useMemo(
    () =>
      customization.sections.map((section) => ({
        title: section,
        fields: Object.entries(customization.fields)
          .filter(([, config]) => config.visible && config.section === section)
          .sort((left, right) => {
            if (left[1].column !== right[1].column) return left[1].column - right[1].column
            return left[1].order - right[1].order
          })
          .map(([key, config]) => ({
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
            value: headerValues[key] ?? '',
            editable: true,
            type: key === 'status' ? 'select' : 'text',
            options: key === 'status' ? [{ value: 'draft', label: 'Draft' }] : undefined,
            column: config.column,
            order: config.order,
            helpText: 'Starter field generated from PO transaction scaffold.',
          })),
      })),
    [customization, headerValues]
  )

  return (
    <RecordDetailPageShell
      backHref="/${slug}"
      backLabel="<- Back to ${pluralDisplayName}"
      meta="New"
      title="New ${singularDisplayName}"
      actions={
        <>
          <Link
            href="/${slug}"
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </Link>
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Lines</p>
          <p className="mt-2 text-2xl font-semibold text-white">0</p>
        </div>
        <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Status</p>
          <p className="mt-2 text-2xl font-semibold text-white">Draft</p>
        </div>
        <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Flow</p>
          <p className="mt-2 text-lg font-semibold text-white">${flowLabel}</p>
        </div>
      </div>

      <PurchaseOrderHeaderSections
        editing
        sections={headerSections}
        columns={customization.formColumns}
        submitMode="controlled"
        onSubmit={async () => ({ ok: true })}
        onValuesChange={setHeaderValues}
      />

      <div className="mt-6 rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Related sections
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          TODO: replace this starter with the entity-specific lines, GL impact, related documents, and system-note sections copied from the PO pattern.
        </p>
      </div>
    </RecordDetailPageShell>
  )
}
`
}

function pageActionsStub() {
  return `import Link from 'next/link'
import DeleteButton from '@/components/DeleteButton'

type ${pascal}PageActionsProps = {
  recordId?: string
  detailHref: string
  editing?: boolean
  customizing?: boolean
}

export default function ${pascal}PageActions({
  recordId,
  detailHref,
  editing = false,
  customizing = false,
}: ${pascal}PageActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!editing && !customizing ? (
        <>
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            + New / Duplicate
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Export
          </button>
          <Link
            href={detailHref + '?customize=1'}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Customize
          </Link>
          <Link
            href={detailHref + '?edit=1'}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            Edit
          </Link>
          {recordId ? <DeleteButton resource="${slug}" id={recordId} /> : null}
        </>
      ) : null}

      {editing ? (
        <>
          <Link
            href={detailHref}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </Link>
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--accent-primary-strong)' }}
          >
            Save
          </button>
        </>
      ) : null}
    </div>
  )
}
`
}

function newPageStub() {
  return `import ${pascal}CreatePageClient from '@/components/${pascal}CreatePageClient'
import { load${pascal}DetailCustomization } from '@/lib/${slug}-detail-customization-store'

export default async function New${pascal}Page() {
  const customization = await load${pascal}DetailCustomization()

  return <${pascal}CreatePageClient customization={customization} />
}
`
}

function detailPageStub() {
  return `import Link from 'next/link'
import RecordDetailPageShell from '@/components/RecordDetailPageShell'
import ${pascal}DetailCustomizeMode from '@/components/${pascal}DetailCustomizeMode'
import ${pascal}PageActions from '@/components/${pascal}PageActions'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { load${pascal}DetailCustomization } from '@/lib/${slug}-detail-customization-store'
import { ${detailFieldsConst} } from '@/lib/${slug}-detail-customization'

export default async function ${pascal}DetailPage({
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
  const [customization, formRequirements] = await Promise.all([
    load${pascal}DetailCustomization(),
    loadFormRequirements(),
  ])
  const detailHref = '/${slug}/' + id

  return (
    <RecordDetailPageShell
      backHref='/${slug}'
      backLabel='<- Back to ${pluralDisplayName}'
      meta={id}
      title='${singularDisplayName} Detail'
      actions={<${pascal}PageActions recordId={id} detailHref={detailHref} editing={isEditing} customizing={isCustomizing} />}
    >
      {isCustomizing ? (
        <${pascal}DetailCustomizeMode
          detailHref={detailHref}
          initialLayout={customization}
          initialRequirements={{ ...((formRequirements as Record<string, Record<string, boolean>>)['${formKey}'] ?? {}) }}
          fields={${detailFieldsConst}.map((field) => ({ ...field, previewValue: field.label }))}
        />
      ) : (
        <div className="rounded-xl border p-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            ${singularDisplayName} Detail
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Starter stub generated from the PO transaction scaffold. Replace this with the PO-style regular/edit detail page.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href={detailHref + '?edit=1'}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Edit
            </Link>
            <Link
              href={detailHref + '?customize=1'}
              className="rounded-md border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: 'var(--border-muted)', color: 'var(--text-secondary)' }}
            >
              Customize
            </Link>
          </div>
        </div>
      )}
    </RecordDetailPageShell>
  )
}
`
}

const outputDir = path.join(repoRoot, 'docs', 'scaffolds')
const memoryPath = path.join(outputDir, `${slug}-po-transaction-scaffold.md`)
const starterPath = path.join(outputDir, `${slug}-po-transaction-scaffold.json`)

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(memoryPath, `${checklist.join('\n')}\n`, 'utf8')
fs.writeFileSync(starterPath, `${JSON.stringify(starter, null, 2)}\n`, 'utf8')

const stubResults = []
writeFileIfMissing(path.join(repoRoot, `src/lib/${slug}-detail-customization.ts`), detailCustomizationStub(), stubResults)
writeFileIfMissing(path.join(repoRoot, `src/lib/${slug}-detail-customization-store.ts`), detailCustomizationStoreStub(), stubResults)
writeFileIfMissing(path.join(repoRoot, `src/app/api/config/${slug}-detail-customization/route.ts`), configRouteStub(), stubResults)
writeFileIfMissing(path.join(repoRoot, `src/components/${pascal}DetailCustomizeMode.tsx`), customizeModeStub(), stubResults)
writeFileIfMissing(path.join(repoRoot, `src/components/${pascal}CreatePageClient.tsx`), createPageClientStub(), stubResults)
writeFileIfMissing(path.join(repoRoot, `src/components/${pascal}PageActions.tsx`), pageActionsStub(), stubResults)
writeFileIfMissing(path.join(repoRoot, `src/app/${slug}/new/page.tsx`), newPageStub(), stubResults)
writeFileIfMissing(path.join(repoRoot, `src/app/${slug}/[id]/page.tsx`), detailPageStub(), stubResults)

console.log(checklist.join('\n'))
console.log('')
console.log(`Wrote scaffold memory: ${memoryPath}`)
console.log(`Wrote starter metadata: ${starterPath}`)
console.log('')
console.log('Stub generation results:')
for (const result of stubResults) {
  console.log(`- ${result.action}: ${result.path}`)
}
