# Task 2-d: Add Search Filters to Search Screen

## Agent: Main
## Status: Completed

## Summary
Added comprehensive search filters (price range, sort, condition, location) to the MartUp e-commerce search screen.

## Changes Made

### File: `src/components/ecommerce/search-screen.tsx`

1. **Filter State Variables** (6 new state vars):
   - `showFilters` - toggles filter panel visibility
   - `priceMin` / `priceMax` - price range inputs
   - `condition` - "all" | "new" | "used"
   - `sortBy` - "relevant" | "price-low" | "price-high" | "newest" | "popular"
   - `location` - "all" | "jakarta" | "bandung" | "surabaya"

2. **Filter Toggle Button** in search bar:
   - `SlidersHorizontal` icon from lucide-react
   - Active state: emerald background
   - Badge dot when filters are active (condition !== "all" || priceMin || priceMax || location !== "all" || sortBy !== "relevant")

3. **Animated Filter Panel** (AnimatePresence):
   - Sort section with 5 pill buttons
   - Price range with Min/Max number inputs
   - Condition section with 3 pill buttons
   - Location section with 4 pill buttons
   - Reset Filter + Terapkan buttons
   - Only visible when `showFilters && isSearching`

4. **Updated searchResults useMemo**:
   - Condition filter: filters by `p.condition`
   - Price range: filters by `discountPrice || price`
   - Location filter: maps cities to seller storeName keywords
   - Sort: price-low, price-high, popular (by sold), newest (no-op), relevant (default)
   - Dependencies: `[debouncedQuery, selectedCategoryId, condition, priceMin, priceMax, sortBy, location]`

5. **Updated Results Header**:
   - Shows "Ditemukan X produk" with optional "untuk Y" query
   - Active filter summary in emerald text (condition, price range, location)

## Verification
- `bun run lint` passes cleanly
- Dev server compiles successfully
