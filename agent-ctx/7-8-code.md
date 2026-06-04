# Task 7-8: Update HomeScreen + ProductCard with Promoted/Viral sections and badges

## Work Completed

### HomeScreen (`src/components/ecommerce/home-screen.tsx`)
- Added `Target, Flame` icons from lucide-react
- Added `apiClient` import from `@/lib/api-client`
- Added `promotedProducts` and `viralProducts` state
- Added useEffect to fetch promoted + viral products from API on mount
- Added "Promo Pilihan 🎯" horizontal scroll section with IKLAN badge
- Added "Lagi Viral 🔥" horizontal scroll section with ranking badges
- Changed feed subtitle to "Urutan berdasarkan popularitas"

### ProductCard (`src/components/ecommerce/shared/product.tsx`)
- Added `Flame` icon from lucide-react
- Added `showViralBadge` and `showPromotedBadge` optional props
- Added IKLAN badge (amber, shown for promoted products)
- Added VIRAL badge (red-orange gradient, shown for high viral score products, hidden when promoted)

### Verification
- Lint passes ✅
- No breaking changes to existing usages
