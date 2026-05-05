import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity, logCommunicationActivity, logFieldChangeActivities, logRecordSnapshotActivities } from '@/lib/activity'
import { generateNextLeadNumber } from '@/lib/lead-number'
import { normalizePhone } from '@/lib/format'
import {
  coerceWorkflowValueForStep,
  getDefaultWorkflowStatus,
  getFirstMatchingAutoWorkflowTransition,
  getWorkflowTransitionById,
  isWorkflowActionIdAllowed,
  loadOtcWorkflowRuntime,
} from '@/lib/otc-workflow-runtime'
import {
  createPendingWorkflowEmailApproval,
  deletePendingWorkflowEmailApproval,
  sendWorkflowApprovalEmail,
} from '@/lib/workflow-email-approval'

function resolveLeadLabel(lead: {
  leadNumber?: string | null
  company?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}) {
  const personName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  return lead.company || personName || lead.email || lead.leadNumber || 'lead'
}

function hasLeadIdentity(body: {
  company?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}) {
  const personName = [body.firstName, body.lastName].filter(Boolean).join(' ').trim()
  return Boolean(body.company || personName || body.email)
}

function resolveLeadApprovalRecipient(args: {
  recipientSource: string
  recipientAddress: string
  leadEmail: string | null
  ownerEmail: string | null
  customerEmail: string | null
}) {
  switch (args.recipientSource) {
    case 'specific_email':
      return args.recipientAddress.trim() || null
    case 'lead_email':
      return args.leadEmail?.trim() || null
    case 'record_owner':
    case 'record_owner_email':
      return args.ownerEmail?.trim() || null
    case 'customer_email':
      return args.customerEmail?.trim() || null
    default:
      return null
  }
}

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        subsidiary: true,
        currency: true,
        customer: true,
        contact: true,
        opportunity: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(leads)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('action') === 'send-email') {
      const {
        leadId,
        userId,
        to,
        from,
        subject,
        preview,
        attachPdf,
      } = (await request.json()) as {
        leadId?: string
        userId?: string | null
        to?: string
        from?: string
        subject?: string
        preview?: string
        attachPdf?: boolean
      }

      if (!leadId || !to?.trim() || !subject?.trim()) {
        return NextResponse.json({ error: 'Missing required email fields' }, { status: 400 })
      }

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true },
      })

      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      }

      await logCommunicationActivity({
        entityType: 'lead',
        entityId: leadId,
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
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      title,
      website,
      industry,
      address,
      status,
      source,
      rating,
      notes,
      expectedValue,
      entityId,
      subsidiaryId: bodySubsidiaryId,
      currencyId,
      userId,
      qualifiedAt,
      convertedAt,
      lastContactedAt,
    } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (!hasLeadIdentity({ company, firstName, lastName, email })) {
      return NextResponse.json({ error: 'Company, contact name, or email is required' }, { status: 400 })
    }

    const workflow = await loadOtcWorkflowRuntime()
    const leadNumber = await generateNextLeadNumber()
    let nextStatus = coerceWorkflowValueForStep(
      workflow,
      'lead',
      typeof status === 'string' && status.trim() ? status.trim() : getDefaultWorkflowStatus(workflow, 'lead'),
    )
    if (!(typeof status === 'string' && status.trim())) {
      const autoTransition = getFirstMatchingAutoWorkflowTransition(workflow, 'lead', nextStatus, {
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        phone: normalizePhone(phone),
        company: company || null,
        title: title || null,
        website: website || null,
        industry: industry || null,
        address: address || null,
        source: source || null,
        rating: rating || null,
        notes: notes || null,
      })
      if (autoTransition) {
        nextStatus = coerceWorkflowValueForStep(workflow, 'lead', autoTransition.toStatus)
      }
    }

    const lead = await prisma.lead.create({
      data: {
        leadNumber,
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        phone: normalizePhone(phone),
        company: company || null,
        title: title || null,
        website: website || null,
        industry: industry || null,
        address: address || null,
        status: nextStatus,
        source: source || null,
        rating: rating || null,
        notes: notes || null,
        expectedValue: expectedValue === '' || expectedValue == null ? null : Number(expectedValue),
        subsidiaryId: bodySubsidiaryId || entityId || null,
        currencyId: currencyId || null,
        userId,
        qualifiedAt: qualifiedAt ? new Date(qualifiedAt) : null,
        convertedAt: convertedAt ? new Date(convertedAt) : null,
        lastContactedAt: lastContactedAt ? new Date(lastContactedAt) : null,
      },
    })

    await logActivity({
      entityType: 'lead',
      entityId: lead.id,
      action: 'create',
      summary: `Created lead ${lead.leadNumber ?? resolveLeadLabel(lead)} ${resolveLeadLabel(lead)}`,
      userId,
    })
    await logRecordSnapshotActivities({
      entityType: 'lead',
      entityId: lead.id,
      userId,
      action: 'create',
      context: 'Lead Header',
      fields: [
        { fieldName: 'Lead #', value: lead.leadNumber },
        { fieldName: 'First Name', value: lead.firstName },
        { fieldName: 'Last Name', value: lead.lastName },
        { fieldName: 'Email', value: lead.email },
        { fieldName: 'Phone', value: lead.phone },
        { fieldName: 'Company', value: lead.company },
        { fieldName: 'Title', value: lead.title },
        { fieldName: 'Website', value: lead.website },
        { fieldName: 'Industry', value: lead.industry },
        { fieldName: 'Address', value: lead.address },
        { fieldName: 'Status', value: lead.status },
        { fieldName: 'Source', value: lead.source },
        { fieldName: 'Rating', value: lead.rating },
        { fieldName: 'Expected Value', value: lead.expectedValue },
        { fieldName: 'Subsidiary', value: lead.subsidiaryId },
        { fieldName: 'Currency', value: lead.currencyId },
        { fieldName: 'Qualified At', value: lead.qualifiedAt },
        { fieldName: 'Converted At', value: lead.convertedAt },
        { fieldName: 'Last Contacted', value: lead.lastContactedAt },
        { fieldName: 'Notes', value: lead.notes },
      ],
    })

    return NextResponse.json(lead, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 })

    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      title,
      website,
      industry,
      address,
      status,
      source,
      rating,
      notes,
      expectedValue,
      entityId,
      subsidiaryId: bodySubsidiaryId,
      currencyId,
      qualifiedAt,
      convertedAt,
      lastContactedAt,
      workflowStep,
      workflowActionId,
    } = body

    const existing = await prisma.lead.findUnique({
      where: { id },
      include: {
        subsidiary: true,
        currency: true,
        customer: true,
        contact: true,
        opportunity: true,
        user: {
          select: {
            id: true,
            email: true,
            userId: true,
            name: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const nextFirstName = firstName === undefined ? existing.firstName : firstName || null
    const nextLastName = lastName === undefined ? existing.lastName : lastName || null
    const nextEmail = email === undefined ? existing.email : email || null
    const nextCompany = company === undefined ? existing.company : company || null

    if (!hasLeadIdentity({ company: nextCompany, firstName: nextFirstName, lastName: nextLastName, email: nextEmail })) {
      return NextResponse.json({ error: 'Company, contact name, or email is required' }, { status: 400 })
    }

    const workflow = await loadOtcWorkflowRuntime()
    let nextStatus = coerceWorkflowValueForStep(
      workflow,
      'lead',
      typeof status === 'string' ? status : existing.status,
    )

    if (
      workflowStep === 'lead'
      && typeof workflowActionId === 'string'
      && !isWorkflowActionIdAllowed(workflow, 'lead', workflowActionId, existing.status, nextStatus)
    ) {
      return NextResponse.json({ error: 'Workflow transition is not allowed' }, { status: 409 })
    }

    const workflowTransition =
      workflowStep === 'lead' && typeof workflowActionId === 'string'
        ? getWorkflowTransitionById(workflow, workflowActionId)
        : null

    if (workflowTransition?.actionType === 'send_approval_email') {
      if (!workflowTransition.integrationKey) {
        return NextResponse.json({ error: 'Approval email integration is not configured on this workflow transition' }, { status: 400 })
      }
      if (!workflowTransition.successStatus || !workflowTransition.declineStatus) {
        return NextResponse.json({ error: 'Approval email transitions require On Success and On Decline statuses' }, { status: 400 })
      }

      const recipientEmail = resolveLeadApprovalRecipient({
        recipientSource: workflowTransition.recipientSource,
        recipientAddress: workflowTransition.recipientAddress,
        leadEmail: nextEmail,
        ownerEmail: existing.user?.email ?? null,
        customerEmail: existing.customer?.email ?? null,
      })

      if (!recipientEmail) {
        return NextResponse.json({ error: 'Could not resolve an approval recipient email for this transition' }, { status: 400 })
      }

      const origin = new URL(request.url).origin
      const approvalMetadata = await createPendingWorkflowEmailApproval({
        step: 'lead',
        transitionId: workflowTransition.id,
        entityType: 'lead',
        entityId: existing.id,
        entityLabel: existing.leadNumber ?? resolveLeadLabel({
          leadNumber: existing.leadNumber,
          company: nextCompany,
          firstName: nextFirstName,
          lastName: nextLastName,
          email: nextEmail,
        }),
        detailPath: `/leads/${existing.id}`,
        requestedStatus: nextStatus,
        successStatus: workflowTransition.successStatus,
        declineStatus: workflowTransition.declineStatus,
        recipientEmail,
        recipientSource: workflowTransition.recipientSource,
        integrationKey: workflowTransition.integrationKey,
        templateKey: workflowTransition.templateKey,
      })

      try {
        await sendWorkflowApprovalEmail({
          origin,
          metadata: approvalMetadata,
        })
      } catch (error) {
        await deletePendingWorkflowEmailApproval(approvalMetadata.token)
        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : 'Failed to send approval email',
          },
          { status: 502 },
        )
      }

      await logCommunicationActivity({
        entityType: 'lead',
        entityId: existing.id,
        userId: existing.userId,
        context: 'Workflow Approval',
        channel: 'Email',
        direction: 'Outbound',
        subject: `Approval requested: ${approvalMetadata.entityLabel}`,
        from: 'Workflow',
        to: recipientEmail,
        status: 'Sent',
        preview: `Awaiting approval for ${approvalMetadata.entityLabel}`,
      })
    }

    if (status === undefined && typeof workflowActionId !== 'string') {
      const autoTransition = getFirstMatchingAutoWorkflowTransition(workflow, 'lead', nextStatus, {
        firstName: nextFirstName,
        lastName: nextLastName,
        email: nextEmail,
        phone: phone === undefined ? existing.phone : normalizePhone(phone),
        company: nextCompany,
        title: title === undefined ? existing.title : title || null,
        website: website === undefined ? existing.website : website || null,
        industry: industry === undefined ? existing.industry : industry || null,
        address: address === undefined ? existing.address : address || null,
        source: source === undefined ? existing.source : source || null,
        rating: rating === undefined ? existing.rating : rating || null,
        notes: notes === undefined ? existing.notes : notes || null,
      })
      if (autoTransition) {
        nextStatus = coerceWorkflowValueForStep(workflow, 'lead', autoTransition.toStatus)
      }
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        firstName: nextFirstName,
        lastName: nextLastName,
        email: nextEmail,
        phone: phone === undefined ? existing.phone : normalizePhone(phone),
        company: nextCompany,
        title: title === undefined ? existing.title : title || null,
        website: website === undefined ? existing.website : website || null,
        industry: industry === undefined ? existing.industry : industry || null,
        address: address === undefined ? existing.address : address || null,
        status: nextStatus,
        source: source === undefined ? existing.source : source || null,
        rating: rating === undefined ? existing.rating : rating || null,
        notes: notes === undefined ? existing.notes : notes || null,
        expectedValue: expectedValue === undefined ? existing.expectedValue : expectedValue === '' || expectedValue == null ? null : Number(expectedValue),
        subsidiaryId: bodySubsidiaryId === undefined && entityId === undefined ? existing.subsidiaryId : bodySubsidiaryId || entityId || null,
        currencyId: currencyId === undefined ? existing.currencyId : currencyId || null,
        qualifiedAt: qualifiedAt === undefined ? existing.qualifiedAt : qualifiedAt ? new Date(qualifiedAt) : null,
        convertedAt: convertedAt === undefined ? existing.convertedAt : convertedAt ? new Date(convertedAt) : null,
        lastContactedAt: lastContactedAt === undefined ? existing.lastContactedAt : lastContactedAt ? new Date(lastContactedAt) : null,
      },
      include: {
        subsidiary: true,
        currency: true,
        customer: true,
        contact: true,
        opportunity: true,
      },
    })

    await logActivity({
      entityType: 'lead',
      entityId: lead.id,
      action: 'update',
      summary: `Updated lead ${lead.leadNumber ?? resolveLeadLabel(lead)} ${resolveLeadLabel(lead)}`,
      userId: lead.userId,
    })

    const fieldChanges = [
      ['First Name', existing.firstName ?? '', lead.firstName ?? ''],
      ['Last Name', existing.lastName ?? '', lead.lastName ?? ''],
      ['Email', existing.email ?? '', lead.email ?? ''],
      ['Phone', existing.phone ?? '', lead.phone ?? ''],
      ['Company', existing.company ?? '', lead.company ?? ''],
      ['Title', existing.title ?? '', lead.title ?? ''],
      ['Website', existing.website ?? '', lead.website ?? ''],
      ['Industry', existing.industry ?? '', lead.industry ?? ''],
      ['Address', existing.address ?? '', lead.address ?? ''],
      ['Status', existing.status ?? '', lead.status ?? ''],
      ['Source', existing.source ?? '', lead.source ?? ''],
      ['Rating', existing.rating ?? '', lead.rating ?? ''],
      ['Expected Value', existing.expectedValue?.toString() ?? '', lead.expectedValue?.toString() ?? ''],
      ['Subsidiary', existing.subsidiary?.subsidiaryId ?? '', lead.subsidiary?.subsidiaryId ?? ''],
      ['Currency', existing.currency?.code ?? existing.currency?.currencyId ?? '', lead.currency?.code ?? lead.currency?.currencyId ?? ''],
      ['Last Contacted', existing.lastContactedAt?.toISOString() ?? '', lead.lastContactedAt?.toISOString() ?? ''],
      ['Qualified At', existing.qualifiedAt?.toISOString() ?? '', lead.qualifiedAt?.toISOString() ?? ''],
      ['Converted At', existing.convertedAt?.toISOString() ?? '', lead.convertedAt?.toISOString() ?? ''],
      ['Notes', existing.notes ?? '', lead.notes ?? ''],
      ['Customer', existing.customer?.customerId ?? '', lead.customer?.customerId ?? ''],
      ['Contact', existing.contact?.contactNumber ?? '', lead.contact?.contactNumber ?? ''],
      ['Opportunity', existing.opportunity?.opportunityNumber ?? '', lead.opportunity?.opportunityNumber ?? ''],
    ]
      .filter(([, oldValue, newValue]) => oldValue !== newValue)
      .map(([fieldName, oldValue, newValue]) => ({
        fieldName,
        oldValue,
        newValue,
      }))

    await logFieldChangeActivities({
      entityType: 'lead',
      entityId: lead.id,
      userId: lead.userId,
      context: 'Lead Header',
      changes: fieldChanges,
    })

    return NextResponse.json(lead)
  } catch {
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 })

    const existing = await prisma.lead.findUnique({ where: { id } })
    await prisma.lead.delete({ where: { id } })

    await logActivity({
      entityType: 'lead',
      entityId: id,
      action: 'delete',
      summary: `Deleted lead ${existing ? resolveLeadLabel(existing) : id}`,
      userId: existing?.userId,
    })
    if (existing) {
      await logRecordSnapshotActivities({
        entityType: 'lead',
        entityId: id,
        userId: existing.userId ?? null,
        action: 'delete',
        context: 'Lead Header',
        fields: [
          { fieldName: 'Lead #', value: existing.leadNumber },
          { fieldName: 'First Name', value: existing.firstName },
          { fieldName: 'Last Name', value: existing.lastName },
          { fieldName: 'Email', value: existing.email },
          { fieldName: 'Phone', value: existing.phone },
          { fieldName: 'Company', value: existing.company },
          { fieldName: 'Title', value: existing.title },
          { fieldName: 'Website', value: existing.website },
          { fieldName: 'Industry', value: existing.industry },
          { fieldName: 'Address', value: existing.address },
          { fieldName: 'Status', value: existing.status },
          { fieldName: 'Source', value: existing.source },
          { fieldName: 'Rating', value: existing.rating },
          { fieldName: 'Expected Value', value: existing.expectedValue },
          { fieldName: 'Subsidiary', value: existing.subsidiaryId },
          { fieldName: 'Currency', value: existing.currencyId },
          { fieldName: 'Qualified At', value: existing.qualifiedAt },
          { fieldName: 'Converted At', value: existing.convertedAt },
          { fieldName: 'Last Contacted', value: existing.lastContactedAt },
          { fieldName: 'Notes', value: existing.notes },
        ],
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
