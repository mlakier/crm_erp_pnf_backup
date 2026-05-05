import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity, logCommunicationActivity, logFieldChangeActivities, logRecordSnapshotActivities } from '@/lib/activity'
import { generateNextInvoiceNumber } from '@/lib/invoice-number'
import { generateNextJournalNumber } from '@/lib/journal-number'
import { calcLineTotal, sumMoney } from '@/lib/money'
import { toNumericValue } from '@/lib/format'
import { loadCompanySetupSettings } from '@/lib/company-setup-settings-store'
import { deriveOpenItemCurrencyContext } from '@/lib/open-item-currency-context'
import { ensureOpenItemForSource } from '@/lib/open-item-service'
import {
  coerceWorkflowValueForStep,
  getDefaultWorkflowStatus,
  getWorkflowDocumentAction,
  isWorkflowActionIdAllowed,
  loadOtcWorkflowRuntime,
} from '@/lib/otc-workflow-runtime'

async function findInvoicePostingAccounts(lineItemIds: string[]) {
  const companySettings = await loadCompanySetupSettings()
  const configuredArAccountId = companySettings.defaultArAccountId.trim() || null
  const configuredArAccount = configuredArAccountId
    ? await prisma.chartOfAccounts.findFirst({
        where: {
          id: configuredArAccountId,
          active: true,
          isPosting: true,
          accountType: 'Asset',
        },
        select: { id: true, name: true },
      })
    : null

  const fallbackArAccount =
    configuredArAccount
    ?? await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Asset',
        OR: [
          { name: { contains: 'Accounts Receivable', mode: 'insensitive' } },
          { accountId: '1100' },
        ],
      },
      select: { id: true, name: true },
    })
    ?? await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Asset',
      },
      select: { id: true, name: true },
    })

  const items = lineItemIds.length
    ? await prisma.item.findMany({
        where: { id: { in: lineItemIds } },
        select: {
          id: true,
          name: true,
          directRevenuePosting: true,
          incomeAccountId: true,
          deferredRevenueAccountId: true,
        },
      })
    : []

  const incomeAccountIds = Array.from(
    new Set(items.map((item) => item.incomeAccountId).filter((accountId): accountId is string => Boolean(accountId))),
  )
  const deferredRevenueAccountIds = Array.from(
    new Set(items.map((item) => item.deferredRevenueAccountId).filter((accountId): accountId is string => Boolean(accountId))),
  )
  const accountIds = Array.from(new Set([...incomeAccountIds, ...deferredRevenueAccountIds]))
  const postingAccounts = accountIds.length
    ? await prisma.chartOfAccounts.findMany({
        where: { id: { in: accountIds }, active: true, isPosting: true },
        select: { id: true, name: true },
      })
    : []

  const incomeAccountById = new Map(postingAccounts.map((account) => [account.id, account]))
  const fallbackIncomeAccount =
    await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Revenue',
        OR: [
          { name: { contains: 'Revenue', mode: 'insensitive' } },
          { accountId: '4000' },
        ],
      },
      select: { id: true, name: true },
    })
    ?? await prisma.chartOfAccounts.findFirst({
      where: { active: true, isPosting: true, accountType: 'Revenue' },
      select: { id: true, name: true },
    })

  const fallbackDeferredRevenueAccount =
    await prisma.chartOfAccounts.findFirst({
      where: {
        active: true,
        isPosting: true,
        accountType: 'Liability',
        OR: [
          { name: { contains: 'Deferred Revenue', mode: 'insensitive' } },
          { accountId: '2200' },
        ],
      },
      select: { id: true, name: true },
    })
    ?? await prisma.chartOfAccounts.findFirst({
      where: { active: true, isPosting: true, accountType: 'Liability' },
      select: { id: true, name: true },
    })

  return {
    arAccount: fallbackArAccount,
    itemsById: new Map(items.map((item) => [item.id, item])),
    incomeAccountById,
    fallbackIncomeAccount,
    fallbackDeferredRevenueAccount,
  }
}

