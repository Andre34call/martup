# Task 4-g: Add Zod validation to critical API routes

## Summary
Added 10 new Zod validation schemas and applied them to 7 API routes (10 handler methods) that previously lacked Zod input validation.

## Changes Made

### src/lib/validations.ts
Added 10 new schemas:
- `walletDebitSchema` — orderId (required), amount (positive), description (optional)
- `paymentCreateSchema` — orderId (required)
- `createOrderSchema` — userId, sellerId, items (array), addressId (required); amounts, shipping, voucherCode (optional)
- `updateOrderSchema` — orderId (required); status, paymentStatus, trackingNumber (optional)
- `createAddressSchema` — all address fields required with max lengths; isDefault optional
- `updateAddressSchema` — addressId required; all others optional
- `deleteAddressSchema` — addressId required
- `sellerRegisterSchema` — userId, storeName required; optional store/bank fields
- `sellerProfileUpdateSchema` — all fields optional with max lengths
- `sellerWithdrawSchema` — amount (positive) required; bank fields optional

### API Routes Modified
1. **wallet/debit** — Replaced inline amount/orderId validation
2. **payment/create** — Replaced inline !orderId check
3. **orders POST** — Replaced 4 inline required-field checks
4. **orders PUT** — Replaced inline !orderId check
5. **addresses POST** — Replaced validateCreateFields() with Zod + kept phone/postal format checks
6. **addresses PUT** — Added Zod; removed redundant length checks; kept format checks
7. **addresses DELETE** — Replaced inline !addressId check
8. **seller/register** — Replaced inline userId/storeName checks
9. **seller/profile PUT** — Added Zod for structure; kept domain-specific bank validation
10. **seller/withdraw** — Replaced inline amount check; kept min withdrawal/bank checks

### Skipped
- **user/avatar** — FormData upload, not JSON body
- **user/delete** — No request body

## Verification
- Lint passes ✅
- Dev server compiles ✅
