# Task 1-a: Server-Side Price Verification Fix

## Summary
Fixed CRITICAL security vulnerability in order creation API where a malicious client could submit orders with arbitrary prices (e.g., `price: 0`, `totalAmount: 0`).

## File Changed
- `/home/z/my-project/src/app/api/orders/route.ts` — POST handler

## Changes Made

### 1. Address Ownership Verification (CB-5)
- Added lookup of `addressId` from DB before the transaction
- Verifies `address.userId === authResult.user.id`
- Returns 400 if address not found, 403 if doesn't belong to user
- All error messages in Indonesian

### 2. Server-Side Price Computation
Inside the transaction, after re-validating stock:
- Looks up each product's `price` and `discountPrice` via `tx.product.findUnique()`
- Looks up variant price via `tx.productVariant.findUnique()` if `variantId` is provided
- Computes `item.price` server-side:
  - If variant has a price → use variant price
  - If product has `discountPrice` → use discountPrice
  - Otherwise → use product's regular `price`
- Computes `item.subtotal = price × quantity`
- Computes `subtotal` = sum of all item subtotals
- Computes `totalAmount = subtotal + shippingCost + taxAmount + platformFee − discountAmount`
- All client-submitted price/subtotal/totalAmount values are IGNORED

### 3. Server-Side Voucher Validation
If `voucherCode` is provided:
- Looks up voucher from DB inside the transaction
- Validates: `isActive`, valid date range, `minPurchase` vs server-computed subtotal, `usageLimit`, `perUserLimit`, `sellerId` match
- Calculates `discountAmount` server-side:
  - Percentage type: `subtotal × (value / 100)` with `maxDiscount` cap
  - Fixed type: `value`
- Ensures discount doesn't exceed subtotal, rounds down to integer
- Creates `VoucherUsage` record
- Increments `voucher.usageCount`

### 4. Indonesian Error Messages
- Stock validation errors translated to Indonesian
- Product not found: "Produk tidak ditemukan"
- Insufficient stock: "Stok tidak mencukupi untuk..."
- All voucher validation errors in Indonesian

## Schema Notes
- `createOrderSchema` left unchanged — optional price fields maintain backward compatibility
- Client-submitted `price`, `subtotal`, `totalAmount` fields are accepted by schema but completely ignored in the handler

## Verification
- ESLint: passes clean
- Dev server: compiles successfully
