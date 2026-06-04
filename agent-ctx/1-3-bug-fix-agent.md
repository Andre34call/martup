# Task 1-3 - Bug Fix Agent

## Task: Fix three bugs in MartUp e-commerce admin panel

### Bug 1: AdminUsers shows "User Tidak Ditemukan" (empty list)
**Root Cause**: AdminUsers component didn't call `fetchAdminUsers()` on mount, only read from empty store.
**Fix Applied**:
- Added `fetchAdminUsers` to destructured store values
- Added `useEffect` to call `fetchAdminUsers()` on mount with loading state management
- Added loading spinner shown while fetching
- Replaced store-only `updateAdminUser`/`deleteAdminUser` with real API calls (PATCH/DELETE /api/admin/users)
- Empty state only shows after loading completes with no results

### Bug 2: Banner image upload doesn't work
**Root Cause**: No upload mechanism - only a placeholder click and URL text input.
**Fix Applied**:
- Created `src/app/api/upload/route.ts` - POST endpoint uploading to Supabase Storage 'banners' bucket
- Auto-creates bucket if it doesn't exist (public, 5MB limit)
- Unique filenames via Date.now() + random string
- Updated AdminBanner with hidden file input, upload progress, image preview, and URL fallback

### Bug 3: Banner positions need predefined descriptions
**Root Cause**: Position was a free-text input with no guidance.
**Fix Applied**:
- Added BANNER_POSITIONS constant with 8 positions (value, label, description with dimensions)
- Replaced `<Input>` with `<select>` dropdown
- Shows position description as helper text
- Banner list shows label instead of raw value
- Updated prisma schema comment

### Files Modified
- `src/components/ecommerce/admin-screens.tsx` - AdminUsers and AdminBanner components
- `src/app/api/upload/route.ts` - New file, upload API
- `prisma/schema.prisma` - Banner position comment

### Verification
- Lint passes: 0 errors, 0 warnings
- Dev server compiles successfully
