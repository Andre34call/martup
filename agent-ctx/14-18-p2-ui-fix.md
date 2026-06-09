# Task 14-18: P2 UI Fix Agent

## Summary
Fixed 5 P2 UI bugs in seller product management screens across 2 files.

## Files Modified
1. `src/components/ecommerce/seller/seller-products.tsx` — Complete rewrite for Fix 1 & Fix 4
2. `src/components/ecommerce/seller-add-product-screen.tsx` — Fixes 2, 3, 5

## Changes Made

### Fix 1 (Task 14): Product visibility toggle
- Added Eye/EyeOff toggle button per product card
- Calls PUT /api/seller/products with status: 'draft'/'active'
- Per-product togglingId state for loading indicator
- Toast feedback on success/error

### Fix 2 (Task 15): Category dropdown outside click
- Added categoryDropdownRef + useEffect with mousedown listener
- Also closes on scroll (capture phase)
- Properly cleans up on unmount/close

### Fix 3 (Task 16): Inline upload indicators
- Removed full-screen z-[150] overlay
- Per-image isUploading flag on productImages entries
- Placeholder entries added immediately with blob URL + spinner overlay
- Each image updates independently as upload completes
- isVideoUploading state for video upload inline spinner
- Removed global isUploading state (replaced by per-image flags + isVideoUploading)
- User can continue filling form while uploads proceed

### Fix 4 (Task 17): Server data for product list
- Fetches from GET /api/seller/products?sellerId={id} instead of filtering local store
- useState + useEffect for data fetching with loading state
- RefreshCw button in header
- Falls back to local store on API failure

### Fix 5 (Task 18): Draft persistence via API
- handleDraft now async with API call
- POST for new drafts, PUT for existing
- Falls back to local save on error
- Updates local store with server response on success
- Toast "Draft berhasil disimpan" on success

## Pre-existing fixes preserved
- productImages and productVideo initialization (Task 6, 9)
- videoDeleted state, isSubmitting state, maxLength, SVG validation
- All lint checks pass
