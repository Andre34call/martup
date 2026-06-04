// ==================== SHIPPING COST CALCULATOR ====================
// RajaOngkir-style shipping cost calculation engine
// Supports zone-based pricing, weight tiers, and RajaOngkir API integration

import { logger, logBusinessEvent } from '@/lib/logger'

// ==================== TYPES ====================

export interface ShippingRateResult {
  provider: string
  service: string
  name: string
  price: number
  estimatedDays: string
  logo: string
}

export interface ShippingCalculationRequest {
  originCity: string
  destinationCity: string
  weight: number // grams
  courier?: string // optional filter for specific courier
}

// ==================== ZONE DETECTION ====================

type Zone = 'same_city' | 'same_province' | 'same_island' | 'inter_island'

// Indonesian island groupings — major cities mapped to their island
const CITY_ISLAND_MAP: Record<string, string> = {
  // Sumatra
  'medan': 'sumatra', 'palembang': 'sumatra', 'bandar lampung': 'sumatra',
  'pekanbaru': 'sumatra', 'padang': 'sumatra', 'jambi': 'sumatra',
  'bengkulu': 'sumatra', 'pangkal pinang': 'sumatra', 'tanjung pinang': 'sumatra',
  'banda aceh': 'sumatra', 'lahat': 'sumatra', 'prabumulih': 'sumatra',
  'dumai': 'sumatra', 'batam': 'sumatra', 'binjai': 'sumatra',
  // Java
  'jakarta': 'java', 'surabaya': 'java', 'bandung': 'java', 'semarang': 'java',
  'yogyakarta': 'java', 'malang': 'java', 'solo': 'java', 'bogor': 'java',
  'bekasi': 'java', 'tangerang': 'java', 'depok': 'java', 'tangerang selatan': 'java',
  'cirebon': 'java', 'sukabumi': 'java', 'tasikmalaya': 'java', 'purwokerto': 'java',
  'magelang': 'java', 'kediri': 'java', 'madiun': 'java', 'jember': 'java',
  'serang': 'java', 'pandeglang': 'java', 'lebak': 'java', 'tuban': 'java',
  'gresik': 'java', 'sidoarjo': 'java', 'mojokerto': 'java',
  // Kalimantan
  'pontianak': 'kalimantan', 'banjarmasin': 'kalimantan', 'saminda': 'kalimantan',
  'palangka raya': 'kalimantan', 'balikpapan': 'kalimantan', 'tarakan': 'kalimantan',
  'samarinda': 'kalimantan', 'singkawang': 'kalimantan', 'kota baru': 'kalimantan',
  // Sulawesi
  'makassar': 'sulawesi', 'manado': 'sulawesi', 'palu': 'sulawesi',
  'kendari': 'sulawesi', 'gorontalo': 'sulawesi', 'mamuju': 'sulawesi',
  'luwuk': 'sulawesi', 'bitung': 'sulawesi', 'tomohon': 'sulawesi',
  // Bali & Nusa Tenggara
  'denpasar': 'bali_nusa_tenggara', 'mataram': 'bali_nusa_tenggara',
  'kupang': 'bali_nusa_tenggara', 'singaraja': 'bali_nusa_tenggara',
  'bima': 'bali_nusa_tenggara', ' Ende': 'bali_nusa_tenggara',
  // Maluku
  'ambon': 'maluku', 'ternate': 'maluku', 'tiahu': 'maluku',
  'soa siu': 'maluku', 'masohi': 'maluku',
  // Papua
  'jayapura': 'papua', 'sorong': 'papua', 'merauke': 'papua',
  'biak': 'papua', 'timika': 'papua', 'wamena': 'papua',
  'manokwari': 'papua', 'nabire': 'papua',
}

