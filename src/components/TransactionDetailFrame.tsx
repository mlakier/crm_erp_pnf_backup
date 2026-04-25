import type { ReactNode } from 'react'

export default function TransactionDetailFrame({
  stats,
  header,
  lineItems,
  relatedDocuments,
  supplementarySections,
  communications,
  systemNotes,
}: {
  stats?: ReactNode
  header: ReactNode
  lineItems: ReactNode
  relatedDocuments?: ReactNode
  supplementarySections?: ReactNode | ReactNode[]
  communications?: ReactNode
  systemNotes?: ReactNode
}) {
  const extras = Array.isArray(supplementarySections)
    ? supplementarySections.filter(Boolean)
    : supplementarySections
      ? [supplementarySections]
      : []

  return (
    <>
      {stats ? <div className="mb-8">{stats}</div> : null}
      {header}
      {lineItems}
      {relatedDocuments}
      {extras.map((section, index) => (
        <div key={index}>{section}</div>
      ))}
      {communications}
      {systemNotes}
    </>
  )
}
