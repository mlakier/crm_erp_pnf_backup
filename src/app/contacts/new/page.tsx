import { prisma } from '@/lib/prisma'
import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import ContactCreateForm from '@/components/ContactCreateForm'
import { loadContactFormCustomization } from '@/lib/contact-form-customization-store'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadListOptionsForSource } from '@/lib/list-source'

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [adminUser, customers, vendors, inactiveOptions, formCustomization, formRequirements, duplicateContact] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'admin@example.com' } }),
    prisma.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.vendor.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    loadContactFormCustomization(),
    loadFormRequirements(),
    duplicateFrom
      ? prisma.contact.findUnique({
          where: { id: duplicateFrom },
          select: { firstName: true, lastName: true, email: true, phone: true, address: true, position: true, customerId: true, vendorId: true },
        })
      : Promise.resolve(null),
  ])

  if (!adminUser) {
    return <p className="p-8 text-white">No admin user found.</p>
  }

  return (
    <MasterDataCreatePageShell backHref="/contacts" backLabel="<- Back to Contacts" title="New Contact" formId="create-contact-form">
      <ContactCreateForm
        formId="create-contact-form"
        showFooterActions={false}
        userId={adminUser.id}
        customers={customers}
        vendors={vendors}
        redirectBasePath="/contacts"
        inactiveOptions={inactiveOptions}
        initialLayoutConfig={formCustomization}
        initialRequirements={{ ...formRequirements.contactCreate }}
        initialValues={duplicateContact ? {
          firstName: duplicateContact.firstName,
          lastName: duplicateContact.lastName,
          email: duplicateContact.email,
          phone: duplicateContact.phone,
          address: duplicateContact.address,
          position: duplicateContact.position,
          customerId: duplicateContact.customerId,
          vendorId: duplicateContact.vendorId,
        } : undefined}
        sectionDescriptions={{
          Core: 'Primary identity fields for the contact record.',
          Contact: 'Communication channels and mailing information.',
          Relationship: 'Customer or vendor ownership and job-context fields.',
          Status: 'Availability and active-state controls.',
        }}
      />
    </MasterDataCreatePageShell>
  )
}
