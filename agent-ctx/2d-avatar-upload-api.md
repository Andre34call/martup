# Task 2d - Avatar Upload API Backend

## Task
Create dedicated avatar upload/delete endpoint at `/api/user/avatar/route.ts`

## What was done
- Created POST /api/user/avatar - uploads avatar image to Supabase Storage `avatars` bucket, `profiles` folder, deletes old avatar, updates User.avatar field
- Created DELETE /api/user/avatar - removes avatar from storage and sets User.avatar to null
- Security: image-only validation (no videos), 2MB max, sanitized extensions, only deletes from our Supabase
- Follows existing auth pattern (verifyAuth, authErrorResponse, checkRateLimit)
- Lint passes with zero errors

## File created
- `/home/z/my-project/src/app/api/user/avatar/route.ts`
