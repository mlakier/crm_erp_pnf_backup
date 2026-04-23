export type MasterDataColumn = {
  id: string
  label: string
  tooltip?: string
  defaultVisible?: boolean
  locked?: boolean
}

export function withMasterDataDefaults(columns: MasterDataColumn[]): MasterDataColumn[] {
  return columns.map((column, index) => ({
    ...column,
    locked: column.locked === true || index < 2,
  }))
}

export function buildMasterDataColumns(options: {
  idColumnId?: string
  idLabel?: string
  nameColumnId?: string
  nameLabel?: string
  extraColumns?: MasterDataColumn[]
  includeAuditColumns?: boolean
  includeActionsColumn?: boolean
} = {}): MasterDataColumn[] {
  const {
    idColumnId = 'id',
    idLabel = 'ID',
    nameColumnId = 'name',
    nameLabel = 'Name',
    extraColumns = [],
    includeAuditColumns = true,
    includeActionsColumn = false,
  } = options

  const baseColumns: MasterDataColumn[] = [
    { id: idColumnId, label: idLabel },
    { id: nameColumnId, label: nameLabel },
    ...extraColumns,
  ]

  if (includeAuditColumns) {
    baseColumns.push(
      { id: 'inactive', label: 'Inactive' },
      { id: 'created', label: 'Created' },
      { id: 'last-modified', label: 'Last Modified' },
    )
  }

  if (includeActionsColumn) {
    baseColumns.push({ id: 'actions', label: 'Actions', locked: true })
  }

  return withMasterDataDefaults(baseColumns)
}
