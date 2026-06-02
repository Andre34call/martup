# Task 8: Update seller order management for service orders

## Summary
Updated the SellerOrders component and upload API route to handle service (jasa) orders with proper UI flows.

## Changes Made

### 1. `/api/upload/route.ts` — Added `services` bucket
- Added `services: ['images']` to `ALLOWED_BUCKETS`
- Added `services` bucket config: public, 10MB limit, image-only MIME types
- This allows service proof images to be uploaded via the standard upload endpoint

### 2. `/src/components/ecommerce/seller-screens.tsx` — SellerOrders component

**New imports:**
- `ImagePlus`, `CheckCircle2`, `Timer`, `Upload` from lucide-react
- `useCallback` from react

**New state variables:**
- `showServiceProofDialog`, `serviceProofOrderId`, `serviceProofImages`, `serviceProofNote`, `isUploadingProof`, `isSubmittingProof`

**Order mapping updates:**
- Added `isServiceOrder`, `autoConfirmAt`, `serviceProofImages`, `sellerCompletedAt` to mapped order data
- Fixed `buyerName` to use optional chaining: `o.address?.recipient || o.buyerName || ''`

**New helper functions:**
- `getAutoConfirmCountdown(autoConfirmAt)` — computes remaining time string like "2 hari 5 jam"
- `handleProofImageUpload(file)` — uploads single image via `/api/upload` (bucket: `services`, folder: `images`)
- 1-minute interval timer to update countdown display

**Order card UI changes:**
1. **JASA badge** — Amber "JASA" badge shown on order cards for service orders (next to order number)
2. **Processing + isServiceOrder** — Shows "Kirim Bukti Penyelesaian" button (amber) instead of "Kirim" (tracking number) button
3. **Shipped + isServiceOrder** — Shows amber info panel with:
   - "Menunggu Konfirmasi Pembeli" label with Timer icon
   - Auto-confirm countdown: "Pembayaran otomatis dicairkan dalam X hari X jam"
   - Submitted proof image thumbnails
4. **Processing + !isServiceOrder** — Still shows the regular "Kirim" tracking number button

**New Service Proof Dialog:**
- Title: "Kirim Bukti Penyelesaian Jasa" with ImagePlus icon
- Image upload area: 1-5 images, with preview + remove button per image, upload button with spinner
- Uses `apiClient.upload` to upload each image to `/api/upload` (bucket: `services`, folder: `images`)
- Optional note textarea (max 500 chars)
- Info box explaining: after proof submission, status changes to "Jasa Selesai", buyer confirms, auto-release in 3 days
- Submit button calls `POST /api/orders/[id]/service-proof` with `{ proofImages, note }`
- On success, updates local order status to 'shipped' and shows success toast
- Proper error handling with ApiClientError awareness

## Verification
- ESLint passes ✅
- Dev server compiles ✅ (GET / 200)
- Pre-existing TS error in checkout-screen.tsx (unrelated to this task)
