import { NextRequest, NextResponse } from 'next/server'
import { fetchCities, isRajaOngkirConfigured } from '@/lib/rajaongkir'

// GET /api/shipping/cities — Search cities for address/checkout
export async function GET(request: NextRequest) {
  if (!isRajaOngkirConfigured()) {
    return NextResponse.json(
      { success: false, error: 'RajaOngkir not configured' },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('q')?.toLowerCase().trim() || ''
  const province = searchParams.get('province')?.toLowerCase().trim() || ''

  try {
    const cities = await fetchCities()

    let filtered = cities
    if (search) {
      filtered = filtered.filter(c =>
        c.name.includes(search) ||
        `${c.type} ${c.name}`.includes(search) ||
        c.province.includes(search)
      )
    }
    if (province) {
      filtered = filtered.filter(c => c.province === province)
    }

    // Limit results to 50
    const results = filtered.slice(0, 50).map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      province: c.province,
      postalCode: c.postalCode,
    }))

    return NextResponse.json({
      success: true,
      data: results,
      total: filtered.length,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cities' },
      { status: 500 }
    )
  }
}
