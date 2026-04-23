import ManagedListDetailPageContent from '@/components/ManagedListDetailPageContent'

export default async function ManagedListEditPage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params
  return <ManagedListDetailPageContent listKey={key} editing />
}
