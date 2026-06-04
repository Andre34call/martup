# Task 3: Division Work Item Backend API

## Summary
Created the backend API for the Division Work Item system with full CRUD support and auto-routing logic.

## Files Created

### 1. `/home/z/my-project/src/lib/workflow.ts`
- **WORK_TYPE_TO_DIVISION**: Maps work types (complaint, withdrawal, deposit, refund, product_report, product_review, order_issue, seller_verification, legal_issue, custom) to division slugs (cs, finance, tech, marketing, operations, hr, legal)
- **WORK_TYPE_DISPLAY**: Indonesian labels, icons, and colors for each work type
- **WORK_PRIORITY_DISPLAY**: Labels and colors for priority levels (low, normal, high, urgent)
- **WORK_STATUS_DISPLAY**: Labels and colors for statuses (open, in_progress, resolved, closed, escalated)
- **VALID_STATUS_TRANSITIONS**: Enforces valid status flow (open→in_progress→resolved/closed/escalated, etc.)
- **createWorkItemFromEntity()**: Auto-creates a WorkItem from entity events, auto-routes to the correct division based on type

### 2. `/home/z/my-project/src/app/api/admin/work-items/route.ts`
- **GET**: List work items with filters (divisionId, status, type, priority, assigneeId), pagination (page, limit), includes division name/icon and assignee name/avatar, returns status counts (open, in_progress, resolved, closed, escalated)
- **POST**: Create work item with auto-routing (if divisionId not specified, looks up division by slug using WORK_TYPE_TO_DIVISION), sets createdBy to auth user, creates notification for assignee if assigned
- **PATCH**: Update work item with status transition validation, sets resolvedAt on resolved/closed, creates notification for newly assigned user, supports priority/resolution/dueDate updates
- **DELETE**: Delete work item with admin/super-admin check, supports both JSON body and query params

## Key Implementation Details
- Uses `verifyAdmin`/`verifySuperAdmin` from `@/lib/auth-middleware` for auth
- Uses `serializeDecimal` from `@/lib/decimal-utils` for Decimal fields
- Uses `logger` from `@/lib/logger` for structured logging
- Parses `metadata` as JSON string when storing, parses when reading
- Proper TypeScript types for request bodies
- Re-exports `createWorkItemFromEntity` from route for convenience

## Lint Status
✅ No errors - ESLint passes cleanly
