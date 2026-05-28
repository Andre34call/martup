---
Task ID: 1
Agent: main
Task: Fix TypeScript build errors + profile tab crash prevention

Work Log:
- Discovered Next.js build was FAILING due to TypeScript errors (was also failing Vercel deployment)
- Fixed EventTarget.nextElementSibling type errors in chat-screen.tsx and shared.tsx (use e.currentTarget instead of e.target)
- Added 'manager' role support to all three BottomNav components (BottomNav, AdminBottomNav, SellerBottomNav) - handleRoleSwitch type, roleColors, roleLabels
- Fixed null vs undefined in seller-add-product-screen.tsx for videoUrl field
- Added defensive coding to ProfileScreen: safe wallet/voucher/order values with type guards
- Improved ErrorBoundary to show actual error message and stack trace in development mode
- Verified build succeeds (npx next build)
- Verified lint passes (bun run lint)
- Pushed fix to GitHub (commit 283de7f) for Vercel auto-deploy

Stage Summary:
- Build was failing → now passes ✅
- Key root cause: TypeScript errors prevented Vercel from deploying the latest code
- The profile tab crash was likely caused by the old deployed version + possibly hydration/persist issues with undefined values
- Defensive coding added to prevent future runtime crashes in ProfileScreen
- ErrorBoundary now shows error details in dev mode for easier debugging
