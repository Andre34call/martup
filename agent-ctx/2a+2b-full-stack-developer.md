# Task 2a+2b: Full-Stack Developer Work Record

## Task A: Remove DEFAULT_SHIPPING_OPTIONS Fallback

### Problem
When the shipping API fails, checkout silently falls back to hardcoded `DEFAULT_SHIPPING_OPTIONS` (JNE REG 15K, JNE YES 30K, etc.). These are NOT real rates and could charge buyers incorrectly.

### Changes Made
1. **checkout-screen.tsx** (root level — the one used by screen-registry):
   - Removed `DEFAULT_SHIPPING_OPTIONS` import
   - Added `shippingError` state (`Record<string, string>`)
   - `fetchShippingRates`: sets error instead of defaults on failure/empty
   - `getShippingOptions`: returns `[]` instead of `DEFAULT_SHIPPING_OPTIONS`
   - `isReadyToPay`: checks `hasNoShippingErrors`
   - `ShippingSelector`: added `error`/`onRetry` props, shows red error card with "Hitung Ulang" button

2. **checkout/checkout-screen.tsx** (subfolder — parallel version):
   - Same changes as above for consistency

3. **checkout/shipping-step.tsx** (subfolder):
   - Added `error`/`onRetry` props and error UI to exported `ShippingSelector`

4. **constants.ts**:
   - Removed `DEFAULT_SHIPPING_OPTIONS` constant
   - Kept `SHIPPING_OPTIONS` (used in product detail display only)

## Task B: Add RajaOngkir City Autocomplete

### Problem
Address form has free-text city/province fields. If buyer types a city name that doesn't match RajaOngkir's database, shipping calculation fails.

### Changes Made
1. **address-screen.tsx** — Complete rewrite:
   - Created `CityAutocomplete` component with:
     - Debounced search (300ms) against `/api/shipping/cities?q=`
     - Dropdown showing city name + province
     - Keyboard navigation (ArrowUp/Down, Enter, Escape)
     - Click-outside to close
     - Auto-fills province on city select
     - Auto-fills postal code if available
     - Loading spinner during search
   - Province field remains editable after auto-fill
   - Graceful fallback when RajaOngkir is not configured

2. **Verified /api/shipping/cities endpoint** works correctly (returns 503 when RAJAONGKIR_API_KEY not set, returns city data when configured)

## Files Modified
- `src/components/ecommerce/checkout-screen.tsx`
- `src/components/ecommerce/checkout/checkout-screen.tsx`
- `src/components/ecommerce/checkout/shipping-step.tsx`
- `src/components/ecommerce/screens/address-screen.tsx`
- `src/lib/constants.ts`

## Lint Result
0 errors
