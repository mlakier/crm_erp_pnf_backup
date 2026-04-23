import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateNextChartOfAccountId } from '@/lib/chart-of-account-id'

type ScopeMode = 'selected' | 'parent'

const INCLUDE = {
  parentSubsidiary: { select: { id: true, subsidiaryId: true, name: true } },
  parentAccount: { select: { id: true, accountId: true, name: true } },
  closeToAccount: { select: { id: true, accountId: true, name: true } },
  subsidiaryAssignments: {
    include: {
      subsidiary: { select: { id: true, subsidiaryId: true, name: true, parentSubsidiaryId: true } },
    },
    orderBy: { subsidiary: { subsidiaryId: 'asc' as const } },
  },
} as const

function parseBool(value: unknown) {
  return value === true || value === 'true'
}

function parseIds(value: unknown) {
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const account = await prisma.chartOfAccounts.findUnique({
        where: { id },
        include: INCLUDE,
      })
      if (!account) {
        return NextResponse.json({ error: 'Chart account not found' }, { status: 404 })
      }
      return NextResponse.json(account)
    }

    const accounts = await prisma.chartOfAccounts.findMany({
      include: INCLUDE,
      orderBy: [{ accountId: 'asc' }],
    })

    return NextResponse.json(accounts)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chart of accounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const providedAccountId = String(body?.accountId ?? '').trim()
    const accountNumber = String(body?.accountNumber ?? '').trim()
    const name = String(body?.name ?? '').trim()
    const description = String(body?.description ?? '').trim() || null
    const accountType = String(body?.accountType ?? '').trim()

    const inventory = parseBool(body?.inventory)
    const revalueOpenBalance = parseBool(body?.revalueOpenBalance)
    const eliminateIntercoTransactions = parseBool(body?.eliminateIntercoTransactions)
    const summary = parseBool(body?.summary)
    const normalBalance = String(body?.normalBalance ?? '').trim() || null
    const financialStatementSection = String(body?.financialStatementSection ?? '').trim() || null
    const financialStatementGroup = String(body?.financialStatementGroup ?? '').trim() || null
    const isPosting = body?.isPosting !== undefined ? parseBool(body?.isPosting) : !summary
    const isControlAccount = parseBool(body?.isControlAccount)
    const allowsManualPosting = body?.allowsManualPosting !== undefined ? parseBool(body?.allowsManualPosting) : true
    const requiresSubledgerType = String(body?.requiresSubledgerType ?? '').trim() || null
    const cashFlowCategory = String(body?.cashFlowCategory ?? '').trim() || null
    const parentAccountId = String(body?.parentAccountId ?? '').trim() || null
    const closeToAccountId = String(body?.closeToAccountId ?? '').trim() || null

    const scopeMode = String(body?.scopeMode ?? 'selected').trim() as ScopeMode
    const parentSubsidiaryId = String(body?.parentSubsidiaryId ?? '').trim() || null
    const includeChildren = parseBool(body?.includeChildren)
    const subsidiaryIds = parseIds(body?.subsidiaryIds)

    if (!accountNumber || !name || !accountType) {
      return NextResponse.json({ error: 'Account Number, Name, and Account Type are required' }, { status: 400 })
    }

    if (scopeMode === 'parent' && !parentSubsidiaryId) {
      return NextResponse.json({ error: 'Parent subsidiary is required for parent scope mode' }, { status: 400 })
    }

    if (scopeMode === 'selected' && subsidiaryIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one subsidiary or switch to parent scope mode' }, { status: 400 })
    }

    const accountId = providedAccountId || await generateNextChartOfAccountId()

    const created = await prisma.chartOfAccounts.create({
      data: {
        accountId,
        accountNumber,
        name,
        description,
        accountType,
        inventory,
        revalueOpenBalance,
        eliminateIntercoTransactions,
        summary,
        normalBalance,
        financialStatementSection,
        financialStatementGroup,
        isPosting,
        isControlAccount,
        allowsManualPosting,
        requiresSubledgerType,
        cashFlowCategory,
        parentAccountId,
        closeToAccountId,
        parentSubsidiaryId: scopeMode === 'parent' ? parentSubsidiaryId : null,
        includeChildren,
        subsidiaryAssignments: scopeMode === 'selected'
          ? {
              create: subsidiaryIds.map((subsidiaryId) => ({ subsidiaryId })),
            }
          : undefined,
      },
      include: INCLUDE,
    })

    return NextResponse.json(created, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create chart account' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await request.json()

    const accountId = body?.accountId !== undefined ? String(body.accountId).trim() : undefined
    const accountNumber = body?.accountNumber !== undefined ? String(body.accountNumber).trim() : undefined
    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const description = body?.description !== undefined ? (String(body.description).trim() || null) : undefined
    const accountType = body?.accountType !== undefined ? String(body.accountType).trim() : undefined

    const inventory = body?.inventory !== undefined ? parseBool(body.inventory) : undefined
    const revalueOpenBalance = body?.revalueOpenBalance !== undefined ? parseBool(body.revalueOpenBalance) : undefined
    const eliminateIntercoTransactions = body?.eliminateIntercoTransactions !== undefined ? parseBool(body.eliminateIntercoTransactions) : undefined
    const summary = body?.summary !== undefined ? parseBool(body.summary) : undefined
    const normalBalance = body?.normalBalance !== undefined ? (String(body.normalBalance).trim() || null) : undefined
    const financialStatementSection = body?.financialStatementSection !== undefined ? (String(body.financialStatementSection).trim() || null) : undefined
    const financialStatementGroup = body?.financialStatementGroup !== undefined ? (String(body.financialStatementGroup).trim() || null) : undefined
    const isPosting = body?.isPosting !== undefined ? parseBool(body.isPosting) : undefined
    const isControlAccount = body?.isControlAccount !== undefined ? parseBool(body.isControlAccount) : undefined
    const allowsManualPosting = body?.allowsManualPosting !== undefined ? parseBool(body.allowsManualPosting) : undefined
    const requiresSubledgerType = body?.requiresSubledgerType !== undefined ? (String(body.requiresSubledgerType).trim() || null) : undefined
    const cashFlowCategory = body?.cashFlowCategory !== undefined ? (String(body.cashFlowCategory).trim() || null) : undefined
    const parentAccountId = body?.parentAccountId !== undefined ? (String(body.parentAccountId).trim() || null) : undefined
    const closeToAccountId = body?.closeToAccountId !== undefined ? (String(body.closeToAccountId).trim() || null) : undefined

    const scopeMode = body?.scopeMode !== undefined ? String(body.scopeMode).trim() as ScopeMode : undefined
    const parentSubsidiaryId = body?.parentSubsidiaryId !== undefined ? (String(body.parentSubsidiaryId).trim() || null) : undefined
    const includeChildren = body?.includeChildren !== undefined ? parseBool(body.includeChildren) : undefined
    const subsidiaryIds = body?.subsidiaryIds !== undefined ? parseIds(body.subsidiaryIds) : undefined

    if (accountId !== undefined && !accountId) {
      return NextResponse.json({ error: 'Account Id cannot be empty' }, { status: 400 })
    }
    if (accountNumber !== undefined && !accountNumber) {
      return NextResponse.json({ error: 'Account Number cannot be empty' }, { status: 400 })
    }
    if (name !== undefined && !name) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    if (accountType !== undefined && !accountType) {
      return NextResponse.json({ error: 'Account Type cannot be empty' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.chartOfAccounts.update({
        where: { id },
        data: {
          ...(accountId !== undefined ? { accountId } : {}),
          ...(accountNumber !== undefined ? { accountNumber } : {}),
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(accountType !== undefined ? { accountType } : {}),
          ...(inventory !== undefined ? { inventory } : {}),
          ...(revalueOpenBalance !== undefined ? { revalueOpenBalance } : {}),
          ...(eliminateIntercoTransactions !== undefined ? { eliminateIntercoTransactions } : {}),
          ...(summary !== undefined ? { summary } : {}),
          ...(normalBalance !== undefined ? { normalBalance } : {}),
          ...(financialStatementSection !== undefined ? { financialStatementSection } : {}),
          ...(financialStatementGroup !== undefined ? { financialStatementGroup } : {}),
          ...(isPosting !== undefined ? { isPosting } : {}),
          ...(isControlAccount !== undefined ? { isControlAccount } : {}),
          ...(allowsManualPosting !== undefined ? { allowsManualPosting } : {}),
          ...(requiresSubledgerType !== undefined ? { requiresSubledgerType } : {}),
          ...(cashFlowCategory !== undefined ? { cashFlowCategory } : {}),
          ...(parentAccountId !== undefined ? { parentAccountId } : {}),
          ...(closeToAccountId !== undefined ? { closeToAccountId } : {}),
          ...(scopeMode === 'parent'
            ? {
                parentSubsidiaryId: parentSubsidiaryId ?? null,
                includeChildren: includeChildren ?? false,
              }
            : {}),
          ...(scopeMode === 'selected'
            ? {
                parentSubsidiaryId: null,
                includeChildren: includeChildren ?? false,
              }
            : {}),
          ...((scopeMode === undefined && includeChildren !== undefined) ? { includeChildren } : {}),
        },
      })

      if (scopeMode === 'selected') {
        await tx.chartOfAccountSubsidiary.deleteMany({ where: { chartOfAccountId: id } })
        if (subsidiaryIds && subsidiaryIds.length > 0) {
          await tx.chartOfAccountSubsidiary.createMany({
            data: subsidiaryIds.map((subsidiaryId) => ({ chartOfAccountId: id, subsidiaryId })),
            skipDuplicates: true,
          })
        }
      }

      if (scopeMode === 'parent') {
        await tx.chartOfAccountSubsidiary.deleteMany({ where: { chartOfAccountId: id } })
      }

      if (scopeMode === undefined && subsidiaryIds !== undefined) {
        await tx.chartOfAccounts.update({
          where: { id },
          data: { parentSubsidiaryId: null },
        })
        await tx.chartOfAccountSubsidiary.deleteMany({ where: { chartOfAccountId: id } })
        if (subsidiaryIds.length > 0) {
          await tx.chartOfAccountSubsidiary.createMany({
            data: subsidiaryIds.map((subsidiaryId) => ({ chartOfAccountId: id, subsidiaryId })),
            skipDuplicates: true,
          })
        }
      }

      return updated
    })

    const hydrated = await prisma.chartOfAccounts.findUnique({ where: { id: result.id }, include: INCLUDE })
    return NextResponse.json(hydrated)
  } catch {
    return NextResponse.json({ error: 'Failed to update chart account' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await prisma.chartOfAccounts.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete chart account' }, { status: 500 })
  }
}
