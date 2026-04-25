export type TransactionStatDefinition<TRecord> = {
  id: string
  label: string
  accent?: true | 'teal' | 'yellow'
  getValue: (record: TRecord) => string | number
  getHref?: (record: TRecord) => string | null
  getValueTone?: (record: TRecord) => 'default' | 'accent' | 'teal' | 'yellow' | 'green' | 'red'
}

export type TransactionPageConfig<TRecord> = {
  sectionDescriptions: Record<string, string>
  stats: TransactionStatDefinition<TRecord>[]
}
