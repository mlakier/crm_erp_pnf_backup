import ManagedListDetailPageContent from '@/components/ManagedListDetailPageContent'

export default async function ManagedListDetailPage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params
  return <ManagedListDetailPageContent listKey={key} editing={false} />
}
