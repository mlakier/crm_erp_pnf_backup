import { prisma } from '@/lib/prisma'
import { loadSavedSearchBuiltInBaseline } from '@/lib/saved-search-builtins-store'
import {
  sanitizeSavedSearchDefinitionState,
  type SavedSearchDefinitionState,
} from '@/lib/saved-search-metadata'

export const BUILT_IN_VIEW_ID = '__built-in-default'

type LoadEffectiveSavedSearchDefinitionInput = {
  tableId: string
  userId?: string | null
  selectedViewId?: string | null
}

export async function loadEffectiveSavedSearchDefinition({
  tableId,
  userId,
  selectedViewId,
}: LoadEffectiveSavedSearchDefinitionInput): Promise<SavedSearchDefinitionState> {
  const resolvedTableId = tableId.trim()
  if (!resolvedTableId) {
    return sanitizeSavedSearchDefinitionState(null)
  }

  const resolvedSelectedViewId = selectedViewId?.trim() ?? ''
  const builtInBaseline = await loadSavedSearchBuiltInBaseline(resolvedTableId)

  if (resolvedSelectedViewId === BUILT_IN_VIEW_ID) {
    return sanitizeSavedSearchDefinitionState(builtInBaseline?.filterState ?? null)
  }

  if (!userId) {
    return sanitizeSavedSearchDefinitionState(builtInBaseline?.filterState ?? null)
  }

  const requestedView = resolvedSelectedViewId
    ? await prisma.savedListView.findFirst({
        where: {
          id: resolvedSelectedViewId,
          userId,
          tableId: resolvedTableId,
        },
        select: {
          filterState: true,
        },
      })
    : null

  const defaultView = requestedView
    ? null
    : await prisma.savedListView.findFirst({
        where: {
          userId,
          tableId: resolvedTableId,
          isDefault: true,
        },
        select: {
          filterState: true,
        },
      })

  const rawFilterState = requestedView
    ? JSON.parse(requestedView.filterState)
    : defaultView
      ? JSON.parse(defaultView.filterState)
      : builtInBaseline?.filterState ?? null

  return sanitizeSavedSearchDefinitionState(rawFilterState)
}
