import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getTemplateRows, isSupportedEntity } from '@/lib/master-data-import-schema'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawEntity = searchParams.get('entity') || 'currencies'

    if (!isSupportedEntity(rawEntity)) {
      return NextResponse.json({ error: 'Unsupported entity type.' }, { status: 400 })
    }

    const data = getTemplateRows(rawEntity)
    const worksheet = XLSX.utils.aoa_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')

    // Set column widths
    const colWidths = data[0].map(() => 18)
    worksheet['!cols'] = colWidths.map((width) => ({ wch: width }))

    // Convert to buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Disposition': `attachment; filename="${rawEntity}_template_${new Date().toISOString().split('T')[0]}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate template.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
