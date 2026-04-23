import { prisma } from '@/lib/prisma'
import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import CustomerCreateForm from '@/components/CustomerCreateForm'
import { loadListOptionsForSource } from '@/lib/list-source'
import { loadCustomerFormCustomization } from '@/lib/customer-form-customization-store'
import { loadFormRequirements } from '@/lib/form-requirements-store'

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [adminUser, subsidiaries, currencies, industryOptions, inactiveOptions, formCustomization, formRequirements, duplicateCustomer] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'admin@example.com' } }),
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, currencyId: true, code: true, name: true } }),
    loadListOptionsForSource({ sourceType: 'managed-list', sourceKey: 'LIST-CUST-INDUSTRY' }),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    loadCustomerFormCustomization(),
    loadFormRequirements(),
    duplicateFrom
      ? prisma.customer.findUnique({
          where: { id: duplicateFrom },
          select: { name: true, email: true, phone: true, address: true, industry: true, subsidiaryId: true, currencyId: true },
        })
      : Promise.resolve(null),
  ])

  if (!adminUser) {
    return <p className="p-8 text-white">No admin user found.</p>
  }

  return (
    <MasterDataCreatePageShell backHref="/customers" backLabel="<- Back to Customers" title="New Customer" formId="create-customer-form">
      <CustomerCreateForm
        formId="create-customer-form"
        showFooterActions={false}
        ownerUserId={adminUser.id}
        subsidiaries={subsidiaries}
        currencies={currencies}
        industryOptions={industryOptions}
        inactiveOptions={inactiveOptions}
        redirectBasePath="/customers"
        initialLayoutConfig={formCustomization}
        initialRequirements={{ ...formRequirements.customerCreate }}
        initialValues={duplicateCustomer ? {
          name: `Copy of ${duplicateCustomer.name}`,
          email: duplicateCustomer.email,
          phone: duplicateCustomer.phone,
          address: duplicateCustomer.address,
          industry: duplicateCustomer.industry,
          primarySubsidiaryId: duplicateCustomer.subsidiaryId,
          primaryCurrencyId: duplicateCustomer.currencyId,
        } : undefined}
        sectionDescriptions={{
          Core: 'Primary identity fields for the customer record.',
          Contact: 'Contact channels and billing address.',
          Financial: 'Default industry, subsidiary, and currency settings.',
          Status: 'Availability and active-state controls.',
        }}
      />
    </MasterDataCreatePageShell>
  )
}