// Province to island mapping for when city isn't directly found
const PROVINCE_ISLAND_MAP: Record<string, string> = {
  'aceh': 'sumatra', 'sumatera utara': 'sumatra', 'sumatera barat': 'sumatra',
  'riau': 'sumatra', 'sumatera selatan': 'sumatra', 'jambi': 'sumatra',
  'bengkulu': 'sumatra', 'lampung': 'sumatra', 'kepulauan riau': 'sumatra',
  'kep. riau': 'sumatra', 'bangka belitung': 'sumatra',
  'dki jakarta': 'java', 'jakarta': 'java', 'jawa barat': 'java',
  'jawa tengah': 'java', 'di yogyakarta': 'java', 'jawa timur': 'java',
  'banten': 'java',
  'kalimantan barat': 'kalimantan', 'kalimantan tengah': 'kalimantan',
  'kalimantan selatan': 'kalimantan', 'kalimantan timur': 'kalimantan',
  'kalimantan utara': 'kalimantan',
  'sulawesi utara': 'sulawesi', 'sulawesi tengah': 'sulawesi',
  'sulawesi selatan': 'sulawesi', 'sulawesi tenggara': 'sulawesi',
  'gorontalo': 'sulawesi', 'sulawesi barat': 'sulawesi',
  'bali': 'bali_nusa_tenggara', 'nusa tenggara barat': 'bali_nusa_tenggara',
  'nusa tenggara timur': 'bali_nusa_tenggara',
  'maluku': 'maluku', 'maluku utara': 'maluku',
  'papua': 'papua', 'papua barat': 'papua',
}

// Province groups for same-province detection
const PROVINCE_CITY_MAP: Record<string, string[]> = {
  'dki jakarta': ['jakarta', 'jakarta pusat', 'jakarta utara', 'jakarta barat', 'jakarta selatan', 'jakarta timur'],
  'jawa barat': ['bandung', 'bogor', 'bekasi', 'cirebon', 'sukabumi', 'tasikmalaya', 'depok', 'tangerang', 'tangerang selatan'],
  'jawa tengah': ['semarang', 'surakarta', 'solo', 'magelang', 'purwokerto', 'pekalongan', 'tegal', 'kudus', 'jepara', 'kendal'],
  'jawa timur': ['surabaya', 'malang', 'kediri', 'madiun', 'jember', 'gresik', 'sidoarjo', 'mojokerto', 'tuban', 'blitar', 'pasuruan'],
  'di yogyakarta': ['yogyakarta', 'sleman', 'bantul', 'gunung kidul', 'kulon progo'],
  'banten': ['tangerang', 'tangerang selatan', 'serang', 'cilegon', 'pandeglang', 'lebak'],
  'sumatera utara': ['medan', 'binjai', 'pematang siantar', 'tebing tinggi', 'tanjung balai'],
  'sumatera selatan': ['palembang', 'prabumulih', 'lahat', 'baturaja'],
  'lampung': ['bandar lampung', 'metro', 'kotabumi'],
  'sulawesi selatan': ['makassar', 'palopo', 'pangkajene'],
  'kalimantan timur': ['samarinda', 'balikpapan', 'bontang', 'tenggarong'],
  'kalimantan selatan': ['banjarmasin', 'banjarbaru', 'martapura'],
}

/**
 * Detect the shipping zone between origin and destination.
 * Uses city name matching, province data, and island groupings.
 */
export function detectZone(
  originCity: string,
  destinationCity: string,
  originProvince?: string,
  destinationProvince?: string
): Zone {
  const origin = originCity.toLowerCase().trim()
  const dest = destinationCity.toLowerCase().trim()

  // Same city
  if (origin === dest) return 'same_city'

  // Check province match if provinces provided
  if (originProvince && destinationProvince) {
    const op = originProvince.toLowerCase().trim()
    const dp = destinationProvince.toLowerCase().trim()
    if (op === dp) return 'same_province'

    // Check if cities are in same province via mapping
    for (const [, cities] of Object.entries(PROVINCE_CITY_MAP)) {
      const lowerCities = cities.map(c => c.toLowerCase())
      if (lowerCities.includes(origin) && lowerCities.includes(dest)) {
        return 'same_province'
      }
    }
  }

  // Check island grouping
  const originIsland = CITY_ISLAND_MAP[origin] ||
    (originProvince ? PROVINCE_ISLAND_MAP[originProvince.toLowerCase().trim()] : null)
  const destIsland = CITY_ISLAND_MAP[dest] ||
    (destinationProvince ? PROVINCE_ISLAND_MAP[destinationProvince.toLowerCase().trim()] : null)

  if (originIsland && destIsland) {
    if (originIsland === destIsland) return 'same_island'
    return 'inter_island'
  }

  // Fallback: if we can't determine, assume same island for Java-originating shipments
  // (most Indonesian e-commerce ships from Java)
  if (originIsland === 'java' || destIsland === 'java') {
    if (originIsland && destIsland && originIsland !== destIsland) return 'inter_island'
    return 'same_island'
  }

  // Default to inter-island for safety (higher cost = better than undercharging)
  return 'inter_island'
}

