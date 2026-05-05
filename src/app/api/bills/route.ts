import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logActivity, logCommunicationActivity, logFieldChangeActivities, logRecordSnapshotActivities } from '@/lib/activity'
import { generateNextBillNumber } from '@/lib/bill-number'
import { calcLineTotal, parseMoneyValue, sumMoney } from '@/lib/money'
import { resolveVendorTransactionSnapshot } from '@/lib/transaction-snapshot-defaults'
import { generateNextJournalNumber } from '@/lib/journal-number'
import { loadCompanySetupSettings } from '@/lib/company-setup-settings-store'
import { deriveOpenItemCurrencyContext } from '@/lib/open-item-currency-context'
import { ensureOpenItemForSource } from '@/lib/open-item-service'

const INCLUDE = {
  vendor: true,
  purchaseOrder: true,
  subsidiary: true,
  currency: true,
  lineItems: {
    include: {
      item: true,
      expenseAccount: {
        select: { id: true, accountId: true, name: true },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  },
} satisfies Prisma.BillInclude

async function findBillPostingAccounts() {
  const companySettings = await loadCompanySetupSettings()

  let apAccount = companySettings.defaultApAccountId
    ? await prisma.chartOfAccounts.findFirst({
        where: {
          id: companySettings.defaultApAccountId,
          active: true,
          isPosting: true,
        },
        select: { id: true },
      })
    : null

  if (!apAccount) {
    apAccount = await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: { contains: 'liability', mode: 'insensitive' },
        OR: [
          { name: { contains: 'accounts payable', mode: 'insensitive' } },
          { name: { contains: 'a/p', mode: 'insensitive' } },
          { accountId: { contains: 'accounts payable', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  if (!apAccount) {
    apAccount = await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: { contains: 'liability', mode: 'insensitive' },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  return {
    apAccountId: apAccount?.id ?? null,
  }
}

async function postBillApprovalJournal(billId: string) {
  const existingJournal = await prisma.journalEntry.findFirst({
    where: { sourceId: billId },
    select: { id: true },
  })
  if (existingJournal) return

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: INCLUDE,
  })
  if (!bill) return

  const { apAccountId } = await findBillPostingAccounts()

  const billCurrencyContext = await deriveOpenItemCurrencyContext({
    subsidiaryId: bill.subsidiaryId ?? null,
    transactionCurrencyId: bill.currencyId ?? null,
    transactionAmount: bill.total,
    effectiveDate: bill.date,
    rateType: 'spot',
  })

  await ensureOpenItemForSource({
    openItemType: 'accounts_payable',
    accountType: 'Liability',
    accountId: apAccountId,
    subsidiaryId: bill.subsidiaryId ?? null,
    transactionCurrencyId: billCurrencyContext.transactionCurrencyId,
    localCurrencyId: billCurrencyContext.localCurrencyId,
    functionalCurrencyId: billCurrencyContext.functionalCurrencyId,
    groupCurrencyId: billCurrencyContext.groupCurrencyId,
    sourceTransactionType: 'bill',
    sourceTransactionId: bill.id,
    sourceNumber: bill.number,
    counterpartyType: 'vendor',
    counterpartyId: bill.vendorId,
    documentDate: bill.date,
    postingDate: bill.date,
    dueDate: bill.dueDate ?? null,
    originalTransactionAmount: bill.total,
    originalLocalAmount: billCurrencyContext.originalLocalAmount,
    originalFunctionalAmount: billCurrencyContext.originalFunctionalAmount,
    originalGroupAmount: billCurrencyContext.originalGroupAmount,
    memo: bill.notes ?? null,
    createdById: bill.userId ?? null,
  })

  if (existingJournal) return

  if (!apAccountId) return

  const debitLines = bill.lineItems
    .map((line, index) => {
      const quantity = Number(line.quantity ?? 0)
      const unitPrice = Number(line.unitPrice ?? 0)
      const debit = calcLineTotal(quantity, unitPrice)
      const accountId =
        line.lineType === 'expense'
          ? line.expenseAccountId
          : (line.item?.cogsExpenseAccountId ?? null)

      if (!accountId || debit <= 0) return null

      return {
        displayOrder: index,
        description: line.description || bill.number,
        memo: line.notes ?? null,
        activityTypeCode: 'expense_recognition',
        debit,
        credit: 0,
        accountId,
        subsidiaryId: bill.subsidiaryId,
        vendorId: bill.vendorId,
        itemId: line.itemId,
      }
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))

  const totalDebit = sumMoney(debitLines.map((line) => line.debit))

  if (totalDebit <= 0) return

  const lineCreates = [...debitLines]
  lineCreates.push({
    displayOrder: debitLines.length,
    description: `${bill.number} accounts payable`,
    memo: bill.notes ?? null,
    activityTypeCode: 'ap_addition',
    debit: 0,
    credit: totalDebit,
    accountId: apAccountId,
    subsidiaryId: bill.subsidiaryId,
    vendorId: bill.vendorId,
    itemId: null,
  })

  const journalNumber = await generateNextJournalNumber()

  await prisma.journalEntry.create({
    data: {
      number: journalNumber,
      date: bill.date,
      description: `Bill posting for ${bill.number}`,
      journalType: 'standard',
      status: 'approved',
      total: totalDebit,
      sourceType: 'bill',
      sourceId: bill.id,
      subsidiaryId: bill.subsidiaryId,
      currencyId: bill.currencyId,
      userId: bill.userId,
      lineItems: {
        create: lineCreates,
      },
    },
  })

  await logActivity({
    entityType: 'bill',
    entityId: bill.id,
    action: 'post',
    summary: `Posted bill ${bill.number} to GL`,
    userId: bill.userId,
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const bill = await prisma.bill.findUnique({
        where: { id },
        include: INCLUDE,
      })

      if (!bill) {
        return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
      }

      return NextResponse.json(bill)
    }

    const bills = await prisma.bill.findMany({
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(bills)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const body = await request.json()
    if (searchParams.get('action') === 'send-email') {
      const {
        billId,
        userId,
        to,
        from,
        subject,
        preview,
        attachPdf,
      } = body as {
        billId?: string
        userId?: string | null
        to?: string
        from?: string
        subject?: string
        preview?: string
        attachPdf?: boolean
      }

      if (!billId || !to?.trim() || !subject?.trim()) {
        return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
      }

      const bill = await prisma.bill.findUnique({ where: { id: billId }, select: { id: true } })
      if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

      await logCommunicationActivity({
        entityType: 'bill',
        entityId: billId,
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

    const { vendorId, vendorBillNumber, vendorBillDate, purchaseOrderId, total, date, dueDate, status, notes, subsidiaryId, currencyId, userId, lineItems } = body

    if (!vendorId || total === undefined || !date) {
      return NextResponse.json({ error: 'vendorId, total, and bill date are required' }, { status: 400 })
    }

    const number = await generateNextBillNumber()
    const nextStatus = status || 'received'
    const snapshot = await resolveVendorTransactionSnapshot(vendorId, {
      subsidiaryId,
      currencyId,
    })

    const normalizedLineItems = Array.isArray(lineItems)
      ? lineItems
          .map((line: {
            itemId?: string | null
            lineType?: string | null
            expenseAccountId?: string | null
            description?: string | null
            quantity?: number
            unitPrice?: number
            notes?: string | null
            displayOrder?: number
          }) => {
            const quantity = Math.max(1, Number(line.quantity) || 1)
            const unitPrice = Math.max(0, Number(line.unitPrice) || 0)
            const nextDescription = line.description?.trim() || ''
            return {
              lineType: line.lineType === 'expense' ? 'expense' : 'item',
              itemId: line.lineType === 'expense' ? null : line.itemId || null,
              expenseAccountId: line.lineType === 'expense' ? line.expenseAccountId || null : null,
              description: nextDescription,
              quantity,
              unitPrice,
              lineTotal: calcLineTotal(quantity, unitPrice),
              notes: line.notes?.trim() || null,
            }
          })
          .filter(
            (line: { itemId: string | null; expenseAccountId?: string | null; description: string }) =>
              line.itemId || line.expenseAccountId || line.description,
          )
      : []

    const computedTotal = normalizedLineItems.length
      ? sumMoney(normalizedLineItems.map((line: { lineTotal: number }) => line.lineTotal))
      : parseMoneyValue(total)

    const bill = await prisma.bill.create({
      data: {
        number,
        vendorId,
        vendorBillNumber: vendorBillNumber ? String(vendorBillNumber).trim() : null,
        vendorBillDate: vendorBillDate ? new Date(String(vendorBillDate)) : null,
        purchaseOrderId: purchaseOrderId || null,
        total: computedTotal,
        date: new Date(date),
        dueDate: dueDate ? new Date(dueDate) : null,
        status: nextStatus,
        notes: notes || null,
        subsidiaryId: snapshot.subsidiaryId,
        currencyId: snapshot.currencyId,
        userId: userId || null,
        lineItems: normalizedLineItems.length
          ? {
              create: normalizedLineItems.map((line: {
                lineType: string
                itemId: string | null
                expenseAccountId: string | null
                description: string
                quantity: number
                unitPrice: number
                lineTotal: number
                notes: string | null
              }) => ({
                itemId: line.itemId,
                lineType: line.lineType,
                expenseAccountId: line.expenseAccountId,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lineTotal: line.lineTotal,
                notes: line.notes,
              })),
            }
          : undefined,
      },
      include: INCLUDE,
    })

    await logActivity({
      entityType: 'bill',
      entityId: bill.id,
      action: 'create',
      summary: `Created bill ${bill.number}`,
    })
    await logRecordSnapshotActivities({
      entityType: 'bill',
      entityId: bill.id,
      userId: bill.userId ?? null,
      action: 'create',
      context: 'Header',
      fields: [
        { fieldName: 'Business Id', value: bill.number },
        { fieldName: 'Vendor', value: bill.vendorId },
        { fieldName: 'Vendor Bill Number', value: bill.vendorBillNumber },
        { fieldName: 'Vendor Bill Date', value: bill.vendorBillDate },
        { fieldName: 'Purchase Order', value: bill.purchaseOrderId },
        { fieldName: 'Total', value: bill.total },
        { fieldName: 'Bill Date', value: bill.date },
        { fieldName: 'Due Date', value: bill.dueDate },
        { fieldName: 'Status', value: bill.status },
        { fieldName: 'Notes', value: bill.notes },
        { fieldName: 'Subsidiary', value: bill.subsidiaryId },
        { fieldName: 'Currency', value: bill.currencyId },
      ],
    })

    return NextResponse.json(bill, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing bill id' }, { status: 400 })
    }

    const body = await request.json()
    const { vendorId, vendorBillNumber, vendorBillDate, purchaseOrderId, total, date, dueDate, status, notes, subsidiaryId, currencyId } = body

    const before = await prisma.bill.findUnique({ where: { id } })
    if (!before) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    if (vendorId !== undefined && !String(vendorId ?? '').trim()) {
      return NextResponse.json({ error: 'vendorId cannot be empty' }, { status: 400 })
    }

    if (date !== undefined && !String(date ?? '').trim()) {
      return NextResponse.json({ error: 'date cannot be empty' }, { status: 400 })
    }

    const bill = await prisma.bill.update({
      where: { id },
      data: {
        ...(vendorId !== undefined ? { vendorId: String(vendorId).trim() } : {}),
        ...(vendorBillNumber !== undefined ? { vendorBillNumber: vendorBillNumber ? String(vendorBillNumber).trim() : null } : {}),
        ...(vendorBillDate !== undefined ? { vendorBillDate: vendorBillDate ? new Date(String(vendorBillDate)) : null } : {}),
        ...(purchaseOrderId !== undefined ? { purchaseOrderId: purchaseOrderId ? String(purchaseOrderId).trim() : null } : {}),
        ...(total !== undefined ? { total: parseMoneyValue(total) } : {}),
        ...(date !== undefined ? { date: new Date(String(date)) } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(status !== undefined ? { status: status || 'received' } : {}),
        ...(notes !== undefined ? { notes: notes || null } : {}),
        ...(subsidiaryId !== undefined ? { subsidiaryId: subsidiaryId || null } : {}),
        ...(currencyId !== undefined ? { currencyId: currencyId || null } : {}),
      },
      include: INCLUDE,
    })

    if (before.status !== 'approved' && bill.status === 'approved') {
      await postBillApprovalJournal(bill.id)
    }

    await logActivity({
      entityType: 'bill',
      entityId: bill.id,
      action: 'update',
      summary: `Updated bill ${bill.number}`,
    })

    await logFieldChangeActivities({
      entityType: 'bill',
      entityId: bill.id,
      userId: bill.userId ?? null,
      context: 'Header',
      changes: [
        { fieldName: 'Vendor', oldValue: before.vendorId, newValue: bill.vendorId },
        { fieldName: 'Vendor Bill Number', oldValue: before.vendorBillNumber, newValue: bill.vendorBillNumber },
        { fieldName: 'Vendor Bill Date', oldValue: before.vendorBillDate, newValue: bill.vendorBillDate },
        { fieldName: 'Purchase Order', oldValue: before.purchaseOrderId, newValue: bill.purchaseOrderId },
        { fieldName: 'Total', oldValue: before.total, newValue: bill.total },
        { fieldName: 'Bill Date', oldValue: before.date, newValue: bill.date },
        { fieldName: 'Due Date', oldValue: before.dueDate, newValue: bill.dueDate },
        { fieldName: 'Status', oldValue: before.status, newValue: bill.status },
        { fieldName: 'Notes', oldValue: before.notes, newValue: bill.notes },
        { fieldName: 'Subsidiary', oldValue: before.subsidiaryId, newValue: bill.subsidiaryId },
        { fieldName: 'Currency', oldValue: before.currencyId, newValue: bill.currencyId },
      ],
    })

    return NextResponse.json(bill)
  } catch {
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing bill id' }, { status: 400 })
    }

    const existing = await prisma.bill.findUnique({ where: { id } })
    await prisma.bill.delete({ where: { id } })

    await logActivity({
      entityType: 'bill',
      entityId: id,
      action: 'delete',
      summary: `Deleted bill ${existing?.number ?? id}`,
    })
    if (existing) {
      await logRecordSnapshotActivities({
        entityType: 'bill',
        entityId: id,
        userId: existing.userId ?? null,
        action: 'delete',
        context: 'Header',
        fields: [
          { fieldName: 'Business Id', value: existing.number },
          { fieldName: 'Vendor', value: existing.vendorId },
          { fieldName: 'Vendor Bill Number', value: existing.vendorBillNumber },
          { fieldName: 'Vendor Bill Date', value: existing.vendorBillDate },
          { fieldName: 'Purchase Order', value: existing.purchaseOrderId },
          { fieldName: 'Total', value: existing.total },
          { fieldName: 'Bill Date', value: existing.date },
          { fieldName: 'Due Date', value: existing.dueDate },
          { fieldName: 'Status', value: existing.status },
          { fieldName: 'Notes', value: existing.notes },
          { fieldName: 'Subsidiary', value: existing.subsidiaryId },
          { fieldName: 'Currency', value: existing.currencyId },
        ],
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 })
  }
}
