# Task b1-2: Build Complete Refund/Return System

## Summary
Built a complete refund/return system with buyer-facing API routes and a fully functional RefundScreen component.

## Files Created
1. `src/app/api/complaints/route.ts` — POST (create complaint) + GET (list user's complaints)
2. `src/app/api/complaints/[id]/route.ts` — GET (complaint detail) + PUT (add message/evidence)

## Files Modified
1. `src/components/ecommerce/screens/refund-screen.tsx` — Complete rewrite with API integration

## Key Design Decisions
- Complaint model uses `orderId` as `@unique`, so only one complaint per order (matches Prisma schema)
- Buyer can add messages to active complaints (open/processing) via PUT — messages appended with timestamp separator
- Evidence images uploaded via `/api/upload` before complaint creation (real Supabase URLs)
- Admin notifications sent to admin/manager/cs roles on complaint creation
- Work item auto-created for CS division via createWorkItemFromEntity
- Status timeline derived from complaint status transitions (open → processing → resolved/rejected)

## API Patterns Used
- `verifyAuth` for authentication (consistent with existing routes)
- `sanitizeInput` for user-generated text
- `serializeDecimal` for Prisma Decimal fields
- `apiClient` for frontend API calls (consistent with codebase conventions)
