import { prisma } from '@/lib/prisma'
import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import VendorCreateForm from '@/components/VendorCreateForm'
import { loadListOptionsForSource } from '@/lib/list-source'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadVendorFormCustomization } from '@/lib/vendor-form-customization-store'

export default async function NewVendorPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [subsidiaries, currencies, inactiveOptions, formCustomization, formRequirements, duplicateVendor] = await Promise.all([
    prisma.subsidiary.findMany({ orderBy: { subsidiaryId: 'asc' }, select: { id: true, subsidiaryId: true, name: true } }),
    prisma.currency.findMany({ orderBy: { code: 'asc' }, select: { id: true, currencyId: true, code: true, name: true } }),
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    loadVendorFormCustomization(),
    loadFormRequirements(),
    duplicateFrom
      ? prisma.vendor.findUnique({
          where: { id: duplicateFrom },
          select: { name: true, email: true, phone: true, address: true, taxId: true, subsidiaryId: true, currencyId: true },
        })
      : Promise.resolve(null),
  ])

  return (
    <MasterDataCreatePageShell backHref="/vendors" backLabel="<- Back to Vendors" title="New Vendor" formId="create-vendor-form">
      <VendorCreateForm
        formId="create-vendor-form"
        showFooterActions={false}
        subsidiaries={subsidiaries}
        currencies={currencies}
        inactiveOptions={inactiveOptions}
        redirectBasePath="/vendors"
        initialLayoutConfig={formCustomization}
        initialRequirements={{ ...formRequirements.vendorCreate }}
        initialValues={duplicateVendor ? {
          name: `Copy of ${duplicateVendor.name}`,
          email: duplicateVendor.email,
          phone: duplicateVendor.phone,
          address: duplicateVendor.address,
          taxId: duplicateVendor.taxId,
          primarySubsidiaryId: duplicateVendor.subsidiaryId,
          primaryCurrencyId: duplicateVendor.currencyId,
        } : undefined}
        sectionDescriptions={{
          Core: 'Primary identity fields for the vendor record.',
          Contact: 'Contact channels and mailing address.',
          Financial: 'Default tax, subsidiary, and currency settings.',
          Status: 'Availability and active-state controls.',
        }}
      />
    </MasterDataCreatePageShell>
  )
}
