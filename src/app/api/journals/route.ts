import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity, logCommunicationActivity, logFieldChangeActivities } from '@/lib/activity'
import { moneyEquals, parseMoneyValue, sumMoney } from '@/lib/money'
import { resolveDefaultCurrencySnapshot } from '@/lib/transaction-snapshot-defaults'
import { generateNextIntercompanyJournalNumber, generateNextJournalNumber } from '@/lib/journal-number'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const row = await prisma.journalEntry.findUnique({ where: { id }, include: { subsidiary: true, currency: true, user: true, accountingPeriod: true, postedByEmployee: true, approvedByEmployee: true, lineItems: { include: { account: true, subsidiary: true, department: true, location: true, project: true, customer: true, vendor: true, item: true, employee: true }, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] } } })
    return row ? NextResponse.json(row) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const rows = await prisma.journalEntry.findMany({ include: { subsidiary: true, currency: true, user: true, accountingPeriod: true, postedByEmployee: true, approvedByEmployee: true, lineItems: { include: { account: true, subsidiary: true, department: true, location: true, project: true, customer: true, vendor: true, item: true, employee: true }, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] } }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(rows)
}

function normalizeLineItems(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((line) => {
      const candidate = line as Record<string, unknown>
      return {
        accountId: String(candidate.accountId ?? '').trim(),
        description: String(candidate.description ?? '').trim() || null,
        memo: String(candidate.memo ?? '').trim() || null,
        subsidiaryId: String(candidate.subsidiaryId ?? '').trim() || null,
        departmentId: String(candidate.departmentId ?? '').trim() || null,
        locationId: String(candidate.locationId ?? '').trim() || null,
        projectId: String(candidate.projectId ?? '').trim() || null,
        customerId: String(candidate.customerId ?? '').trim() || null,
        vendorId: String(candidate.vendorId ?? '').trim() || null,
        itemId: String(candidate.itemId ?? '').trim() || null,
        employeeId: String(candidate.employeeId ?? '').trim() || null,
        debit: parseMoneyValue(candidate.debit),
        credit: parseMoneyValue(candidate.credit),
      }
    })
    .filter((line) => line.accountId && (line.debit > 0 || line.credit > 0))
}

function validateLineItems(lineItems: Array<{ debit: number; credit: number }>) {
  if (lineItems.length === 0) return null

  for (const line of lineItems) {
    const hasDebit = line.debit > 0
    const hasCredit = line.credit > 0
    if (hasDebit && hasCredit) return 'Each journal line can have either a debit or a credit'
    if (!hasDebit && !hasCredit) return 'Each journal line must include a debit or credit amount'
  }

  const totalDebits = sumMoney(lineItems.map((line) => line.debit))
  const totalCredits = sumMoney(lineItems.map((line) => line.credit))
  return moneyEquals(totalDebits, totalCredits) ? null : 'Journal line debits and credits must balance'
}

function validateIntercompanyLineItems(
  lineItems: Array<{ debit: number; credit: number; subsidiaryId: string | null }>,
  headerSubsidiaryId: string | null | undefined,
) {
  if (lineItems.length === 0) return 'Intercompany journals require journal lines'

  const subsidiaryTotals = new Map<string, { debit: number; credit: number }>()
  for (const line of lineItems) {
    const effectiveSubsidiaryId = line.subsidiaryId ?? headerSubsidiaryId ?? null
    if (!effectiveSubsidiaryId) {
      return 'Each intercompany journal line must have a subsidiary or inherit one from the header'
    }
    const current = subsidiaryTotals.get(effectiveSubsidiaryId) ?? { debit: 0, credit: 0 }
    current.debit = sumMoney([current.debit, line.debit])
    current.credit = sumMoney([current.credit, line.credit])
    subsidiaryTotals.set(effectiveSubsidiaryId, current)
  }

  if (subsidiaryTotals.size < 2) {
    return 'Intercompany journals must span at least two subsidiaries'
  }

  for (const [, totals] of subsidiaryTotals) {
    if (!moneyEquals(totals.debit, totals.credit)) {
      return 'Each subsidiary slice in an intercompany journal must balance independently'
    }
  }

  return null
}

function formatJournalDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : '-'
}

function formatOptionLabel<T extends { id: string }>(
  values: T[],
  selectedId: string | null | undefined,
  formatter: (value: T) => string,
) {
  if (!selectedId) return '-'
  const value = values.find((entry) => entry.id === selectedId)
  return value ? formatter(value) : selectedId
}

function formatLineLabel(index: number) {
  return `Line ${index + 1}`
}

function applyDisplayOrderToLineItems<T extends Record<string, unknown>>(lineItems: T[]) {
  return lineItems.map((line, index) => ({
    ...line,
    displayOrder: index,
  }))
}

function normalizeStandardJournalLineItems<T extends { subsidiaryId: string | null }>(lineItems: T[]) {
  return lineItems.map((line) => ({
    ...line,
    subsidiaryId: null,
  }))
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('action') === 'send-email') {
    const { journalEntryId, userId, to, from, subject, preview, attachPdf } = (await req.json()) as {
      journalEntryId?: string
      userId?: string | null
      to?: string
      from?: string
      subject?: string
      preview?: string
      attachPdf?: boolean
    }

    if (!journalEntryId || !to?.trim() || !subject?.trim()) {
      return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
    }

    const journalEntry = await prisma.journalEntry.findUnique({
      where: { id: journalEntryId },
      select: { id: true },
    })
    if (!journalEntry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 })
    }

    await logCommunicationActivity({
      entityType: 'journal-entry',
      entityId: journalEntryId,
      userId: userId ?? null,
      context: 'UI',
      channel: 'Email',
      direction: 'Outbound',
      subject: subject.trim(),
      from: from?.trim() || '-',
      to: to.trim(),
      status: attachPdf ? 'Prepared (PDF)' : 'Prepared',
      preview: preview?.trim() || '',
    })

    return NextResponse.json({ success: true })
  }

  const body = await req.json()
  if (body.entityId !== undefined && body.subsidiaryId === undefined) body.subsidiaryId = body.entityId
  delete body.entityId
  body.journalType = String(body.journalType ?? '').trim() || 'standard'
  const normalizedLineItems = applyDisplayOrderToLineItems(
    body.journalType === 'intercompany'
      ? normalizeLineItems(body.lineItems)
      : normalizeStandardJournalLineItems(normalizeLineItems(body.lineItems)),
  )
  const lineValidationError = validateLineItems(normalizedLineItems)
  if (lineValidationError) {
    return NextResponse.json({ error: lineValidationError }, { status: 400 })
  }
  const intercompanyValidationError =
    body.journalType === 'intercompany'
      ? validateIntercompanyLineItems(normalizedLineItems, body.subsidiaryId ?? null)
      : null
  if (intercompanyValidationError) {
    return NextResponse.json({ error: intercompanyValidationError }, { status: 400 })
  }
  if (normalizedLineItems.length > 0) {
    body.total = sumMoney(normalizedLineItems.map((line) => line.debit))
  } else if (body.total !== undefined) {
    body.total = parseMoneyValue(body.total)
  }
  body.status = String(body.status ?? '').trim() || 'draft'
  body.number =
    String(body.number ?? '').trim() ||
    (body.journalType === 'intercompany'
      ? await generateNextIntercompanyJournalNumber()
      : await generateNextJournalNumber())
  if (body.date) body.date = new Date(body.date)
  if (body.subsidiaryId === '') body.subsidiaryId = null
  if (body.currencyId === '') body.currencyId = null
  body.currencyId = await resolveDefaultCurrencySnapshot(body.currencyId)
  if (body.accountingPeriodId === '') body.accountingPeriodId = null
  if (body.postedByEmployeeId === '') body.postedByEmployeeId = null
  if (body.approvedByEmployeeId === '') body.approvedByEmployeeId = null
  delete body.lineItems
  const row = await prisma.journalEntry.create({
    data: {
      ...body,
      ...(normalizedLineItems.length > 0
        ? {
            lineItems: {
              create: normalizedLineItems,
            },
          }
        : {}),
    },
    include: { subsidiary: true, currency: true, user: true, accountingPeriod: true, postedByEmployee: true, approvedByEmployee: true, lineItems: { include: { account: true, subsidiary: true, department: true, location: true, project: true, customer: true, vendor: true, item: true, employee: true }, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] } },
  })
  await logActivity({ entityType: 'journal-entry', entityId: row.id, action: 'Created Journal Entry', target: row.number })
  return NextResponse.json(row, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const body = await req.json()
  if (body.entityId !== undefined && body.subsidiaryId === undefined) body.subsidiaryId = body.entityId
  delete body.entityId
  const replaceLines = body.lineItems !== undefined
  const normalizedLineItems = applyDisplayOrderToLineItems(normalizeLineItems(body.lineItems))
  const lineValidationError = replaceLines ? validateLineItems(normalizedLineItems) : null
  if (lineValidationError) {
    return NextResponse.json({ error: lineValidationError }, { status: 400 })
  }
  if (body.journalType !== undefined) body.journalType = String(body.journalType ?? '').trim() || 'standard'
  if (replaceLines) {
    body.total = sumMoney(normalizedLineItems.map((line) => line.debit))
  } else if (body.total !== undefined) {
    body.total = parseMoneyValue(body.total)
  }
  if (body.number !== undefined) body.number = String(body.number ?? '').trim()
  if (body.status !== undefined) body.status = String(body.status ?? '').trim()
  if (body.date) body.date = new Date(body.date)
  if (body.subsidiaryId === '') body.subsidiaryId = null
  if (body.currencyId === '') body.currencyId = null
  if (body.accountingPeriodId === '') body.accountingPeriodId = null
  if (body.postedByEmployeeId === '') body.postedByEmployeeId = null
  if (body.approvedByEmployeeId === '') body.approvedByEmployeeId = null
  delete body.lineItems
  const existing = await prisma.journalEntry.findUnique({
    where: { id },
    include: {
      lineItems: {
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [subsidiaries, currencies, periods, employees, accounts, departments, locations, projects, customers, vendors, items] = await Promise.all([
    prisma.subsidiary.findMany({ select: { id: true, subsidiaryId: true, name: true } }),
    prisma.currency.findMany({ select: { id: true, code: true, currencyId: true, name: true } }),
    prisma.accountingPeriod.findMany({ select: { id: true, name: true } }),
    prisma.employee.findMany({ select: { id: true, employeeId: true, firstName: true, lastName: true } }),
    prisma.chartOfAccounts.findMany({ select: { id: true, accountId: true, name: true } }),
    prisma.department.findMany({ select: { id: true, departmentId: true, name: true } }),
    prisma.location.findMany({ select: { id: true, locationId: true, name: true } }),
    prisma.project.findMany({ select: { id: true, name: true } }),
    prisma.customer.findMany({ select: { id: true, customerId: true, name: true } }),
    prisma.vendor.findMany({ select: { id: true, vendorNumber: true, name: true } }),
    prisma.item.findMany({ select: { id: true, itemId: true, name: true } }),
  ])

  const normalizedNumber = body.number !== undefined ? body.number : existing.number
  const normalizedStatus = body.status !== undefined ? body.status : existing.status
  const normalizedDescription = body.description !== undefined ? body.description : existing.description
  const normalizedSubsidiaryId = body.subsidiaryId !== undefined ? body.subsidiaryId : existing.subsidiaryId
  const normalizedCurrencyId = body.currencyId !== undefined ? body.currencyId : existing.currencyId
  const normalizedAccountingPeriodId = body.accountingPeriodId !== undefined ? body.accountingPeriodId : existing.accountingPeriodId
  const normalizedSourceType = body.sourceType !== undefined ? body.sourceType : existing.sourceType
  const normalizedSourceId = body.sourceId !== undefined ? body.sourceId : existing.sourceId
  const normalizedPostedByEmployeeId = body.postedByEmployeeId !== undefined ? body.postedByEmployeeId : existing.postedByEmployeeId
  const normalizedApprovedByEmployeeId = body.approvedByEmployeeId !== undefined ? body.approvedByEmployeeId : existing.approvedByEmployeeId
  const normalizedDate = body.date !== undefined ? body.date : existing.date
  const normalizedTotal = body.total !== undefined ? body.total : existing.total
  const normalizedJournalType = body.journalType !== undefined ? body.journalType : existing.journalType
  const effectiveLineItems =
    replaceLines
      ? normalizedJournalType === 'intercompany'
        ? normalizedLineItems
        : normalizeStandardJournalLineItems(normalizedLineItems)
      : normalizedLineItems

  const intercompanyValidationError =
    normalizedJournalType === 'intercompany' && replaceLines
      ? validateIntercompanyLineItems(effectiveLineItems, normalizedSubsidiaryId ?? null)
      : null
  if (intercompanyValidationError) {
    return NextResponse.json({ error: intercompanyValidationError }, { status: 400 })
  }

  const headerChanges = [
    existing.number !== normalizedNumber ? { fieldName: 'Journal Id', oldValue: existing.number, newValue: normalizedNumber } : null,
    formatJournalDate(existing.date) !== formatJournalDate(normalizedDate) ? { fieldName: 'Date', oldValue: formatJournalDate(existing.date), newValue: formatJournalDate(normalizedDate) } : null,
    (existing.description ?? '') !== (normalizedDescription ?? '') ? { fieldName: 'Description', oldValue: existing.description ?? '-', newValue: normalizedDescription ?? '-' } : null,
    (existing.status ?? '') !== (normalizedStatus ?? '') ? { fieldName: 'Status', oldValue: existing.status ?? '-', newValue: normalizedStatus ?? '-' } : null,
    (existing.subsidiaryId ?? '') !== (normalizedSubsidiaryId ?? '') ? {
      fieldName: 'Subsidiary',
      oldValue: formatOptionLabel(subsidiaries, existing.subsidiaryId, (value) => `${value.subsidiaryId} - ${value.name}`),
      newValue: formatOptionLabel(subsidiaries, normalizedSubsidiaryId, (value) => `${value.subsidiaryId} - ${value.name}`),
    } : null,
    (existing.currencyId ?? '') !== (normalizedCurrencyId ?? '') ? {
      fieldName: 'Currency',
      oldValue: formatOptionLabel(currencies, existing.currencyId, (value) => `${value.code ?? value.currencyId} - ${value.name}`),
      newValue: formatOptionLabel(currencies, normalizedCurrencyId, (value) => `${value.code ?? value.currencyId} - ${value.name}`),
    } : null,
    (existing.accountingPeriodId ?? '') !== (normalizedAccountingPeriodId ?? '') ? {
      fieldName: 'Accounting Period',
      oldValue: formatOptionLabel(periods, existing.accountingPeriodId, (value) => value.name),
      newValue: formatOptionLabel(periods, normalizedAccountingPeriodId, (value) => value.name),
    } : null,
    (existing.sourceType ?? '') !== (normalizedSourceType ?? '') ? { fieldName: 'Source Type', oldValue: existing.sourceType ?? '-', newValue: normalizedSourceType ?? '-' } : null,
    (existing.sourceId ?? '') !== (normalizedSourceId ?? '') ? { fieldName: 'Source Id', oldValue: existing.sourceId ?? '-', newValue: normalizedSourceId ?? '-' } : null,
    (existing.postedByEmployeeId ?? '') !== (normalizedPostedByEmployeeId ?? '') ? {
      fieldName: 'Prepared By',
      oldValue: formatOptionLabel(employees, existing.postedByEmployeeId, (value) => `${value.employeeId ?? 'EMP'} - ${value.firstName} ${value.lastName}`),
      newValue: formatOptionLabel(employees, normalizedPostedByEmployeeId, (value) => `${value.employeeId ?? 'EMP'} - ${value.firstName} ${value.lastName}`),
    } : null,
    (existing.approvedByEmployeeId ?? '') !== (normalizedApprovedByEmployeeId ?? '') ? {
      fieldName: 'Approved By',
      oldValue: formatOptionLabel(employees, existing.approvedByEmployeeId, (value) => `${value.employeeId ?? 'EMP'} - ${value.firstName} ${value.lastName}`),
      newValue: formatOptionLabel(employees, normalizedApprovedByEmployeeId, (value) => `${value.employeeId ?? 'EMP'} - ${value.firstName} ${value.lastName}`),
    } : null,
    !moneyEquals(existing.total, normalizedTotal) ? { fieldName: 'Total', oldValue: existing.total.toString(), newValue: normalizedTotal.toString() } : null,
    (existing.journalType ?? 'standard') !== (normalizedJournalType ?? 'standard')
      ? { fieldName: 'Journal Type', oldValue: existing.journalType ?? 'standard', newValue: normalizedJournalType ?? 'standard' }
      : null,
  ].filter(Boolean) as Array<{ fieldName: string; oldValue: string; newValue: string }>

  const lineChanges: Array<{ context: string; fieldName: string; oldValue: string; newValue: string }> = []
  if (replaceLines) {
    const oldLines = existing.lineItems
    const maxLines = Math.max(oldLines.length, normalizedLineItems.length)
    for (let index = 0; index < maxLines; index += 1) {
      const oldLine = oldLines[index]
      const newLine = normalizedLineItems[index]
      const lineNumber = oldLine?.displayOrder ?? newLine?.displayOrder ?? index
      const context = formatLineLabel(lineNumber)
      if (!oldLine && newLine) {
        lineChanges.push({ context, fieldName: 'Line', oldValue: '-', newValue: 'Added' })
      } else if (oldLine && !newLine) {
        lineChanges.push({ context, fieldName: 'Line', oldValue: 'Present', newValue: 'Removed' })
      } else if (oldLine && newLine) {
        const changes = [
          oldLine.accountId !== newLine.accountId ? {
            fieldName: 'GL Account',
            oldValue: formatOptionLabel(accounts, oldLine.accountId, (value) => `${value.accountId} - ${value.name}`),
            newValue: formatOptionLabel(accounts, newLine.accountId, (value) => `${value.accountId} - ${value.name}`),
          } : null,
          (oldLine.description ?? '') !== (newLine.description ?? '') ? { fieldName: 'Description', oldValue: oldLine.description ?? '-', newValue: newLine.description ?? '-' } : null,
          !moneyEquals(oldLine.debit, newLine.debit) ? { fieldName: 'Debit', oldValue: oldLine.debit.toString(), newValue: newLine.debit.toString() } : null,
          !moneyEquals(oldLine.credit, newLine.credit) ? { fieldName: 'Credit', oldValue: oldLine.credit.toString(), newValue: newLine.credit.toString() } : null,
          normalizedJournalType === 'intercompany' && (oldLine.subsidiaryId ?? '') !== (newLine.subsidiaryId ?? '') ? { fieldName: 'Subsidiary', oldValue: formatOptionLabel(subsidiaries, oldLine.subsidiaryId, (value) => `${value.subsidiaryId} - ${value.name}`), newValue: formatOptionLabel(subsidiaries, newLine.subsidiaryId, (value) => `${value.subsidiaryId} - ${value.name}`) } : null,
          (oldLine.departmentId ?? '') !== (newLine.departmentId ?? '') ? { fieldName: 'Department', oldValue: formatOptionLabel(departments, oldLine.departmentId, (value) => `${value.departmentId} - ${value.name}`), newValue: formatOptionLabel(departments, newLine.departmentId, (value) => `${value.departmentId} - ${value.name}`) } : null,
          (oldLine.locationId ?? '') !== (newLine.locationId ?? '') ? { fieldName: 'Location', oldValue: formatOptionLabel(locations, oldLine.locationId, (value) => `${value.locationId} - ${value.name}`), newValue: formatOptionLabel(locations, newLine.locationId, (value) => `${value.locationId} - ${value.name}`) } : null,
          (oldLine.projectId ?? '') !== (newLine.projectId ?? '') ? { fieldName: 'Project', oldValue: formatOptionLabel(projects, oldLine.projectId, (value) => value.name), newValue: formatOptionLabel(projects, newLine.projectId, (value) => value.name) } : null,
          (oldLine.customerId ?? '') !== (newLine.customerId ?? '') ? { fieldName: 'Customer', oldValue: formatOptionLabel(customers, oldLine.customerId, (value) => `${value.customerId ?? 'CUST'} - ${value.name}`), newValue: formatOptionLabel(customers, newLine.customerId, (value) => `${value.customerId ?? 'CUST'} - ${value.name}`) } : null,
          (oldLine.vendorId ?? '') !== (newLine.vendorId ?? '') ? { fieldName: 'Vendor', oldValue: formatOptionLabel(vendors, oldLine.vendorId, (value) => `${value.vendorNumber ?? 'VEND'} - ${value.name}`), newValue: formatOptionLabel(vendors, newLine.vendorId, (value) => `${value.vendorNumber ?? 'VEND'} - ${value.name}`) } : null,
          (oldLine.itemId ?? '') !== (newLine.itemId ?? '') ? { fieldName: 'Item', oldValue: formatOptionLabel(items, oldLine.itemId, (value) => `${value.itemId ?? 'ITEM'} - ${value.name}`), newValue: formatOptionLabel(items, newLine.itemId, (value) => `${value.itemId ?? 'ITEM'} - ${value.name}`) } : null,
          (oldLine.employeeId ?? '') !== (newLine.employeeId ?? '') ? { fieldName: 'Employee', oldValue: formatOptionLabel(employees, oldLine.employeeId, (value) => `${value.employeeId ?? 'EMP'} - ${value.firstName} ${value.lastName}`), newValue: formatOptionLabel(employees, newLine.employeeId, (value) => `${value.employeeId ?? 'EMP'} - ${value.firstName} ${value.lastName}`) } : null,
          (oldLine.memo ?? '') !== (newLine.memo ?? '') ? { fieldName: 'Memo', oldValue: oldLine.memo ?? '-', newValue: newLine.memo ?? '-' } : null,
        ].filter(Boolean) as Array<{ fieldName: string; oldValue: string; newValue: string }>
        lineChanges.push(...changes.map((change) => ({ context, ...change })))
      }
    }
  }

  const row = await prisma.$transaction(async (tx) => {
      await tx.journalEntry.update({ where: { id }, data: body })
      if (replaceLines) {
        await tx.journalEntryLineItem.deleteMany({ where: { journalEntryId: id } })
      if (effectiveLineItems.length > 0) {
        await tx.journalEntryLineItem.createMany({
          data: effectiveLineItems.map((line) => ({
            journalEntryId: id,
            ...line,
          })),
        })
      }
    }
    return tx.journalEntry.findUniqueOrThrow({
      where: { id },
      include: { subsidiary: true, currency: true, user: true, accountingPeriod: true, postedByEmployee: true, approvedByEmployee: true, lineItems: { include: { account: true, subsidiary: true, department: true, location: true, project: true, customer: true, vendor: true, item: true, employee: true }, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] } },
    })
  })
  await logActivity({ entityType: 'journal-entry', entityId: row.id, action: 'Updated Journal Entry', target: row.number })
  await logFieldChangeActivities({
    entityType: 'journal-entry',
    entityId: row.id,
    userId: row.userId,
    context: 'Header',
    changes: headerChanges,
  })
  if (lineChanges.length > 0) {
    await prisma.activity.createMany({
      data: lineChanges.map((change) => ({
        entityType: 'journal-entry',
        entityId: row.id,
        action: 'update',
        summary: `FIELD_CHANGE:${JSON.stringify(change)}`,
        userId: row.userId ?? null,
      })),
    })
  }
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const row = await prisma.journalEntry.delete({ where: { id } })
  await logActivity({ entityType: 'journal-entry', entityId: id, action: 'Deleted Journal Entry', target: row.number })
  return NextResponse.json({ ok: true })
}
