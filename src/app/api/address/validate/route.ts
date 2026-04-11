import { NextRequest, NextResponse } from 'next/server'

type ValidateBody = {
  street1?: string
  street2?: string
  street3?: string
  city?: string
  stateProvince?: string
  postalCode?: string
  country?: string
}

function buildInputAddress(body: ValidateBody): string {
  const parts = [
    body.street1?.trim(),
    body.street2?.trim(),
    body.street3?.trim(),
    body.city?.trim(),
    body.stateProvince?.trim(),
    body.postalCode?.trim(),
    body.country?.trim(),
  ].filter(Boolean)

  return parts.join(', ')
}

function pickComponent(components: Array<{ long_name: string; short_name: string; types: string[] }>, type: string) {
  return components.find((component) => component.types.includes(type))
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ValidateBody

    if (!body.street1 || !body.city || !body.stateProvince || !body.postalCode || !body.country) {
      return NextResponse.json({ valid: false, error: 'Missing required address fields' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Google address validation is not configured. Set GOOGLE_MAPS_API_KEY.',
        },
        { status: 503 },
      )
    }

    const inputAddress = buildInputAddress(body)
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(inputAddress)}&key=${encodeURIComponent(apiKey)}`

    const response = await fetch(url, { cache: 'no-store' })
    const data = await response.json()

    if (!response.ok || data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Google could not validate this address. Please review and try again.',
        },
        { status: 400 },
      )
    }

    const first = data.results[0]
    const components = first.address_components as Array<{ long_name: string; short_name: string; types: string[] }>

    const streetNumber = pickComponent(components, 'street_number')?.long_name ?? ''
    const route = pickComponent(components, 'route')?.long_name ?? ''
    const locality = pickComponent(components, 'locality')?.long_name ?? body.city?.trim() ?? ''
    const adminArea = pickComponent(components, 'administrative_area_level_1')?.short_name ?? body.stateProvince?.trim() ?? ''
    const postal = pickComponent(components, 'postal_code')?.long_name ?? body.postalCode?.trim() ?? ''
    const country = pickComponent(components, 'country')?.short_name ?? body.country?.trim().toUpperCase() ?? ''

    const normalizedStreet1 = `${streetNumber} ${route}`.trim() || body.street1.trim()
    const line1 = normalizedStreet1
    const line2 = body.street2?.trim() ?? ''
    const line3 = body.street3?.trim() ?? ''
    const cityLine = `${locality}, ${adminArea} ${postal}`.trim()
    const formattedAddress = [line1, line2, line3, cityLine, country].filter(Boolean).join(', ')

    return NextResponse.json({
      valid: true,
      source: 'google',
      formattedAddress,
      components: {
        street1: line1,
        street2: line2,
        street3: line3,
        city: locality,
        stateProvince: adminArea,
        postalCode: postal,
        country,
      },
    })
  } catch (error) {
    return NextResponse.json({ valid: false, error: 'Address validation failed' }, { status: 500 })
  }
}
