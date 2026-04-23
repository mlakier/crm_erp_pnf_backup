import { NextRequest, NextResponse } from 'next/server'
import { loadIntegrationSettings } from '@/lib/integration-settings-store'
import { getCountryConfig, normalizeCountryCode } from '@/lib/address-country-config'

type ValidateBody = {
  street1?: string
  street2?: string
  street3?: string
  city?: string
  stateProvince?: string
  postalCode?: string
  country?: string
}

type AddressValidationResult = {
  result?: {
    verdict?: {
      addressComplete?: boolean
      hasUnconfirmedComponents?: boolean
      hasInferredComponents?: boolean
      validationGranularity?: string
      geocodeGranularity?: string
    }
    address?: {
      formattedAddress?: string
      addressComponents?: Array<{
        componentName?: {
          text?: string
        }
        componentType?: string
        confirmationLevel?: string
      }>
      postalAddress?: {
        addressLines?: string[]
        locality?: string
        administrativeArea?: string
        postalCode?: string
        regionCode?: string
      }
    }
    metadata?: {
      latitude?: number
      longitude?: number
    }
  }
  error?: {
    code?: number
    message?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ValidateBody
    const street1 = body.street1?.trim() ?? ''
    const street2 = body.street2?.trim() ?? ''
    const street3 = body.street3?.trim() ?? ''
    const city = body.city?.trim() ?? ''
    const stateProvince = body.stateProvince?.trim() ?? ''
    const postalCode = body.postalCode?.trim() ?? ''
    const country = normalizeCountryCode(body.country)
    const countryConfig = getCountryConfig(country)

    if (!street1 || !city || !country) {
      return NextResponse.json({ valid: false, error: 'Missing required address fields' }, { status: 400 })
    }

    if (countryConfig.stateRequired && !stateProvince) {
      return NextResponse.json({ valid: false, error: `${countryConfig.stateLabel} is required` }, { status: 400 })
    }

    if (countryConfig.postalRequired && !postalCode) {
      return NextResponse.json({ valid: false, error: `${countryConfig.postalLabel} is required` }, { status: 400 })
    }

    if (postalCode && countryConfig.postalValidation && !countryConfig.postalValidation(postalCode)) {
      return NextResponse.json({ valid: false, error: countryConfig.postalError ?? 'Invalid postal code format' }, { status: 400 })
    }

    const integrationSettings = await loadIntegrationSettings()
    if (!integrationSettings.googleAddressValidation.enabled) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Google address validation is disabled in Manage Integrations.',
        },
        { status: 503 },
      )
    }

    const configuredApiKey = integrationSettings.googleAddressValidation.apiKey.trim()
    const apiKey = configuredApiKey || process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Google address validation is not configured. Add an API key in Manage Integrations or set GOOGLE_MAPS_API_KEY.',
        },
        { status: 503 },
      )
    }

    // Use Google Address Validation API (purpose-built for validation, not geocoding)
    const url = 'https://addressvalidation.googleapis.com/v1:validateAddress?key=' + encodeURIComponent(apiKey)
    
    let requestLocality = city
    let requestAdministrativeArea = stateProvince || undefined
    let addressLines = [street1, ...(street2 ? [street2] : []), ...(street3 ? [street3] : [])]

    // Common UK entry pattern puts town in line 3 and county in City.
    // Normalize before calling Google Address Validation.
    if (country === 'GB' && !stateProvince && street3 && city) {
      requestLocality = street3
      requestAdministrativeArea = city
      addressLines = [street1, ...(street2 ? [street2] : [])]
    }

    const addressInput = {
      address: {
        regionCode: country === 'GB' ? 'GB' : country === 'CA' ? 'CA' : country === 'AU' ? 'AU' : country === 'NZ' ? 'NZ' : country.length === 2 ? country : 'US',
        addressLines,
        administrativeArea: requestAdministrativeArea,
        locality: requestLocality || undefined,
        postalCode: postalCode || undefined,
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addressInput),
      cache: 'no-store',
    })

    const data = (await response.json()) as AddressValidationResult

    if (!response.ok || data.error) {
      return NextResponse.json(
        {
          valid: false,
          error: data.error?.message ?? 'Google address validation failed',
        },
        { status: 400 },
      )
    }

    const result = data.result
    if (!result?.address) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Google could not validate this address. Please review and try again.',
        },
        { status: 400 },
      )
    }

    // Check verdict: require complete and reasonably confirmed addresses.
    const verdict = result.verdict
    if (!verdict?.addressComplete) {
      return NextResponse.json(
        {
          valid: false,
          error:
            country === 'GB'
              ? 'Address is incomplete. For UK addresses, use City for town/city (e.g. Reading) and County / Region for county (e.g. Berkshire).'
              : 'Address is incomplete. Please verify the street name and city are correct.',
        },
        { status: 400 },
      )
    }

    if (verdict.hasUnconfirmedComponents) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Address has unconfirmed components. Please verify street, city, and postal code.',
        },
        { status: 400 },
      )
    }

    // Extract validated components
    const postalAddress = result.address.postalAddress
    const formattedAddress = result.address.formattedAddress ?? ''
    
    const normalizedStreet1 = postalAddress?.addressLines?.[0] ?? street1
    const normalizedStreet2 = postalAddress?.addressLines?.[1] ?? street2
    const normalizedStreet3 = postalAddress?.addressLines?.[2] ?? street3
    const normalizedCity = postalAddress?.locality ?? city
    const normalizedState = postalAddress?.administrativeArea ?? stateProvince
    const normalizedPostal = postalAddress?.postalCode ?? postalCode
    const normalizedCountry = postalAddress?.regionCode ?? country

    return NextResponse.json({
      valid: true,
      source: 'google-address-validation',
      formattedAddress,
      components: {
        street1: normalizedStreet1,
        street2: normalizedStreet2,
        street3: normalizedStreet3,
        city: normalizedCity,
        stateProvince: normalizedState,
        postalCode: normalizedPostal,
        country: normalizedCountry,
      },
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'Address validation failed' }, { status: 500 })
  }
}
