# Task: stream-fixes
# Agent: code
# Status: COMPLETED

## Summary
Fixed 8 critical bugs in the Stream feature of the MartUp e-commerce app.

## Files Modified
1. `src/components/ecommerce/stream/stream-feed-screen.tsx` — Fixed pagination shape (Bug 1), user data shape (Bug 2)
2. `src/components/ecommerce/stream/stream-comment-sheet.tsx` — Fixed user data shape (Bug 2), pagination shape
3. `src/app/api/stream/[id]/comments/route.ts` — Fixed parentId handling (Bug 4), added isLiked/likeCount
4. `src/app/api/stream/route.ts` — Fixed isHidden filter (Bug 5)
5. `src/app/api/stream/[id]/route.ts` — Fixed isHidden filter (Bug 5), added product relation (Bug 18), fixed view count inflation (Bug 23)
6. `src/app/api/stream/[id]/like/route.ts` — Fixed race condition (Bug 22)
7. `prisma/schema.prisma` — Added StreamCommentLike model (Bug 3)

## Files Created
8. `src/app/api/stream/[id]/comments/[commentId]/like/route.ts` — New comment like toggle route (Bug 3)

## All Bugs Fixed
- Bug 1: Pagination response shape mismatch → reads from data.pagination
- Bug 2: User data shape mismatch → uses nested user object
- Bug 3: Comment like API missing → created with StreamCommentLike model
- Bug 4: parentId ignored → now reads and filters by parentId
- Bug 5: isHidden not filtered → added to both feed and single-post where clauses
- Bug 18: Product relation missing → added to single-post GET with formatting
- Bug 22: likeCount race condition → interactive transaction with authoritative count
- Bug 23: View count inflation → rate-limited per IP per window

## Verification
- `bun run lint` passes ✅
- Dev server compiles successfully ✅
