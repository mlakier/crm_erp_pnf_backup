import { Children, isValidElement, type ReactNode } from 'react'
import MasterDataListToolbar, { type MasterDataListToolbarProps } from '@/components/MasterDataListToolbar'
import PaginationFooter from '@/components/PaginationFooter'

type MasterDataListSectionProps = MasterDataListToolbarProps & {
  children: ReactNode
  tableContainerId?: string
  tableContainerClassName?: string
}

export default function MasterDataListSection({
  children,
  tableContainerId,
  tableContainerClassName = 'record-list-scroll-region overflow-x-auto',
  ...toolbarProps
}: MasterDataListSectionProps) {
  const childNodes = Children.toArray(children)
  const lastChild = childNodes.at(-1)
  const hasPaginationFooter = isValidElement(lastChild) && lastChild.type === PaginationFooter
  const tableContent = hasPaginationFooter ? childNodes.slice(0, -1) : childNodes

  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border-muted)' }}
    >
      <MasterDataListToolbar {...toolbarProps} />
      <div
        id={tableContainerId}
        className={tableContainerClassName}
        data-column-selector-table={toolbarProps.tableId}
      >
        {tableContent}
      </div>
      {hasPaginationFooter ? lastChild : null}
    </section>
  )
}
