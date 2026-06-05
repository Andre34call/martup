// ==================== RAJAONGKIR API CLIENT ====================
// Handles all RajaOngkir API interactions: city lookup, cost calculation
// Supports both Starter and Pro packages

import { logger } from '@/lib/logger'

const RAJAONGKIR_STARTER_URL = 'https://api.rajaongkir.com/starter'
const RAJAONGKIR_PRO_URL = 'https://api.rajaongkir.com/pro'

function getBaseUrl(): string {
  const isPro = process.env.RAJAONGKIR_PACKAGE === 'pro'
  return isPro ? RAJAONGKIR_PRO_URL : RAJAONGKIR_STARTER_URL
}

function getApiKey(): string | undefined {
  return process.env.RAJAONGKIR_API_KEY
}

export interface RajaOngkirCity {
  id: string
  name: string
  province: string
  provinceId: string
  type: string
  postalCode: string
}

export interface RajaOngkirCostResult {
  provider: string
  service: string
  name: string
  price: number
  estimatedDays: string
  logo: string
}

// In-memory city cache (avoid repeated API calls)
let cityCache: RajaOngkirCity[] | null = null
let cityCacheExpiry: number = 0
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Fetch all cities from RajaOngkir /city endpoint.
 * Results are cached in memory for 24 hours.
 */
export async function fetchCities(): Promise<RajaOngkirCity[]> {
  const now = Date.now()
  if (cityCache && now < cityCacheExpiry) {
    return cityCache
  }

  const apiKey = getApiKey()
  if (!apiKey) return []

  try {
    const response = await fetch(`${getBaseUrl()}/city`, {
      headers: { key: apiKey },
      next: { revalidate: 86400 }, // Cache for 24h at Next.js level
    })

    if (!response.ok) {
      logger.warn({ component: 'rajaongkir', status: response.status }, 'Failed to fetch cities')
      return cityCache || []
    }

    const data = await response.json()
    if (data.rajaongkir?.status?.code !== 200) {
      logger.warn({ component: 'rajaongkir', status: data.rajaongkir?.status }, 'RajaOngkir city API error')
      return cityCache || []
    }

    const cities: RajaOngkirCity[] = (data.rajaongkir?.results || []).map((c: Record<string, unknown>) => ({
      id: String(c.city_id),
      name: (String(c.city_name) || '').toLowerCase().trim(),
      province: (String(c.province) || '').toLowerCase().trim(),
      provinceId: String(c.province_id),
      type: (String(c.type) || '').toLowerCase().trim(),
      postalCode: String(c.postal_code || ''),
    }))

    cityCache = cities
    cityCacheExpiry = now + CACHE_TTL

    logger.info({ component: 'rajaongkir', cityCount: cities.length }, 'Cities cached')
    return cities
  } catch (err) {
    logger.warn({ component: 'rajaongkir', err }, 'Failed to fetch cities from RajaOngkir')
    return cityCache || []
  }
}

/**
 * Find a RajaOngkir city ID by city name.
 * Tries exact match first, then partial match, then province match.
 */
export async function findCityId(cityName: string): Promise<string | null> {
  if (!cityName) return null

  const cities = await fetchCities()
  const search = cityName.toLowerCase().trim()

  // 1. Exact match (city name)
  const exact = cities.find(c => c.name === search)
  if (exact) return exact.id

  // 2. Exact match with "kota" or "kabupaten" prefix
  const withPrefix = cities.find(c => {
    const fullName = `${c.type} ${c.name}`
    return (
      fullName === search ||
      c.name === search.replace(/^kota\s+/i, '').replace(/^kab\.\s*/i, '').replace(/^kabupaten\s+/i, '')
    )
  })
  if (withPrefix) return withPrefix.id

  // 3. Partial match (city name contains search or vice versa)
  const partial = cities.find(c => c.name.includes(search) || search.includes(c.name))
  if (partial) return partial.id

  // 4. Match by province capital (first city in province)
  const byProvince = cities.find(c => c.province === search)
  if (byProvince) return byProvince.id

  logger.warn({ component: 'rajaongkir', cityName }, 'City not found in RajaOngkir database')
  return null
}

/**
 * Calculate shipping cost via RajaOngkir /cost endpoint.
 */
export async function calculateRajaOngkirCost(
  originCityId: string,
  destinationCityId: string,
  weightGrams: number,
  courier?: string
): Promise<RajaOngkirCostResult[]> {
  const apiKey = getApiKey()
  if (!apiKey) return []

  const isPro = process.env.RAJAONGKIR_PACKAGE === 'pro'

  // Starter: jne, pos, tiki (only one courier per request)
  // Pro: jne, pos, tiki, wahana, jnt, rpx, pandu, sicepat, anteraja, dse, lion, ncs, star, tiki
  const supportedCouriers = isPro
    ? ['jne', 'pos', 'tiki', 'wahana', 'jnt', 'rpx', 'pandu', 'sicepat', 'anteraja']
    : ['jne', 'pos', 'tiki']

  const couriersToFetch = courier
    ? supportedCouriers.filter(c => c === courier.toLowerCase())
    : supportedCouriers

  const allResults: RajaOngkirCostResult[] = []

  // RajaOngkir starter only allows ONE courier per request
  // Pro allows multiple separated by ':'
  for (const c of couriersToFetch) {
    try {
      const response = await fetch(`${getBaseUrl()}/cost`, {
        method: 'POST',
        headers: {
          key: apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          origin: originCityId,
          destination: destinationCityId,
          weight: String(Math.max(1000, Math.ceil(weightGrams / 1000) * 1000)),
          courier: c,
        }),
      })

      if (!response.ok) continue

      const data = await response.json()
      if (data.rajaongkir?.status?.code !== 200) continue

      const results = data.rajaongkir?.results?.[0]
      if (!results) continue

      const logoMap: Record<string, string> = {
        jne: '📦', pos: '🏣', tiki: '📬',
        sicepat: '✈️', 'j&t': '🚚', anteraja: '📮',
        wahana: '🚛', rpx: '⚡', pandu: '📬',
      }

      for (const cost of results.costs || []) {
        const costDetail = cost.cost?.[0]
        if (!costDetail) continue

        allResults.push({
          provider: (results.name || c).toUpperCase(),
          service: cost.service,
          name: `${(results.name || c).toUpperCase()} ${cost.service}`,
          price: costDetail.value || 0,
          estimatedDays: costDetail.etd ? `${String(costDetail.etd).replace(/ hari/i, '')} hari` : '2-3 hari',
          logo: logoMap[c.toLowerCase()] || '📦',
        })
      }
    } catch (err) {
      logger.warn({ component: 'rajaongkir', courier: c, err }, 'RajaOngkir cost API call failed')
    }
  }

  return allResults
}

/**
 * Check if RajaOngkir is configured and ready to use.
 */
export function isRajaOngkirConfigured(): boolean {
  return !!getApiKey()
}
