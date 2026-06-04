# Task 1a+1b: RajaOngkir API Integration

## Agent: Z.ai Code

## Summary
Implemented complete RajaOngkir API integration for the MartUp e-commerce app, replacing the hardcoded stub with a fully functional city lookup and cost calculation system.

## Changes Made

### 1. Created `/src/lib/rajaongkir.ts` (NEW)
- RajaOngkir API client with full Starter/Pro package support
- `fetchCities()` — Fetches and caches all cities in-memory for 24h with Next.js revalidation
- `findCityId()` — Multi-strategy city ID resolution (exact match → prefix match → partial match → province match)
- `calculateRajaOngkirCost()` — Per-courier cost calculation via `/cost` endpoint
- `isRajaOngkirConfigured()` — Configuration check utility
- Proper error handling and logging throughout

### 2. Updated `/src/lib/shipping-calculator.ts`
- Replaced stub `fetchRajaOngkirRates()` (lines 432-524) with proper implementation
- Now uses dynamic import of `@/lib/rajaongkir` to avoid circular deps
- Resolves city names to RajaOngkir city IDs before calling cost API
- Falls back gracefully to local calculation when city IDs cannot be resolved

### 3. Created `/src/app/api/shipping/cities/route.ts` (NEW)
- `GET /api/shipping/cities` — City search endpoint for frontend address/checkout forms
- Supports `q` (search) and `province` query parameters
- Returns 503 if RajaOngkir not configured
- Limits results to 50 items

### 4. Updated `/src/app/api/shipping/calculate/route.ts`
- Added RajaOngkir configuration status logging after auth check
- Uses safe dynamic import with fallback if module unavailable

### 5. Updated `/src/lib/env.ts`
- Added `RAJAONGKIR_API_KEY` and `RAJAONGKIR_PACKAGE` to recommended vars
- Added `RAJAONGKIR_API_KEY` and `RAJAONGKIR_PACKAGE` to typed env accessor

### 6. Updated `/.env`
- Added `RAJAONGKIR_API_KEY=` (empty by default)
- Added `RAJAONGKIR_PACKAGE=starter`

### 7. Updated `/.env.example`
- Added RajaOngkir section with comments explaining package options

## Lint Results
- No new errors introduced. Pre-existing errors in `auth.ts` and `test-login-api.cjs` remain.

## Dev Server
- Compiles and runs successfully on port 3000.
