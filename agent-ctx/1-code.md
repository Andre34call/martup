# Task 1 - Complaint/Refund System Implementation

## Summary
Implemented the buyer-facing Complaint/Refund system with backend API and frontend wiring.

## Files Created
- `src/app/api/complaints/route.ts` — New API route with GET and POST handlers

## Files Modified
- `src/components/ecommerce/screens/refund-screen.tsx` — Replaced stub with real API integration

## API Endpoints

### GET /api/complaints
- Requires `verifyAuth`
- Queries complaints where userId = authenticated user
- Supports `?status=open,processing` comma-separated filter
- Includes order relation (orderNumber, totalAmount, items)
- Returns `{ success: true, data: complaints[] }`

### POST /api/complaints
- Requires `verifyAuth`
- Validates: orderId (required), type (required: 'refund'|'return'|'complain'), reason (required), description (optional), images (optional JSON array)
- Checks order belongs to user and is eligible (delivered/paid/processing/shipped)
- Checks no existing complaint for the order (unique on orderId)
- Creates Complaint with status 'open'
- Returns `{ success: true, data: complaint }` with 201 status

## Frontend Changes
- Replaced hardcoded empty arrays with API-fetched data
- Active tab: `GET /api/complaints?status=open,processing`
- History tab: `GET /api/complaints?status=resolved,rejected`
- Order dropdown: populated from `useAppStore().orders` (filtered for eligible orders)
- Form submit: uploads evidence via `apiClient.upload`, then `apiClient.post('/api/complaints')`
- Status labels: open→"Diajukan", processing→"Diproses", resolved→"Selesai", rejected→"Ditolak"
- Added loading states, empty states, and error handling with ApiClientError

## Verification
- Lint passes ✅
- Dev server compiles ✅
