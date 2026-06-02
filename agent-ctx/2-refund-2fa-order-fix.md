# Task 2: Build Refund/Return System + Fix 2FA + Fix Admin Orders

## Work Log

### Task 1: Build Full Refund/Return System

**Findings:**
- The buyer-facing API `/api/complaints/route.ts` already existed with POST and GET handlers
- The `/api/complaints/[id]/route.ts` already existed with GET and PUT handlers
- The `refund-screen.tsx` already used `apiClient` for all API calls
- The `Complaint` model in Prisma schema already had all needed fields

**Gaps identified and fixed:**

1. **GET `/api/complaints/route.ts`** — Enhanced with:
   - Added `type` query parameter filtering (e.g., `?type=refund,return`)
   - Added comma-separated status filtering (e.g., `?status=open,processing`)
   - Added 'cancelled' to the "closed" preset filter (`resolved, rejected, cancelled`)

2. **PUT `/api/complaints/[id]/route.ts`** — Added cancel action:
   - New `action: 'cancel'` body parameter support
   - Buyer can cancel complaint only if status is 'open' (not yet processed by admin)
   - Sets status to 'cancelled' and returns updated complaint

3. **`refund-screen.tsx`** — Enhanced:
   - Added 'cancelled' to `STATUS_LABELS` and `STATUS_COLORS`
   - Added 'cancelled' to `closedComplaints` filter
   - Added `handleCancelComplaint()` function using `apiClient.put`
   - Added cancel button for open complaints ("Batalkan Pengajuan")
   - Added `ComplaintCancelResponse` type alias

4. **`admin/complaints.tsx`** — Enhanced:
   - Added 'cancelled' to `statusLabel` and `statusColor` maps
   - Added 'cancelled' tab option
   - Hide action buttons for cancelled complaints (same as resolved)

### Task 2: Fix 2FA OTP Crash

**Findings:**
- The length check before `timingSafeEqual` was already present (line 179)
- The null check for `user.otpCode` was already present (line 159)

**Fix applied:**
- Wrapped `crypto.timingSafeEqual()` call in a dedicated try/catch block
- On catch, returns proper error response instead of falling through to generic server error
- This provides defense-in-depth: even if the length check somehow fails, the try/catch prevents an unhandled crash

### Task 3: Fix Admin Order Update — Internal Fetch Issue

**Findings:**
- This was ALREADY FIXED by a previous agent
- `src/lib/order-utils.ts` already exists with `updateOrderStatus()` shared function
- `/api/admin/orders/route.ts` already imports and calls `updateOrderStatus()` directly
- `/api/orders/[id]/status/route.ts` also uses the same shared function
- No internal fetch calls remain in admin orders route

**No changes needed** — verified the shared function handles: status validation, stock restoration on cancel, wallet operations, notification creation

### Verification
- Lint passes ✅
- Dev server compiles and renders ✅ (GET / 200)
