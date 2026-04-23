export function buildDefaultListHeaderTooltip(label: string) {
  const normalized = label.trim().toLowerCase()

  if (normalized.includes('id')) {
    return 'Unique business identifier for the record shown in this row.'
  }
  if (normalized === 'name') {
    return 'Primary display name for the record.'
  }
  if (normalized.includes('description')) {
    return 'Descriptive text or summary for the record.'
  }
  if (normalized.includes('status')) {
    return 'Current lifecycle or processing status for the record.'
  }
  if (normalized.includes('total')) {
    return 'Calculated document total or overall monetary value for the row.'
  }
  if (normalized.includes('amount')) {
    return 'Monetary amount associated with the record.'
  }
  if (normalized.includes('date')) {
    return `Relevant date stored for the ${label.toLowerCase()} column.`
  }
  if (normalized.includes('created')) {
    return 'Date the record was originally created.'
  }
  if (normalized.includes('last modified')) {
    return 'Date the record was most recently updated.'
  }
  if (normalized.includes('actions')) {
    return 'Available row-level actions such as open, edit, or delete.'
  }
  if (normalized.includes('vendor')) {
    return 'Linked vendor or supplier record for the row.'
  }
  if (normalized.includes('customer')) {
    return 'Linked customer record for the row.'
  }
  if (normalized.includes('subsidiary')) {
    return 'Subsidiary context associated with the row.'
  }
  if (normalized.includes('currency')) {
    return 'Currency associated with the row or document.'
  }
  if (normalized.includes('email')) {
    return 'Primary email address stored for the row.'
  }
  if (normalized.includes('phone')) {
    return 'Primary phone number stored for the row.'
  }
  if (normalized.includes('address')) {
    return 'Address information stored for the row.'
  }
  if (normalized.includes('notes')) {
    return 'Freeform notes or comments stored on the row.'
  }

  return `Displays the ${label.toLowerCase()} value for each row.`
}
