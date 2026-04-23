import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const ALL_PAGES = [
  { key: 'users', label: 'Users', group: 'Master Data' },
  { key: 'roles', label: 'Roles', group: 'Master Data' },
  { key: 'contacts', label: 'Contacts', group: 'Master Data' },
  { key: 'customers', label: 'Customers', group: 'Master Data' },
  { key: 'vendors', label: 'Vendors', group: 'Master Data' },
  { key: 'items', label: 'Items', group: 'Master Data' },
  { key: 'employees', label: 'Employees', group: 'Master Data' },
  { key: 'departments', label: 'Departments', group: 'Master Data' },
  { key: 'subsidiaries', label: 'Subsidiaries', group: 'Master Data' },
  { key: 'currencies', label: 'Currencies', group: 'Master Data' },
  { key: 'chart-of-accounts', label: 'Chart of Accounts', group: 'Master Data' },
  { key: 'leads', label: 'Leads', group: 'OTC (Order-to-Cash)', statusKey: 'LEAD-STATUS' },
  { key: 'opportunities', label: 'Opportunities', group: 'OTC (Order-to-Cash)', statusKey: 'OPP-STAGE' },
  { key: 'quotes', label: 'Quotes/Estimates', group: 'OTC (Order-to-Cash)', statusKey: 'QUOTE-STATUS' },
  { key: 'sales-orders', label: 'Sales Orders', group: 'OTC (Order-to-Cash)', statusKey: 'SO-STATUS' },
  { key: 'fulfillments', label: 'Fulfillments', group: 'OTC (Order-to-Cash)' },
  { key: 'invoices', label: 'Invoices', group: 'OTC (Order-to-Cash)', statusKey: 'INV-STATUS' },
  { key: 'invoice-receipts', label: 'Invoice Receipts', group: 'OTC (Order-to-Cash)' },
  { key: 'purchase-requisitions', label: 'Purchase Requisitions', group: 'PTP (Procure-to-Pay)', statusKey: 'REQ-STATUS' },
  { key: 'purchase-orders', label: 'Purchase Orders', group: 'PTP (Procure-to-Pay)', statusKey: 'PO-STATUS' },
  { key: 'receipts', label: 'Receipts', group: 'PTP (Procure-to-Pay)', statusKey: 'RECEIPT-STATUS' },
  { key: 'bills', label: 'Bills', group: 'PTP (Procure-to-Pay)', statusKey: 'BILL-STATUS' },
  { key: 'bill-payments', label: 'Bill Payments', group: 'PTP (Procure-to-Pay)' },
  { key: 'journals', label: 'Journals', group: 'RTR (Record-to-Report)' },
] as const

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const body = await request.json()
  const { roleName, roleDescription, statusOptions } = body as {
    roleName: string
    roleDescription?: string
    statusOptions: Record<string, string[]>
  }

  if (!roleName) {
    return NextResponse.json({ error: 'roleName is required' }, { status: 400 })
  }

  const pagesDescription = ALL_PAGES.map(p => {
    const statusKey = 'statusKey' in p ? p.statusKey : undefined
    const statuses = statusKey && statusOptions?.[statusKey]
      ? ` (statuses: ${statusOptions[statusKey].join(', ')})`
      : ''
    return `  - "${p.key}" (${p.label}, group: ${p.group})${statuses}`
  }).join('\n')

  const prompt = `You are an ERP/CRM role-based access control expert. Given a role name and optionally a description, suggest the appropriate permissions for each page in the system.

The system has these pages:
${pagesDescription}

For each page, suggest:
- canView (boolean): can the role see this page?
- canCreate (boolean): can the role create new records?
- canEdit (boolean): can the role edit existing records?
- canDelete (boolean): can the role delete records?
- blockedStates (string array): transaction statuses where editing/deleting should be BLOCKED for this role. Only include statuses for pages that have statuses listed above. A blocked state means the user CANNOT modify records in that status. Terminal/closed statuses should typically be blocked for non-admin roles. Leave empty array if no statuses should be blocked.

Role name: "${roleName}"${roleDescription ? `\nRole description: "${roleDescription}"` : ''}

Guidelines:
- Admin roles get full access everywhere, no blocked states
- View-only/readonly roles get canView only, block all statuses
- Department-specific roles (sales, purchasing, accounting) get CRUD on their domain pages, view-only on others
- Most roles should NOT be able to delete master data
- Terminal statuses (Closed, Cancelled, Void, Paid, Won, Lost, Converted, Shipped, Delivered, Posted) should typically be blocked for non-admin roles on transaction pages
- Draft/Pending statuses should usually remain editable

Respond with ONLY valid JSON, no markdown, no explanation. Format:
{
  "permissions": [
    { "page": "page-key", "canView": true, "canCreate": false, "canEdit": false, "canDelete": false, "blockedStates": [] }
  ]
}`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(text) as { permissions?: unknown }

    if (!parsed.permissions || !Array.isArray(parsed.permissions)) {
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
    }

    // Validate and sanitize: only allow known page keys
    const validKeys = new Set(ALL_PAGES.map(p => p.key))
    type PermissionSuggestion = {
      page?: unknown
      canView?: unknown
      canCreate?: unknown
      canEdit?: unknown
      canDelete?: unknown
      blockedStates?: unknown
    }
    const sanitized = parsed.permissions
      .filter((p): p is PermissionSuggestion => Boolean(p) && typeof p === 'object' && validKeys.has((p as PermissionSuggestion).page as typeof ALL_PAGES[number]['key']))
      .map((p) => ({
        page: p.page,
        canView: Boolean(p.canView),
        canCreate: Boolean(p.canCreate),
        canEdit: Boolean(p.canEdit),
        canDelete: Boolean(p.canDelete),
        blockedStates: Array.isArray(p.blockedStates) ? p.blockedStates.filter((s): s is string => typeof s === 'string') : [],
      }))

    return NextResponse.json({ permissions: sanitized })
  } catch (err: unknown) {
    console.error('AI permissions error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'AI request failed' }, { status: 500 })
  }
}