// ==================== COURIER CONFIGURATION ====================

interface CourierServiceConfig {
  service: string
  name: string
  description: string
  estimatedDays: Record<Zone, string>
  baseRate: Record<Zone, number> // base price in IDR
  perKgRate: Record<Zone, number> // per kg rate in IDR
}

interface CourierConfig {
  provider: string
  logo: string
  services: CourierServiceConfig[]
}

const COURIER_CONFIG: Record<string, CourierConfig> = {
  jne: {
    provider: 'JNE',
    logo: '📦',
    services: [
      {
        service: 'REG',
        name: 'JNE Reguler',
        description: 'Layanan reguler JNE, estimasi 2-3 hari',
        estimatedDays: {
          same_city: '1-2 hari',
          same_province: '1-2 hari',
          same_island: '2-3 hari',
          inter_island: '3-5 hari',
        },
        baseRate: { same_city: 8000, same_province: 10000, same_island: 15000, inter_island: 25000 },
        perKgRate: { same_city: 2000, same_province: 2500, same_island: 3500, inter_island: 5000 },
      },
      {
        service: 'YES',
        name: 'JNE YES (Yakin Esok Sampai)',
        description: 'Layanan express JNE, estimasi 1 hari',
        estimatedDays: {
          same_city: '1 hari',
          same_province: '1 hari',
          same_island: '1-2 hari',
          inter_island: '2-3 hari',
        },
        baseRate: { same_city: 14000, same_province: 18000, same_island: 25000, inter_island: 38000 },
        perKgRate: { same_city: 3500, same_province: 4000, same_island: 5000, inter_island: 7000 },
      },
    ],
  },
  sicepat: {
    provider: 'SiCepat',
    logo: '✈️',
    services: [
      {
        service: 'REG',
        name: 'SiCepat Reguler',
        description: 'Layanan reguler SiCepat, estimasi 2-3 hari',
        estimatedDays: {
          same_city: '1-2 hari',
          same_province: '1-2 hari',
          same_island: '2-3 hari',
          inter_island: '3-5 hari',
        },
        baseRate: { same_city: 7000, same_province: 9000, same_island: 13000, inter_island: 22000 },
        perKgRate: { same_city: 1500, same_province: 2000, same_island: 3000, inter_island: 4000 },
      },
      {
        service: 'BEST',
        name: 'SiCepat BEST (Besok Sampai Tinggal)',
        description: 'Layanan express SiCepat, estimasi 1-2 hari',
        estimatedDays: {
          same_city: '1 hari',
          same_province: '1 hari',
          same_island: '1-2 hari',
          inter_island: '2-3 hari',
        },
        baseRate: { same_city: 12000, same_province: 16000, same_island: 22000, inter_island: 33000 },
        perKgRate: { same_city: 3000, same_province: 3500, same_island: 4500, inter_island: 6000 },
      },
    ],
  },
  jnt: {
    provider: 'J&T',
    logo: '🚚',
    services: [
      {
        service: 'EZ',
        name: 'J&T Express EZ',
        description: 'Layanan express J&T, estimasi 2-3 hari',
        estimatedDays: {
          same_city: '1-2 hari',
          same_province: '1-2 hari',
          same_island: '2-3 hari',
          inter_island: '3-4 hari',
        },
        baseRate: { same_city: 6000, same_province: 8000, same_island: 12000, inter_island: 20000 },
        perKgRate: { same_city: 1500, same_province: 2000, same_island: 2500, inter_island: 3500 },
      },
    ],
  },
  anteraja: {
    provider: 'AnterAja',
    logo: '📮',
    services: [
      {
        service: 'REG',
        name: 'AnterAja Reguler',
        description: 'Layanan reguler AnterAja, estimasi 3-5 hari',
        estimatedDays: {
          same_city: '1-2 hari',
          same_province: '2-3 hari',
          same_island: '3-4 hari',
          inter_island: '4-5 hari',
        },
        baseRate: { same_city: 5000, same_province: 7000, same_island: 10000, inter_island: 18000 },
        perKgRate: { same_city: 1000, same_province: 1500, same_island: 2000, inter_island: 3000 },
      },
    ],
  },
  tiki: {
    provider: 'Tiki',
    logo: '📬',
    services: [
      {
        service: 'REG',
        name: 'Tiki Reguler',
        description: 'Layanan reguler Tiki, estimasi 2-3 hari',
        estimatedDays: {
          same_city: '1-2 hari',
          same_province: '2-3 hari',
          same_island: '2-3 hari',
          inter_island: '3-5 hari',
        },
        baseRate: { same_city: 7000, same_province: 10000, same_island: 14000, inter_island: 23000 },
        perKgRate: { same_city: 2000, same_province: 2500, same_island: 3000, inter_island: 4000 },
      },
    ],
  },
  pos: {
    provider: 'POS Indonesia',
    logo: '🏣',
    services: [
      {
        service: 'KILAT',
        name: 'POS Kilat Khusus',
        description: 'Layanan kilat POS Indonesia, estimasi 2-4 hari',
        estimatedDays: {
          same_city: '1-2 hari',
          same_province: '2-3 hari',
          same_island: '2-3 hari',
          inter_island: '3-4 hari',
        },
        baseRate: { same_city: 6000, same_province: 8000, same_island: 12000, inter_island: 20000 },
        perKgRate: { same_city: 1000, same_province: 1500, same_island: 2000, inter_island: 3000 },
      },
    ],
  },
}

