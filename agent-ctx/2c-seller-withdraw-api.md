# Task 2c - Seller Withdraw API Backend

## Summary
Created the `/api/seller/withdraw` route that allows authenticated sellers to create and view withdrawal requests.

## File Created
- `src/app/api/seller/withdraw/route.ts`

## API Endpoints

### POST /api/seller/withdraw
Creates a new withdrawal request for the authenticated seller.

**Auth:** Required + seller verification  
**Rate limit:** 5 requests/minute per user  
**Body:** `{ amount, bankAccount?, bankName?, bankHolder? }`

**Flow:**
1. Verify auth + seller record exists
2. Rate limit check
3. Resolve bank details (body params fallback to seller profile)
4. Validate bank details complete, amount > 0, amount >= 10000, amount <= available balance
5. **Atomic transaction:**
   - Find seller's wallet
   - Check available balance (balance - holdBalance)
   - Decrement balance, increment holdBalance
   - Create Withdrawal record (status: "pending")
   - Create WalletMutation (type: "debit", refType: "withdraw")

### GET /api/seller/withdraw?id=xxx
Get a single withdrawal by ID. Verifies ownership.

### GET /api/seller/withdraw?sellerId=xxx&status=xxx&limit=20&offset=0
List withdrawals for a seller with pagination and optional status filter.

## Security Measures
- Auth required + seller ownership verification on all endpoints
- Atomic wallet balance check and hold transfer (Prisma transaction) prevents race conditions
- Minimum withdrawal amount: Rp 10,000
- Rate limit: 5/min to prevent spam
- Bank details validation (must be complete)
- Seller can only view their own withdrawals (admin can view any)

## Patterns Used
- `verifyAuth` + `authErrorResponse` from `@/lib/auth-middleware`
- `checkRateLimit` from `@/lib/auth-middleware`
- `serializeDecimal` from `@/lib/decimal-utils`
- `Prisma.Decimal` for financial amounts
- Standard `{ success: true/false, data/error: ... }` response format
