Task ID: 4
Agent: service-proof-api
Task: Create service proof API and auto-confirm cron

Work Log:
- Read worklog.md, order-status.ts, auth-middleware.ts, rate-limit.ts for patterns
- Read prisma/schema.prisma to verify Order model fields (isServiceOrder, serviceProofImages, sellerCompletedAt, buyerConfirmedAt, autoConfirmAt)
- Read existing route patterns: orders/[id]/status/route.ts, orders/[id]/cancel/route.ts, cron/auto-complete/route.ts
- Created /src/app/api/orders/[id]/service-proof/route.ts with POST and GET handlers
- Created /src/app/api/cron/auto-confirm-service/route.ts with GET and POST handlers
- Lint passes ✅
- Dev server compiles ✅

Stage Summary:
- POST /api/orders/[id]/service-proof: Seller submits proof of service completion
  - Auth: verifyAuth + seller ownership check
  - Validates: isServiceOrder, status=processing, no duplicate proof
  - Validates: proofImages 1-5 URLs (http/https only, rejects blob:/data:/javascript:)
  - Validates: note optional, max 500 chars
  - Updates: serviceProofImages, sellerCompletedAt, autoConfirmAt (3 days), status→shipped
  - Creates notifications for both buyer and seller
  - Rate limited: 5 req/min per user
- GET /api/orders/[id]/service-proof: Both buyer and seller can view proof
  - Returns parsed proofImages, sellerCompletedAt, autoConfirmAt, buyerConfirmedAt
- /api/cron/auto-confirm-service: Auto-confirms service orders after 3 days
  - Finds: status=shipped + isServiceOrder + autoConfirmAt < now + buyerConfirmedAt IS NULL
  - Sets: status=delivered, buyerConfirmedAt=now, deliveredAt=now
  - Releases escrow (same logic as order-status.ts delivered status)
  - Creates notifications for both buyer and seller
  - Protected by CRON_SECRET with timing-safe comparison
  - Rate limited: 1 call per minute
