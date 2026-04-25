import { cache } from 'react'
import { loadCompanyPreferencesSettings } from '@/lib/company-preferences-store'

export const loadCompanyDisplaySettings = cache(async () => {
  const { moneySettings } = await loadCompanyPreferencesSettings()
  return { moneySettings }
})
