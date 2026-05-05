'use client'

import ColumnSelector from '@/components/ColumnSelector'
import ExportButton from '@/components/ExportButton'
import SavedSearchViewSelector from '@/components/SavedSearchViewSelector'
import type {
  SavedSearchFieldOption,
  SavedSearchFilterDefinition,
  SavedSearchLinkedResultSource,
} from '@/lib/saved-search-metadata'

export type ListSearchActionsColumn = {
  id: string
  label: string
  defaultVisible?: boolean
  locked?: boolean
}

export default function ListSearchActions({
  tableId,
  exportFileName,
  exportAllUrl,
  columns,
  title,
  basePath,
  filterDefinitions,
  criteriaFields,
  resultFields,
  linkedResultSources,
  compactExport = false,
}: {
  tableId: string
  exportFileName: string
  exportAllUrl?: string
  columns: ListSearchActionsColumn[]
  title?: string
  basePath?: string
  filterDefinitions?: SavedSearchFilterDefinition[]
  criteriaFields?: SavedSearchFieldOption[]
  resultFields?: SavedSearchFieldOption[]
  linkedResultSources?: SavedSearchLinkedResultSource[]
  compactExport?: boolean
}) {
  return (
    <>
      <SavedSearchViewSelector tableId={tableId} />
      <ExportButton tableId={tableId} fileName={exportFileName} compact={compactExport} exportAllUrl={exportAllUrl} />
      <ColumnSelector
        tableId={tableId}
        columns={columns}
        title={title}
        basePath={basePath}
        filterDefinitions={filterDefinitions}
        criteriaFields={criteriaFields}
        resultFields={resultFields}
        linkedResultSources={linkedResultSources}
      />
    </>
  )
}
