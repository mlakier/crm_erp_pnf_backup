import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import RoleCreateForm from '@/components/RoleCreateForm'
import { loadFormRequirements } from '@/lib/form-requirements-store'
import { loadRoleFormCustomization } from '@/lib/role-form-customization-store'
import { loadListOptionsForSource } from '@/lib/list-source'
import { prisma } from '@/lib/prisma'

export default async function NewRolePage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>
}) {
  const { duplicateFrom } = await searchParams
  const [inactiveOptions, formCustomization, formRequirements, duplicateRole] = await Promise.all([
    loadListOptionsForSource({ sourceType: 'system', sourceKey: 'activeInactive' }),
    loadRoleFormCustomization(),
    loadFormRequirements(),
    duplicateFrom ? prisma.role.findUnique({ where: { id: duplicateFrom }, select: { name: true, description: true } }) : Promise.resolve(null),
  ])

  return (
    <MasterDataCreatePageShell backHref="/roles" backLabel="<- Back to Roles" title="New Role" formId="create-role-form">
      <RoleCreateForm
        formId="create-role-form"
        showFooterActions={false}
        redirectBasePath="/roles"
        inactiveOptions={inactiveOptions}
        initialLayoutConfig={formCustomization}
        initialRequirements={{ ...formRequirements.roleCreate }}
        initialValues={duplicateRole ? {
          name: `Copy of ${duplicateRole.name}`,
          description: duplicateRole.description,
        } : undefined}
        sectionDescriptions={{
          Core: 'Primary identity fields for the role record.',
          Status: 'Availability and active-state controls.',
        }}
      />
    </MasterDataCreatePageShell>
  )
}
