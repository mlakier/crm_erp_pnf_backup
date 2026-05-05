'use client'

import { RecordDetailCell, RecordDetailHeaderCell, RecordDetailSection } from '@/components/RecordDetailPanels'
import SearchableSelect from '@/components/SearchableSelect'
import { fmtCurrency } from '@/lib/format'

export type CreditDocumentLineDraft = {
  id: string
  itemId: string
  description: string
  quantity: string
  unitPrice: string
  notes: string
}

type ItemOption = {
  id: string
  itemId: string | null
  name: string
}

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function CreditDocumentLineItemsEditor({
  title,
  rows,
  itemOptions,
  currencyCode,
  moneySettings,
  onChange,
}: {
  title: string
  rows: CreditDocumentLineDraft[]
  itemOptions: ItemOption[]
  currencyCode?: string | null
  moneySettings: Parameters<typeof fmtCurrency>[2]
  onChange: (rows: CreditDocumentLineDraft[]) => void
}) {
  function updateRow(id: string, patch: Partial<CreditDocumentLineDraft>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function removeRow(id: string) {
    onChange(rows.filter((row) => row.id !== id))
  }

  function addRow() {
    onChange([
      ...rows,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        itemId: '',
        description: '',
        quantity: '1',
        unitPrice: '0',
        notes: '',
      },
    ])
  }

  return (
    <RecordDetailSection
      title={title}
      count={rows.length}
      summary={rows.length ? `${rows.length} line${rows.length === 1 ? '' : 's'}` : undefined}
      actions={
        <button
          type="button"
          onClick={addRow}
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: 'var(--accent-primary-strong)' }}
        >
          Add Line
        </button>
      }
    >
      <table className="min-w-full">
        <thead>
          <tr>
            <RecordDetailHeaderCell>Item</RecordDetailHeaderCell>
            <RecordDetailHeaderCell>Description</RecordDetailHeaderCell>
            <RecordDetailHeaderCell className="text-right">Qty</RecordDetailHeaderCell>
            <RecordDetailHeaderCell className="text-right">Unit Price</RecordDetailHeaderCell>
            <RecordDetailHeaderCell className="text-right">Line Total</RecordDetailHeaderCell>
            <RecordDetailHeaderCell>Notes</RecordDetailHeaderCell>
            <RecordDetailHeaderCell>Actions</RecordDetailHeaderCell>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No line items yet.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const quantity = Math.max(1, toNumber(row.quantity))
              const unitPrice = Math.max(0, toNumber(row.unitPrice))
              const lineTotal = quantity * unitPrice
              return (
                <tr
                  key={row.id}
                  style={index < rows.length - 1 ? { borderBottom: '1px solid var(--border-muted)' } : undefined}
                >
                  <RecordDetailCell>
                    <SearchableSelect
                      selectedValue={row.itemId}
                      options={itemOptions.map((item) => ({
                        value: item.id,
                        label: `${item.itemId ?? item.id} - ${item.name}`,
                        searchText: `${item.itemId ?? item.id} ${item.name}`,
                        sortIdText: item.itemId ?? item.id,
                        sortLabelText: item.name,
                      }))}
                      placeholder="None"
                      searchPlaceholder="Search item"
                      dropdownWidthMode="trigger"
                      onSelect={(nextItemId) => {
                        const selectedItem = itemOptions.find((item) => item.id === nextItemId) ?? null
                        updateRow(row.id, {
                          itemId: nextItemId,
                          description: row.description || selectedItem?.name || '',
                        })
                      }}
                    />
                  </RecordDetailCell>
                  <RecordDetailCell>
                    <input
                      type="text"
                      value={row.description}
                      onChange={(event) => updateRow(row.id, { description: event.target.value })}
                      className="w-full rounded-md border bg-transparent px-2 py-1 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </RecordDetailCell>
                  <RecordDetailCell className="text-right">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(event) => updateRow(row.id, { quantity: event.target.value })}
                      className="w-24 rounded-md border bg-transparent px-2 py-1 text-right text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </RecordDetailCell>
                  <RecordDetailCell className="text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unitPrice}
                      onChange={(event) => updateRow(row.id, { unitPrice: event.target.value })}
                      className="w-28 rounded-md border bg-transparent px-2 py-1 text-right text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </RecordDetailCell>
                  <RecordDetailCell className="text-right">
                    {fmtCurrency(lineTotal, currencyCode ?? undefined, moneySettings)}
                  </RecordDetailCell>
                  <RecordDetailCell>
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(event) => updateRow(row.id, { notes: event.target.value })}
                      className="w-full rounded-md border bg-transparent px-2 py-1 text-sm text-white"
                      style={{ borderColor: 'var(--border-muted)' }}
                    />
                  </RecordDetailCell>
                  <RecordDetailCell>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      Remove
                    </button>
                  </RecordDetailCell>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </RecordDetailSection>
  )
}
