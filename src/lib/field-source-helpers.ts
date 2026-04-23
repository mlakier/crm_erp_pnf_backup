import {
  getListSourceText,
  loadListOptionsForSource,
  type ListSourceDefinition,
  type SelectOption,
} from '@/lib/list-source'

type FieldWithSource<Key extends string = string> = ListSourceDefinition & {
  id: Key
}

export function buildFieldMetaById<TField extends FieldWithSource>(
  fields: readonly TField[]
): Record<TField['id'], TField> {
  return Object.fromEntries(fields.map((field) => [field.id, field])) as Record<TField['id'], TField>
}

export async function loadFieldOptionsMap<Key extends string>(
  fieldMetaById: Record<string, ListSourceDefinition>,
  fieldKeys: readonly Key[]
): Promise<Partial<Record<Key, SelectOption[]>>> {
  const entries = await Promise.all(
    fieldKeys.map(async (fieldKey) => [fieldKey, await loadListOptionsForSource(fieldMetaById[fieldKey])] as const)
  )

  return Object.fromEntries(entries) as Partial<Record<Key, SelectOption[]>>
}

export function getFieldSourceText<Key extends string>(
  fieldMetaById: Record<string, ListSourceDefinition>,
  fieldKey: Key
): string | undefined {
  return getListSourceText(fieldMetaById[fieldKey])
}
