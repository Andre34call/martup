# Task ID: 6 - Agent: product-edit-fix

## Task: Fix existing images/video lost on product edit

## Summary
Fixed a P0 bug where editing an existing product would silently lose all existing images and video on save.

## Changes Made
All changes in `src/components/ecommerce/seller-add-product-screen.tsx`:

1. **productImages initialization** (line 94): Changed from `[]` to initializer function that parses `editingProduct.images` (handles both `string[]` and JSON string) into `{ id, url }` objects
2. **productVideo initialization** (line 106): Changed type to make `file` optional; initializes with `editingProduct.videoUrl` when editing
3. **videoDeleted state** (line 110): New boolean to track explicit video deletion vs "no video loaded"
4. **Video upload handlers** (lines 281, 286): Reset `videoDeleted` to false on new upload
5. **Image validation** (line 389): Simplified to `productImages.length === 0` (no longer needs editingProduct fallback)
6. **productImages2 computation** (line 433): Always maps from productImages state, filters blob: URLs
7. **Video URL in update API** (line 479): Preserves existing video unless explicitly deleted
8. **Video URL in local store update** (line 516): Same preservation logic
9. **Draft handler images** (line 614): Same fix as submit handler
10. **Draft handler video** (line 653): Same preservation logic
11. **Video remove button** (line 785): Sets both `setProductVideo(null)` and `setVideoDeleted(true)`

## Verification
- `bun run lint`: passes with no errors
- Dev server: running correctly