// ==================== WEIGHT CALCULATION ====================

/**
 * Calculate effective weight for shipping.
 * Minimum weight is 1kg (1000g). Weight is rounded up to the nearest kg.
 */
function calculateEffectiveWeight(weightGrams: number): number {
  // Minimum 1kg
  const minWeight = 1000
  if (weightGrams <= 0) return 1

  // Round up to nearest kg
  const kg = Math.ceil(weightGrams / 1000)
  return Math.max(kg, 1)
}

// ==================== RATE CALCULATION ====================

/**
 * Calculate shipping rates based on origin, destination, and weight.
 * Uses zone-based pricing with per-kg rates.
 */
export async function calculateShippingRates(
  request: ShippingCalculationRequest
): Promise<ShippingRateResult[]> {
  const { originCity, destinationCity, weight, courier } = request

  logger.info(
    { component: 'shipping', originCity, destinationCity, weight, courier },
    'Calculating shipping rates'
  )

  // Try RajaOngkir API first if key is configured
  const rajaOngkirKey = process.env.RAJAONGKIR_API_KEY
  if (rajaOngkirKey) {
    try {
      const apiRates = await fetchRajaOngkirRates(
        originCity, destinationCity, weight, courier, rajaOngkirKey
      )
      if (apiRates.length > 0) {
        logBusinessEvent({
          event: 'shipping_rates_calculated',
          details: { source: 'rajaongkir', originCity, destinationCity, weight, rateCount: apiRates.length },
        })
        return apiRates
      }
    } catch (err) {
      logger.warn(
        { component: 'shipping', err, originCity, destinationCity },
        'RajaOngkir API failed, falling back to local calculation'
      )
    }
  }

  // Local calculation
  const zone = detectZone(originCity, destinationCity)
  const effectiveWeightKg = calculateEffectiveWeight(weight)

  logger.debug(
    { component: 'shipping', zone, effectiveWeightKg, originCity, destinationCity },
    'Using local shipping calculation'
  )

  const results: ShippingRateResult[] = []

  const courierEntries = courier
    ? [[courier.toLowerCase(), COURIER_CONFIG[courier.toLowerCase()]]] as const
    : Object.entries(COURIER_CONFIG)

  for (const [key, config] of courierEntries) {
    if (!config) {
      logger.warn({ component: 'shipping', courier: key }, 'Unknown courier requested')
      continue
    }

    for (const service of config.services) {
      const baseRate = service.baseRate[zone]
      const perKgRate = service.perKgRate[zone]
      const estimatedDays = service.estimatedDays[zone]

      // Price = base rate + (perKgRate * (effectiveWeightKg - 1))
      // First kg is included in base rate
      const additionalKg = Math.max(0, effectiveWeightKg - 1)
      const price = baseRate + (perKgRate * additionalKg)

      // Round to nearest 100 IDR
      const roundedPrice = Math.round(price / 100) * 100

      results.push({
        provider: config.provider,
        service: service.service,
        name: service.name,
        price: roundedPrice,
        estimatedDays,
        logo: config.logo,
      })
    }
  }

  logBusinessEvent({
    event: 'shipping_rates_calculated',
    details: { source: 'local', zone, originCity, destinationCity, weight, effectiveWeightKg, rateCount: results.length },
  })

  return results
}

