# Task 2b - Address CRUD API Agent

## Task
Create the Address CRUD API backend at `/api/addresses/route.ts` for Phase 2 of the MartUp e-commerce app.

## What Was Done
- Reviewed existing auth middleware patterns (verifyAuth, authErrorResponse, checkRateLimit)
- Reviewed existing API routes (wishlist, orders) for consistent patterns
- Created `/src/app/api/addresses/route.ts` with four HTTP method handlers:

### GET /api/addresses
- Auth required, userId query param validated against auth user
- Returns addresses ordered by isDefault desc, createdAt desc

### POST /api/addresses
- Auth required + rate limit (10/min)
- Full field validation (required fields, length limits, phone format, postal code format)
- Max 10 addresses per user
- Transactional isDefault handling (unsets others when setting new default)
- First address auto-forced as default

### PUT /api/addresses
- Auth required + ownership verification
- Partial updates with per-field validation
- Transactional isDefault handling
- Phone/postalCode validated only when provided

### DELETE /api/addresses
- Auth required + ownership verification
- Transactional: if deleting default, reassigns to most recent remaining address

## Validation Rules Implemented
- label: max 50 chars
- recipient: max 100 chars
- phone: Indonesian format (0xxx or +62xxx, 10-15 digits)
- address: max 500 chars
- city: max 100 chars
- province: max 100 chars
- postalCode: exactly 5 digits

## Status
- Lint: PASS (zero errors)
- Dev server: Running cleanly
