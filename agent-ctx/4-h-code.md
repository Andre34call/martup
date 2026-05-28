# Task 4-h — Agent: code

## Task: Eliminate dual authToken/martup_token + Add missing Seller type fields

### Changes Made

**Part 1: Eliminate dual `authToken`/`martup_token`**

| File | Change |
|------|--------|
| `src/components/ecommerce/auth-screens.tsx` | Removed `localStorage.setItem('martup_token', ...)` (1 place — OTP verify; login/register already cleaned) |
| `src/lib/api-client.ts` | `getToken()` now only checks `authToken`; updated JSDoc |
| `src/app/page.tsx` | Auth check only reads `authToken` |
| `src/lib/use-data-sync.ts` | Auth check only reads `authToken` |
| `src/lib/store/getAuthHeaders.ts` | Only reads `authToken`; removed compat comment |
| `src/lib/upload.ts` | Only reads `authToken`; removed compat comment |
| `src/lib/store/auth.ts` | KEPT `removeItem('martup_token')` in logout + deleteAccount (cleanup) |

**Part 2: Add missing Seller type fields**

| File | Change |
|------|--------|
| `src/lib/types.ts` | Added `storeProvince?: string` and `storePostalCode?: string` to Seller |
| `src/components/ecommerce/seller-screens.tsx` | Removed 3 `as any` casts for `storeCity`, `storeProvince`, `storePostalCode` |

### Verification
- `bun run lint` passes ✅
- No `martup_token` setItem or getItem calls remain (except removeItem in auth.ts for cleanup)
- No `as any` casts related to Seller type remain
