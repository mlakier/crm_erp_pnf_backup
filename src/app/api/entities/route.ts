import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateNextSubsidiaryCode } from '@/lib/subsidiary-code'

export async function GET() {
  const data = await prisma.subsidiary.findMany({ include: { defaultCurrency: true, functionalCurrency: true, reportingCurrency: true, parentSubsidiary: true, retainedEarningsAccount: true, ctaAccount: true, intercompanyClearingAccount: true, dueToAccount: true, dueFromAccount: true }, orderBy: { subsidiaryId: 'asc' } })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = String(body?.name ?? '').trim()
    const legalName = String(body?.legalName ?? '').trim() || null
    const entityType = String(body?.entityType ?? '').trim() || null
    const country = String(body?.country ?? '').trim() || null
    const address = String(body?.address ?? '').trim() || null
    const taxId = String(body?.taxId ?? '').trim() || null
    const registrationNumber = String(body?.registrationNumber ?? '').trim() || null
    const defaultCurrencyId = String(body?.defaultCurrencyId ?? '').trim() || null
    const functionalCurrencyId = String(body?.functionalCurrencyId ?? '').trim() || null
    const reportingCurrencyId = String(body?.reportingCurrencyId ?? '').trim() || null
    const parentSubsidiaryId = String(body?.parentSubsidiaryId ?? '').trim() || null
    const consolidationMethod = String(body?.consolidationMethod ?? '').trim() || null
    const ownershipPercentRaw = String(body?.ownershipPercent ?? '').trim()
    const ownershipPercent = ownershipPercentRaw ? Number(body?.ownershipPercent) : null
    const retainedEarningsAccountId = String(body?.retainedEarningsAccountId ?? '').trim() || null
    const ctaAccountId = String(body?.ctaAccountId ?? '').trim() || null
    const intercompanyClearingAccountId = String(body?.intercompanyClearingAccountId ?? '').trim() || null
    const dueToAccountId = String(body?.dueToAccountId ?? '').trim() || null
    const dueFromAccountId = String(body?.dueFromAccountId ?? '').trim() || null
    const inactive = String(body?.inactive ?? 'false').trim().toLowerCase() === 'true'
    const code = await generateNextSubsidiaryCode()

    if (!name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    }

    const created = await prisma.subsidiary.create({
      data: {
        subsidiaryId: code,
        name,
        legalName,
        entityType,
        country,
        address,
        taxId,
        registrationNumber,
        defaultCurrencyId,
        functionalCurrencyId,
        reportingCurrencyId,
        parentSubsidiaryId,
        consolidationMethod,
        ownershipPercent,
        retainedEarningsAccountId,
        ctaAccountId,
        intercompanyClearingAccountId,
        dueToAccountId,
        dueFromAccountId,
        active: !inactive,
      },
      include: { defaultCurrency: true, functionalCurrency: true, reportingCurrency: true, parentSubsidiary: true, retainedEarningsAccount: true, ctaAccount: true, intercompanyClearingAccount: true, dueToAccount: true, dueFromAccount: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: `Unable to create subsidiary: ${message}` }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const body = await request.json()
    const code = body?.code !== undefined ? String(body.code).trim().toUpperCase() : (body?.subsidiaryId !== undefined ? String(body.subsidiaryId).trim().toUpperCase() : undefined)
    const name = body?.name !== undefined ? String(body.name).trim() : undefined
    const legalName = body?.legalName !== undefined ? (String(body.legalName).trim() || null) : undefined
    const entityType = body?.entityType !== undefined ? (String(body.entityType).trim() || null) : undefined
    const country = body?.country !== undefined ? (String(body.country).trim() || null) : undefined
    const address = body?.address !== undefined ? (String(body.address).trim() || null) : undefined
    const defaultCurrencyId = body?.defaultCurrencyId !== undefined ? (String(body.defaultCurrencyId).trim() || null) : undefined
    const functionalCurrencyId = body?.functionalCurrencyId !== undefined ? (String(body.functionalCurrencyId).trim() || null) : undefined
    const reportingCurrencyId = body?.reportingCurrencyId !== undefined ? (String(body.reportingCurrencyId).trim() || null) : undefined
    const parentSubsidiaryId = body?.parentSubsidiaryId !== undefined ? (String(body.parentSubsidiaryId).trim() || null) : undefined
    const taxId = body?.taxId !== undefined ? (String(body.taxId).trim() || null) : undefined
    const registrationNumber = body?.registrationNumber !== undefined ? (String(body.registrationNumber).trim() || null) : undefined
    const consolidationMethod = body?.consolidationMethod !== undefined ? (String(body.consolidationMethod).trim() || null) : undefined
    const ownershipPercent = body?.ownershipPercent !== undefined ? (String(body.ownershipPercent).trim() ? Number(body.ownershipPercent) : null) : undefined
    const retainedEarningsAccountId = body?.retainedEarningsAccountId !== undefined ? (String(body.retainedEarningsAccountId).trim() || null) : undefined
    const ctaAccountId = body?.ctaAccountId !== undefined ? (String(body.ctaAccountId).trim() || null) : undefined
    const intercompanyClearingAccountId = body?.intercompanyClearingAccountId !== undefined ? (String(body.intercompanyClearingAccountId).trim() || null) : undefined
    const dueToAccountId = body?.dueToAccountId !== undefined ? (String(body.dueToAccountId).trim() || null) : undefined
    const dueFromAccountId = body?.dueFromAccountId !== undefined ? (String(body.dueFromAccountId).trim() || null) : undefined
    const inactive = body?.inactive !== undefined
      ? String(body.inactive).trim().toLowerCase() === 'true'
      : undefined
    const active = inactive !== undefined
      ? !inactive
      : body?.active !== undefined
        ? String(body.active).trim().toLowerCase() === 'true'
        : undefined

    if (parentSubsidiaryId !== undefined && parentSubsidiaryId === id) {
      return NextResponse.json({ error: 'A subsidiary cannot be its own parent.' }, { status: 400 })
    }

    const updated = await prisma.subsidiary.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries({ subsidiaryId: code, name, legalName, entityType, country, address, defaultCurrencyId, functionalCurrencyId, reportingCurrencyId, parentSubsidiaryId, taxId, registrationNumber, consolidationMethod, ownershipPercent, retainedEarningsAccountId, ctaAccountId, intercompanyClearingAccountId, dueToAccountId, dueFromAccountId, active }).filter(([, v]) => v !== undefined)
      ),
      include: { defaultCurrency: true, functionalCurrency: true, reportingCurrency: true, parentSubsidiary: true, retainedEarningsAccount: true, ctaAccount: true, intercompanyClearingAccount: true, dueToAccount: true, dueFromAccount: true },
    })
    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: `Unable to update subsidiary: ${message}` }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await prisma.subsidiary.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error'
    return NextResponse.json({ error: `Unable to delete subsidiary: ${message}` }, { status: 500 })
  }
}
