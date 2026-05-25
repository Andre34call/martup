# Task 2-6: Create 5 new admin screen components

## Task
Create the file `/home/z/my-project/src/components/ecommerce/admin-new-screens.tsx` containing 5 exported components following existing admin screen patterns.

## Work Done

### File: `/home/z/my-project/src/components/ecommerce/admin-new-screens.tsx`

Completely rewrote the file with all 5 components using **local state + direct API calls** (as specified in task requirements, not store-based approach):

1. **AdminCategories** - Category Management
   - Search bar + All/Active/Inactive filter
   - Add category modal (name, icon optional, parent category dropdown, sort order)
   - Toggle active/inactive, soft delete (sets isActive=false)
   - Parent hierarchy display
   - Fetches from `/api/admin/categories` on mount
   - CRUD via POST/PUT/DELETE to `/api/admin/categories`

2. **AdminVouchers** - Voucher Management
   - Search bar + All/Active/Expired/Inactive filter
   - Full add form (code, name, type percentage/fixed, value, min purchase, max discount, usage limit, per user limit, date range)
   - Toggle active/inactive, hard delete (cascades usages)
   - Fetches from `/api/admin/vouchers` on mount
   - CRUD via POST/PUT/DELETE to `/api/admin/vouchers`

3. **AdminDeposits** - Deposit Verification
   - Summary cards: Pending/Success/Failed counts
   - Total pending amount banner
   - All/Pending/Success/Failed filter
   - Approve/Reject buttons for pending deposits (reject via modal with admin note)
   - View proof image link (opens in new tab)
   - Fetches from `/api/admin/deposits` on mount
   - Update via PUT to `/api/admin/deposits`

4. **AdminCampaigns** - Campaign Moderation
   - All/Active/Inactive/Expired/Upcoming filter
   - Campaign type badges (flash_sale=orange, banner=cyan, boost=emerald)
   - Approve/Reject toggle (isActive)
   - Detail bottom-sheet modal with full campaign info
   - Fetches from `/api/admin/campaigns` on mount
   - Update via PUT to `/api/admin/campaigns`

5. **AdminSettings** - Platform Settings
   - 5 grouped sections: Financial, Product Limits, Feature Toggles, Rewards, Order
   - Input fields for numbers, Switch for toggles
   - Global save button with loading state
   - Fetches from `/api/admin/settings` on mount
   - Save via PUT to `/api/admin/settings`

### Patterns Followed
- Same animation variants (fadeIn, stagger) as existing admin-screens.tsx
- Same import patterns (motion, lucide-react, shadcn/ui, useAppStore for showToast)
- Same shared components (PageHeader, SectionHeader, SearchBar, EmptyState)
- Card-based mobile-first layout with pb-20 spacing
- Indonesian language for labels
- Color scheme: emerald (categories), orange (vouchers), purple (deposits), cyan (campaigns), amber (settings)
- Loading spinners, empty states, AnimatePresence for modals
- All CRUD operations call real API endpoints

### Lint Status
Zero errors
