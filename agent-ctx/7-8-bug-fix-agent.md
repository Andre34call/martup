# Task 7-8: Bug Fix Agent

## Task: Fix seller name 's Store auto-append and product thumbnail display failure

## Changes Made:

### Bug 1: Seller name "'s Store" auto-append
- **File**: `/home/z/my-project/src/app/api/auth/register/route.ts`
- **Fix**: Removed `-store` suffix from `storeSlug` generation
- Changed `const storeSlug = slugify(name) + '-store'` → `const storeSlug = slugify(name)`
- `storeName` was already correctly set to `name` (no "'s Store" suffix)

### Bug 2: Product thumbnails not displaying
- **File**: `/home/z/my-project/src/lib/hash.ts`
- **Fix**: Enhanced `parseJsonField()` to handle multiple image storage formats:
  - Comma-separated URL strings → properly splits into array
  - Single URL strings (not JSON-wrapped) → wraps in array
  - JSON string values (non-array) → wraps in array
  - Relative paths → wraps in array
- This ensures product images display correctly regardless of how they were stored in the database

## Verification:
- Tested register API: storeSlug no longer has `-store` suffix
- Tested products API: images returned as proper arrays (typeof === "object")
- Tested parseJsonField with various edge cases: all pass
- Lint passes clean
- Dev server running successfully