async function postInvoiceApprovalJournal(invoiceId: string) {
  const existingJournal = await prisma.journalEntry.findFirst({
    where: { sourceType: 'invoice', sourceId: invoiceId },
    select: { id: true },
  })

  if (existingJournal) return

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: { select: { id: true, customerId: true, name: true } },
      lineItems: {
        include: {
          item: {
            select: {
              id: true,
              itemId: true,
              name: true,
              directRevenuePosting: true,
              incomeAccountId: true,
              deferredRevenueAccountId: true,
            },
          },
        },
      },
    },
  })

  if (!invoice || !invoice.lineItems.length) return

  const lineItemIds = invoice.lineItems.map((line) => line.itemId).filter(Boolean) as string[]
  const {
    arAccount,
    itemsById,
    fallbackIncomeAccount,
    fallbackDeferredRevenueAccount,
  } = await findInvoicePostingAccounts(lineItemIds)

  const invoiceCurrencyContext = await deriveOpenItemCurrencyContext({
    subsidiaryId: invoice.subsidiaryId ?? null,
    transactionCurrencyId: invoice.currencyId ?? null,
    transactionAmount: invoice.total,
    effectiveDate: invoice.createdAt,
    rateType: 'spot',
  })

  await ensureOpenItemForSource({
    openItemType: 'accounts_receivable',
    accountType: 'Asset',
    accountId: arAccount?.id ?? null,
    subsidiaryId: invoice.subsidiaryId ?? null,
    transactionCurrencyId: invoiceCurrencyContext.transactionCurrencyId,
    localCurrencyId: invoiceCurrencyContext.localCurrencyId,
    functionalCurrencyId: invoiceCurrencyContext.functionalCurrencyId,
    groupCurrencyId: invoiceCurrencyContext.groupCurrencyId,
    sourceTransactionType: 'invoice',
    sourceTransactionId: invoice.id,
    sourceNumber: invoice.number,
    counterpartyType: 'customer',
    counterpartyId: invoice.customerId,
    documentDate: invoice.createdAt,
    postingDate: invoice.createdAt,
    dueDate: invoice.dueDate ?? null,
    originalTransactionAmount: invoice.total,
    originalLocalAmount: invoiceCurrencyContext.originalLocalAmount,
    originalFunctionalAmount: invoiceCurrencyContext.originalFunctionalAmount,
    originalGroupAmount: invoiceCurrencyContext.originalGroupAmount,
    createdById: invoice.userId ?? null,
  })

  if (existingJournal) return

  if (!arAccount) return

  const revenueLines = invoice.lineItems
    .map((line, index) => {
      const lineTotal = Number(line.lineTotal)
      if (!Number.isFinite(lineTotal) || lineTotal <= 0) return null

      const item = line.itemId ? itemsById.get(line.itemId) ?? line.item : line.item
      const useDirectRevenue = item?.directRevenuePosting !== false
      const targetAccountId = useDirectRevenue
        ? item?.incomeAccountId ?? fallbackIncomeAccount?.id ?? null
        : item?.deferredRevenueAccountId ?? fallbackDeferredRevenueAccount?.id ?? null

      if (!targetAccountId) return null

      return {
        displayOrder: index + 2,
        accountId: targetAccountId,
        activityTypeCode: useDirectRevenue ? 'revenue_recognition' : 'deferred_revenue_addition',
        debit: 0,
        credit: lineTotal,
        memo: line.description || item?.name || `Revenue for invoice ${invoice.number}`,
        customerId: invoice.customerId,
        itemId: line.itemId,
      }
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))

  const totalCredit = revenueLines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0)
  if (!revenueLines.length || totalCredit <= 0) return

  const number = await generateNextJournalNumber()

  await prisma.journalEntry.create({
    data: {
      number,
      description: `Invoice ${invoice.number} posting`,
      date: new Date(),
      status: 'approved',
      journalType: 'standard',
      total: totalCredit,
      sourceType: 'invoice',
      sourceId: invoice.id,
      subsidiaryId: invoice.subsidiaryId,
      currencyId: invoice.currencyId,
      userId: invoice.userId,
      lineItems: {
        create: [
          {
            displayOrder: 1,
            accountId: arAccount.id,
            activityTypeCode: 'ar_addition',
            debit: totalCredit,
            credit: 0,
            memo: `AR for invoice ${invoice.number}`,
            customerId: invoice.customerId,
          },
          ...revenueLines,
        ],
      },
    },
  })

  await logActivity({
    entityType: 'invoice',
    entityId: invoice.id,
    action: 'update',
    summary: `Posted invoice ${invoice.number} to GL`,
    userId: invoice.userId,
  })
}

