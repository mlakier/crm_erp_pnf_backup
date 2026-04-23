import MasterDataCreatePageShell from '@/components/MasterDataCreatePageShell'
import ManageListCreateForm from '@/components/ManageListCreateForm'

export default function NewManagedListPage() {
  return (
    <MasterDataCreatePageShell
      backHref="/lists"
      backLabel="<- Back to Manage Lists"
      title="New List"
      formId="managed-list-create-form"
    >
      <ManageListCreateForm />
    </MasterDataCreatePageShell>
  )
}
