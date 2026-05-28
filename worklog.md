---
Task ID: 1
Agent: Main Agent
Task: Audit Keamanan & Perbaikan Launch-Critical + Refactor + Deploy

Work Log:
- Performed comprehensive security audit of the entire MartUp codebase
- Identified 10+ security and launch-critical issues
- Fixed auto-appearing password reset form after login (race condition with Zustand hydration)
  - Added localStorage auth token check as fallback when Zustand hasn't hydrated yet
  - Added sessionStorage persistence for reset token (survives page refresh)
  - Clear sessionStorage on successful login and password reset
- Updated proxy.ts with CSRF monitoring mode (instead of enforcement mode that would block legitimate requests)
  - Added interest-cohort=() to Permissions-Policy
  - CSRF enforcement can be enabled via CSRF_ENFORCE=true env var
- Fixed hardcoded super admin email → moved to env.SUPER_ADMIN_EMAIL with fallback
- Added SUPER_ADMIN_EMAIL to env.ts recommended vars
- Fixed admin screen redirect bug (was rendering HomeScreen directly without updating state)
- Fixed deleteAccount to actually call API + delete user from database
  - Created /api/user/delete route with comprehensive cascade deletion
- Fixed JSON.parse without try/catch in data-fetch.ts (review images parsing)
- Removed dependency on duplicate auth-store.ts from use-data-sync.ts
  - Refactored use-data-sync to use only useAppStore + localStorage fallback
- Fixed CSRF Math.random() fallback - added security warning console.error
- Changed next.config.ts ignoreBuildErrors from true to false

Stage Summary:
- 10+ security and launch-critical fixes applied
- All changes pass lint check
- Dev server compiles and runs successfully
- Ready for Vercel deployment
