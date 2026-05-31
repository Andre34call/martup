# Security Fixes Task

## Summary
Fixed three HIGH severity security issues in the MartUp Next.js application.

## Issues Fixed

### Issue 1: Admin init falls back to NEXTAUTH_SECRET
- **File**: `src/app/api/admin/init/route.ts`
- **Change**: Removed `|| process.env.NEXTAUTH_SECRET` fallback from `adminSecret` assignment (line 48→50)
- **Change**: Updated error message to only mention `ADMIN_SETUP_SECRET` (removed reference to NEXTAUTH_SECRET)
- **Impact**: NEXTAUTH_SECRET can no longer be used to create admin accounts

### Issue 2: OAuth account delete uses trivial confirmation
- **File**: `src/app/api/user/delete/route.ts`
- **Change**: Added `email` to the Prisma `select` clause (line 29: `select: { password: true, email: true }`)
- **Change**: Replaced `password !== 'DELETE'` with `password !== userWithPassword?.email` (line 43)
- **Change**: Updated error message to prompt for email instead of "DELETE"
- **Impact**: OAuth-only users must now type their email address to confirm account deletion instead of the easily guessable "DELETE" string

### Issue 3: /api/auth/me leaks database error details in production
- **File**: `src/app/api/auth/me/route.ts`
- **Change**: Added `process.env.NODE_ENV === 'development'` guard before exposing Prisma error codes (lines 167-170)
- **Change**: In production, all 500 errors now return generic "Terjadi kesalahan server" message
- **Impact**: Database connection strings, infrastructure details, and Prisma error codes are no longer leaked in production responses

## Verification
- ESLint passes with zero errors (`bun run lint`)
