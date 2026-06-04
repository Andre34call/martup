# Task: security-fixes — Agent: security

## Summary
Fixed 7 MEDIUM security bugs in the MartUp e-commerce app.

## Changes

| Issue | File | Fix |
|-------|------|-----|
| RM1 | `src/app/api/reviews/route.ts` | Added image URL domain validation (SSRF prevention) |
| RM2 | `src/app/api/upload/route.ts` | Sanitized Supabase error details from API responses |
| RM3 | `src/app/api/auth/login/route.ts` | Removed error code exposure in catch block |
| RM4 | `src/app/api/admin/users/route.ts` | Excluded seller bank details from GET list response |
| RM5 | `src/app/api/chat/rooms/route.ts` | Optimized duplicate room detection with findFirst |
| RL1 | `src/app/api/auth/forgot-password/route.ts` + `reset-password/route.ts` | Hash reset tokens with SHA-256 before storing |
| RL2 | `src/app/api/user-data/route.ts` + 3 wallet routes | Export cache invalidation, call from mutation routes |

## Lint: ✅ Passes
