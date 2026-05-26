# Task 4a - Shipping Calculator Agent

## Summary
Built a RajaOngkir-style shipping cost calculator with 2 new API endpoints, a core calculation engine, and dynamic checkout integration.

## Files Created
- `/src/lib/shipping-calculator.ts` — Core engine with zone detection, courier config, rate calculation
- `/src/app/api/shipping/calculate/route.ts` — POST endpoint (auth required, rate limited)
- `/src/app/api/shipping/couriers/route.ts` — GET endpoint (public)

## Files Modified
- `/src/lib/constants.ts` — Added DEFAULT_SHIPPING_OPTIONS and COURIER_PROVIDERS
- `/src/components/ecommerce/checkout-screen.tsx` — Dynamic shipping rates from API with loading states

## Key Architecture Decisions
1. Zone-based pricing: same_city → same_province → same_island → inter_island
2. 6 couriers with 10 services (JNE REG/YES, SiCepat REG/BEST, J&T EZ, AnterAja REG, Tiki REG, POS KILAT)
3. Weight calculation: ceil(weight/1000) kg, minimum 1kg, first kg included in base rate
4. RajaOngkir API integration stub gated by RAJAONGKIR_API_KEY env var
5. Graceful fallback to DEFAULT_SHIPPING_OPTIONS on any API failure

## Lint Status
- 0 errors, 0 warnings