// ==================== RAJAONGKIR API INTEGRATION ====================

/**
 * Fetch shipping rates from RajaOngkir API.
 * Uses the rajaongkir.ts module for city ID resolution and cost calculation.
 * Falls back to local calculation if city IDs cannot be resolved.
 *
 * RajaOngkir Starter API supports: jne, pos, tiki
 * RajaOngkir Pro API supports: jne, pos, tiki, wahana, jnt, rpx, pandu, sicepat, anteraja, dse, lion, ncs, star, tiki
 */
async function fetchRajaOngkirRates(
  originCity: string,
  destinationCity: string,
  weight: number,
  courier?: string,
  apiKey?: string
): Promise<ShippingRateResult[]> {
  if (!apiKey) return []

  try {
    // Import dynamically to avoid circular deps and allow tree-shaking when not configured
    const { findCityId, calculateRajaOngkirCost } = await import('@/lib/rajaongkir')

    // Resolve city names to RajaOngkir city IDs
    const [originId, destinationId] = await Promise.all([
      findCityId(originCity),
      findCityId(destinationCity),
    ])

    if (!originId || !destinationId) {
      logger.info(
        { component: 'shipping', originCity, destinationCity, originId, destinationId },
        'Could not resolve RajaOngkir city IDs — falling back to local calculation'
      )
      return []
    }

    const rates = await calculateRajaOngkirCost(originId, destinationId, weight, courier)

    logger.info(
      { component: 'shipping', originCity, destinationCity, originId, destinationId, rateCount: rates.length },
      'RajaOngkir rates fetched successfully'
    )

    return rates
  } catch (err) {
    logger.warn(
      { component: 'shipping', err, originCity, destinationCity },
      'RajaOngkir integration error — falling back to local calculation'
    )
    return []
  }
}

// ==================== COURIER METADATA ====================

export interface CourierInfo {
  provider: string
  logo: string
  services: {
    service: string
    name: string
    description: string
  }[]
}

/**
 * Get list of all supported couriers with their services.
 */
export function getSupportedCouriers(): CourierInfo[] {
  return Object.values(COURIER_CONFIG).map(config => ({
    provider: config.provider,
    logo: config.logo,
    services: config.services.map(s => ({
      service: s.service,
      name: s.name,
      description: s.description,
    })),
  }))
}

/**
 * Check if a courier provider is supported.
 */
export function isValidCourier(provider: string): boolean {
  return provider.toLowerCase() in COURIER_CONFIG
}

/**
 * Get the list of valid courier provider names.
 */
export function getValidCourierNames(): string[] {
  return Object.keys(COURIER_CONFIG).map(k => k.toUpperCase())
}