export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        customer: true,
        salesOrder: true,
        cashReceipts: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invoices)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('action') === 'send-email') {
      const {
        invoiceId,
        userId,
        to,
        from,
        subject,
        preview,
        attachPdf,
      } = (await request.json()) as {
        invoiceId?: string
        userId?: string | null
        to?: string
        from?: string
        subject?: string
        preview?: string
        attachPdf?: boolean
      }

      if (!invoiceId || !to?.trim() || !subject?.trim()) {
        return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true },
      })

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }

      await logCommunicationActivity({
        entityType: 'invoice',
        entityId: invoiceId,
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

    const body = await request.json()
    const duplicateFrom =
      typeof body.duplicateFrom === 'string' && body.duplicateFrom.trim() ? body.duplicateFrom.trim() : null
    const salesOrderId = typeof body.salesOrderId === 'string' && body.salesOrderId.trim() ? body.salesOrderId.trim() : null
    const customerId = typeof body.customerId === 'string' && body.customerId.trim() ? body.customerId.trim() : null
    const subsidiaryId = typeof body.subsidiaryId === 'string' && body.subsidiaryId.trim() ? body.subsidiaryId.trim() : null
    const currencyId = typeof body.currencyId === 'string' && body.currencyId.trim() ? body.currencyId.trim() : null
    const workflow = await loadOtcWorkflowRuntime()
    const requestedStatus = typeof body.status === 'string' && body.status.trim() ? body.status.trim() : null
    const providedDueDate =
      typeof body.dueDate === 'string' && body.dueDate.trim() ? new Date(body.dueDate) : null
    const paidDate =
      typeof body.paidDate === 'string' && body.paidDate.trim() ? new Date(body.paidDate) : null
    const number = await generateNextInvoiceNumber()

    if (duplicateFrom) {
      const sourceInvoice = await prisma.invoice.findUnique({
        where: { id: duplicateFrom },
        include: {
          lineItems: true,
        },
      })

      if (!sourceInvoice) {
        return NextResponse.json({ error: 'Source invoice not found' }, { status: 404 })
      }

      const normalizedLineItems = sourceInvoice.lineItems.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: toNumericValue(line.unitPrice),
        lineTotal: calcLineTotal(line.quantity, line.unitPrice),
        notes: line.notes,
        itemId: line.itemId,
        departmentId: line.departmentId,
        locationId: line.locationId,
        projectId: line.projectId,
        serviceStartDate: line.serviceStartDate,
        serviceEndDate: line.serviceEndDate,
        revRecTemplateId: line.revRecTemplateId,
        performanceObligationCode: line.performanceObligationCode,
        standaloneSellingPrice: line.standaloneSellingPrice,
        allocatedAmount: line.allocatedAmount,
      }))
      const total = normalizedLineItems.length
        ? sumMoney(normalizedLineItems.map((line) => line.lineTotal))
        : toNumericValue(sourceInvoice.total)

      const invoice = await prisma.invoice.create({
        data: {
          number,
          status: getDefaultWorkflowStatus(workflow, 'invoice'),
          total,
          dueDate: providedDueDate ?? sourceInvoice.dueDate,
          paidDate: null,
          customerId: sourceInvoice.customerId,
          salesOrderId: sourceInvoice.salesOrderId,
          userId: sourceInvoice.userId,
          subsidiaryId: subsidiaryId ?? sourceInvoice.subsidiaryId,
          currencyId: currencyId ?? sourceInvoice.currencyId,
          lineItems: normalizedLineItems.length
            ? {
                create: normalizedLineItems,
              }
            : undefined,
        },
      })

      await logActivity({
        entityType: 'invoice',
        entityId: invoice.id,
        action: 'create',
        summary: `Duplicated invoice ${sourceInvoice.number} into ${invoice.number}`,
        userId: invoice.userId,
      })
      await logRecordSnapshotActivities({
        entityType: 'invoice',
        entityId: invoice.id,
        userId: invoice.userId,
        action: 'create',
        context: 'Invoice Header',
        fields: [
          { fieldName: 'Invoice #', value: invoice.number },
          { fieldName: 'Customer', value: invoice.customerId },
          { fieldName: 'Sales Order', value: invoice.salesOrderId },
          { fieldName: 'Status', value: invoice.status },
          { fieldName: 'Total', value: invoice.total },
          { fieldName: 'Due Date', value: invoice.dueDate },
          { fieldName: 'Paid Date', value: invoice.paidDate },
          { fieldName: 'Subsidiary', value: invoice.subsidiaryId },
          { fieldName: 'Currency', value: invoice.currencyId },
        ],
      })

      return NextResponse.json(invoice, { status: 201 })
    }

    if (!salesOrderId && !customerId) {
      return NextResponse.json({ error: 'Customer is required when no sales order is selected' }, { status: 400 })
    }

    if (!salesOrderId) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId! },
        select: {
          id: true,
          customerId: true,
          name: true,
          userId: true,
          subsidiaryId: true,
          currencyId: true,
        },
      })

      if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }

      const invoice = await prisma.invoice.create({
        data: {
          number,
          status: coerceWorkflowValueForStep(
            workflow,
            'invoice',
            requestedStatus || getDefaultWorkflowStatus(workflow, 'invoice'),
          ),
          total: 0,
          dueDate: providedDueDate,
          paidDate,
          customerId: customer.id,
          userId: customer.userId,
          subsidiaryId: subsidiaryId ?? customer.subsidiaryId,
          currencyId: currencyId ?? customer.currencyId,
        },
      })

      await logActivity({
        entityType: 'invoice',
        entityId: invoice.id,
        action: 'create',
        summary: `Created invoice ${invoice.number} for customer ${customer.customerId ?? customer.name}`,
        userId: customer.userId,
      })
      await logRecordSnapshotActivities({
        entityType: 'invoice',
        entityId: invoice.id,
        userId: customer.userId,
        action: 'create',
        context: 'Invoice Header',
        fields: [
          { fieldName: 'Invoice #', value: invoice.number },
          { fieldName: 'Customer', value: invoice.customerId },
          { fieldName: 'Status', value: invoice.status },
          { fieldName: 'Total', value: invoice.total },
          { fieldName: 'Due Date', value: invoice.dueDate },
          { fieldName: 'Paid Date', value: invoice.paidDate },
          { fieldName: 'Subsidiary', value: invoice.subsidiaryId },
          { fieldName: 'Currency', value: invoice.currencyId },
        ],
      })

      return NextResponse.json(invoice, { status: 201 })
    }

    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        customer: true,
        invoices: true,
        lineItems: true,
      },
    })

    if (!salesOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    if (salesOrder.invoices.length > 0) {
      return NextResponse.json({ error: 'Invoice already exists for this sales order', invoiceId: salesOrder.invoices[0].id }, { status: 409 })
    }
    const invoiceCreateAction = getWorkflowDocumentAction(workflow, 'sales-order', 'invoice', salesOrder.status)
    if (!invoiceCreateAction) {
      return NextResponse.json({ error: 'Workflow does not currently allow invoice creation from this sales order status' }, { status: 409 })
    }
    const defaultDueDate = new Date()
    defaultDueDate.setDate(defaultDueDate.getDate() + 30)
    const normalizedLineItems = salesOrder.lineItems.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: toNumericValue(line.unitPrice),
      lineTotal: calcLineTotal(line.quantity, line.unitPrice),
      notes: line.notes,
      itemId: line.itemId,
    }))
    const total = normalizedLineItems.length
      ? sumMoney(normalizedLineItems.map((line) => line.lineTotal))
      : toNumericValue(salesOrder.total)

    const invoice = await prisma.invoice.create({
        data: {
          number,
        status: coerceWorkflowValueForStep(
          workflow,
          'invoice',
          requestedStatus || invoiceCreateAction.resultStatus || getDefaultWorkflowStatus(workflow, 'invoice'),
        ),
        total,
        dueDate: providedDueDate ?? defaultDueDate,
        paidDate,
        customerId: salesOrder.customerId,
        salesOrderId: salesOrder.id,
        userId: salesOrder.userId,
        subsidiaryId: subsidiaryId ?? salesOrder.subsidiaryId,
        currencyId: currencyId ?? salesOrder.currencyId,
        lineItems: normalizedLineItems.length
          ? {
              create: normalizedLineItems,
            }
          : undefined,
      },
    })

    await logActivity({
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'create',
      summary: `Created invoice ${invoice.number} from sales order ${salesOrder.number}`,
      userId: salesOrder.userId,
    })
    await logRecordSnapshotActivities({
      entityType: 'invoice',
      entityId: invoice.id,
      userId: salesOrder.userId,
      action: 'create',
      context: 'Invoice Header',
      fields: [
        { fieldName: 'Invoice #', value: invoice.number },
        { fieldName: 'Customer', value: invoice.customerId },
        { fieldName: 'Sales Order', value: invoice.salesOrderId },
        { fieldName: 'Status', value: invoice.status },
        { fieldName: 'Total', value: invoice.total },
        { fieldName: 'Due Date', value: invoice.dueDate },
        { fieldName: 'Paid Date', value: invoice.paidDate },
        { fieldName: 'Subsidiary', value: invoice.subsidiaryId },
        { fieldName: 'Currency', value: invoice.currencyId },
      ],
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 })
    }

    const body = await request.json()
    const workflow = await loadOtcWorkflowRuntime()
    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: {
        user: { select: { userId: true } },
        subsidiary: { select: { subsidiaryId: true, name: true } },
        currency: { select: { currencyId: true, code: true, name: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const nextStatus = coerceWorkflowValueForStep(
      workflow,
      'invoice',
      typeof body.status === 'string' ? body.status : existing.status,
    )
    const nextNumber = typeof body.number === 'string' && body.number.trim() ? body.number.trim() : existing.number
    const nextSubsidiaryId =
      body.subsidiaryId === '' ? null : typeof body.subsidiaryId === 'string' ? body.subsidiaryId : existing.subsidiaryId
    const nextCurrencyId =
      body.currencyId === '' ? null : typeof body.currencyId === 'string' ? body.currencyId : existing.currencyId
    if (
      body.workflowStep === 'invoice'
      && typeof body.workflowActionId === 'string'
      && !isWorkflowActionIdAllowed(workflow, 'invoice', body.workflowActionId, existing.status, nextStatus)
    ) {
      return NextResponse.json({ error: 'Workflow transition is not allowed' }, { status: 409 })
    }

    const nextDueDate =
      body.dueDate === ''
        ? null
        : typeof body.dueDate === 'string'
          ? new Date(body.dueDate)
          : existing.dueDate
    const nextPaidDate =
      body.paidDate === ''
        ? null
        : typeof body.paidDate === 'string'
          ? new Date(body.paidDate)
          : nextStatus.toLowerCase() === 'paid'
            ? existing.paidDate ?? new Date()
            : null

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        number: nextNumber,
        status: nextStatus,
        subsidiaryId: nextSubsidiaryId,
        currencyId: nextCurrencyId,
        dueDate: nextDueDate,
        paidDate: nextStatus.toLowerCase() === 'paid' ? nextPaidDate ?? new Date() : nextPaidDate,
      },
      include: {
        user: { select: { userId: true } },
        subsidiary: { select: { subsidiaryId: true, name: true } },
        currency: { select: { currencyId: true, code: true, name: true } },
      },
    })

    const changes = [
      existing.number !== invoice.number
        ? { fieldName: 'Invoice #', oldValue: existing.number, newValue: invoice.number }
        : null,
      existing.status !== invoice.status
        ? { fieldName: 'Status', oldValue: existing.status ?? '-', newValue: invoice.status ?? '-' }
        : null,
      existing.subsidiaryId !== invoice.subsidiaryId
        ? {
            fieldName: 'Subsidiary',
            oldValue: existing.subsidiary ? `${existing.subsidiary.subsidiaryId} - ${existing.subsidiary.name}` : '-',
            newValue: invoice.subsidiary ? `${invoice.subsidiary.subsidiaryId} - ${invoice.subsidiary.name}` : '-',
          }
        : null,
      existing.currencyId !== invoice.currencyId
        ? {
            fieldName: 'Currency',
            oldValue: existing.currency ? `${existing.currency.code ?? existing.currency.currencyId} - ${existing.currency.name}` : '-',
            newValue: invoice.currency ? `${invoice.currency.code ?? invoice.currency.currencyId} - ${invoice.currency.name}` : '-',
          }
        : null,
      String(existing.dueDate ?? '') !== String(invoice.dueDate ?? '')
        ? {
            fieldName: 'Due Date',
            oldValue: existing.dueDate ? existing.dueDate.toISOString() : '-',
            newValue: invoice.dueDate ? invoice.dueDate.toISOString() : '-',
          }
        : null,
      String(existing.paidDate ?? '') !== String(invoice.paidDate ?? '')
        ? {
            fieldName: 'Paid Date',
            oldValue: existing.paidDate ? existing.paidDate.toISOString() : '-',
            newValue: invoice.paidDate ? invoice.paidDate.toISOString() : '-',
          }
        : null,
    ].filter((change): change is { fieldName: string; oldValue: string; newValue: string } => Boolean(change))

    await logActivity({
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'update',
      summary: `Updated invoice ${invoice.number} to status ${invoice.status}`,
      userId: existing.userId,
    })

    await logFieldChangeActivities({
      entityType: 'invoice',
      entityId: invoice.id,
      userId: existing.userId,
      context: 'Header',
      changes,
    })

    if (existing.status !== 'approved' && invoice.status === 'approved') {
      await postInvoiceApprovalJournal(invoice.id)
    }

    return NextResponse.json(invoice)
  } catch {
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 })
    }

    const existing = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        userId: true,
        salesOrder: { select: { userId: true } },
        cashReceipts: { select: { number: true, id: true }, orderBy: { createdAt: 'asc' } },
        creditMemos: { select: { number: true }, orderBy: { createdAt: 'asc' } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const childRecords = [
      ...existing.cashReceipts.map((receipt) => `Invoice Receipt ${receipt.number ?? receipt.id}`),
      ...existing.creditMemos.map((creditMemo) => `Credit Memo ${creditMemo.number}`),
    ]

    if (childRecords.length) {
      return NextResponse.json(
        { error: `Transaction has the following child records:\n\n${childRecords.join('\n')}` },
        { status: 409 },
      )
    }

    await prisma.$transaction([
      prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } }),
      prisma.invoice.delete({ where: { id } }),
    ])

    await logActivity({
      entityType: 'invoice',
      entityId: id,
      action: 'delete',
      summary: `Deleted invoice ${existing.number}`,
      userId: existing.userId ?? existing.salesOrder?.userId,
    })
    await logRecordSnapshotActivities({
      entityType: 'invoice',
      entityId: id,
      userId: existing.userId ?? existing.salesOrder?.userId,
      action: 'delete',
      context: 'Invoice Header',
      fields: [
        { fieldName: 'Invoice #', value: existing.number },
      ],
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
