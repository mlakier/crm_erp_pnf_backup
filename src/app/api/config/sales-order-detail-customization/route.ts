import { NextRequest, NextResponse } from 'next/server'
import {
  defaultSalesOrderDetailCustomization,
  SALES_ORDER_DETAIL_FIELDS,
  SALES_ORDER_LINE_COLUMNS,
  type SalesOrderDetailCustomizationConfig,
  type SalesOrderDetailFieldKey,
  type SalesOrderLineColumnKey,
} from '@/lib/sales-order-detail-customization'
import {
  loadSalesOrderDetailCustomization,
  saveSalesOrderDetailCustomization,
} from '@/lib/sales-order-detail-customization-store'

function sanitizeInput(input: unknown): SalesOrderDetailCustomizationConfig {
  const defaults = defaultSalesOrderDetailCustomization()
  if (!input || typeof input !== 'object') return defaults

  const root = input as Record<string, unknown>
  const formColumns =
    typeof root.formColumns === 'number' && Number.isFinite(root.formColumns)
      ? Math.min(4, Math.max(1, Math.trunc(root.formColumns)))
      : defaults.formColumns
  const sections = Array.isArray(root.sections)
    ? root.sections.map((section) => String(section ?? '').trim()).filter(Boolean)
    : defaults.sections
  const sectionRowsInput =
    root.sectionRows && typeof root.sectionRows === 'object'
      ? (root.sectionRows as Record<string, unknown>)
      : {}

  const fieldsInput =
    root.fields && typeof root.fields === 'object'
      ? (root.fields as Record<string, unknown>)
      : {}
  if (!fieldsInput.subsidiaryId && fieldsInput.entityId) {
    fieldsInput.subsidiaryId = fieldsInput.entityId
  }

  const fields = Object.fromEntries(
    SALES_ORDER_DETAIL_FIELDS.map((field) => {
      const fieldInput =
        fieldsInput[field.id] && typeof fieldsInput[field.id] === 'object'
          ? (fieldsInput[field.id] as Record<string, unknown>)
          : {}

      return [
        field.id,
        {
          visible:
            fieldInput.visible === undefined ? defaults.fields[field.id].visible : fieldInput.visible === true,
          section:
            String(fieldInput.section ?? defaults.fields[field.id].section).trim() ||
            defaults.fields[field.id].section,
          order:
            typeof fieldInput.order === 'number' && Number.isFinite(fieldInput.order)
              ? fieldInput.order
              : defaults.fields[field.id].order,
          column:
            typeof fieldInput.column === 'number' && Number.isFinite(fieldInput.column)
              ? Math.min(formColumns, Math.max(1, Math.trunc(fieldInput.column)))
              : defaults.fields[field.id].column,
        },
      ]
    })
  ) as Record<SalesOrderDetailFieldKey, SalesOrderDetailCustomizationConfig['fields'][SalesOrderDetailFieldKey]>

  const lineColumnsInput =
    root.lineColumns && typeof root.lineColumns === 'object'
      ? (root.lineColumns as Record<string, unknown>)
      : {}

  const lineColumns = Object.fromEntries(
    SALES_ORDER_LINE_COLUMNS.map((column, index) => {
      const columnInput =
        lineColumnsInput[column.id] && typeof lineColumnsInput[column.id] === 'object'
          ? (lineColumnsInput[column.id] as Record<string, unknown>)
          : {}

      return [
        column.id,
        {
          visible:
            columnInput.visible === undefined
              ? defaults.lineColumns[column.id].visible
              : columnInput.visible === true,
          order:
            typeof columnInput.order === 'number' && Number.isFinite(columnInput.order)
              ? Math.max(0, Math.trunc(columnInput.order))
              : defaults.lineColumns[column.id]?.order ?? index,
        },
      ]
    })
  ) as Record<
    SalesOrderLineColumnKey,
    SalesOrderDetailCustomizationConfig['lineColumns'][SalesOrderLineColumnKey]
  >

  const finalSections = sections.length > 0 ? Array.from(new Set(sections)) : defaults.sections

  return {
    formColumns,
    sections: finalSections,
    sectionRows: Object.fromEntries(
      finalSections.map((section) => [
        section,
        typeof sectionRowsInput[section] === 'number' && Number.isFinite(sectionRowsInput[section])
          ? Math.min(12, Math.max(1, Math.trunc(sectionRowsInput[section] as number)))
          : (defaults.sectionRows[section] ?? 2),
      ])
    ),
    fields,
    lineColumns,
  }
}

export async function GET() {
  try {
    const config = await loadSalesOrderDetailCustomization()
    return NextResponse.json({
      config,
      fields: SALES_ORDER_DETAIL_FIELDS,
      lineColumns: SALES_ORDER_LINE_COLUMNS,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to load sales order detail customization' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const inputConfig = (body as { config?: unknown })?.config
    const sanitized = sanitizeInput(inputConfig)
    const saved = await saveSalesOrderDetailCustomization(sanitized)

    return NextResponse.json({
      config: saved,
      fields: SALES_ORDER_DETAIL_FIELDS,
      lineColumns: SALES_ORDER_LINE_COLUMNS,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to save sales order detail customization' },
      { status: 500 }
    )
  }
}
