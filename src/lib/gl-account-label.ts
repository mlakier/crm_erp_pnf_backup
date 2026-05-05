export function formatGlAccountLabel(account: {
  accountNumber?: string | null
  accountId?: string | null
  name: string
}) {
  return `${account.accountNumber ?? account.accountId ?? ''} - ${account.name}`
}
