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

---
Task ID: 2
Agent: Main Agent
Task: Fix Hardcoded Super Admin Email + Add Manager Role + Security Fixes + Refactor

Work Log:
- Fixed hardcoded Super Admin Email duplication in admin/users/route.ts (now uses env.SUPER_ADMIN_EMAIL)
- Fixed hardcoded email in admin-screens.tsx (now uses process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL with fallback)
- Fixed hardcoded email in work-items/route.ts (now uses isSuperAdmin() helper)
- Added Manager role to the entire platform:
  - Updated Prisma schema to include 'manager' in User role comment
  - Updated auth-middleware.ts with new verifyManager(), isSuperAdmin(), isManager(), isElevatedRole() helpers
  - Added role hierarchy constants: ELEVATED_ROLES, DIVISION_ROLES, MANAGER_ASSIGNABLE_ROLES
  - Updated admin/users/route.ts with Manager permission enforcement
  - Updated admin-screens.tsx with Manager UI (badge, promote dialog, role filter, view switcher)
  - Updated types.ts with 'manager' in UserRole, ROLE_DISPLAY with hierarchy levels, ELEVATED_ROLES
  - Updated shared.tsx RoleBadge to include manager with violet styling
  - Updated profile-screen.tsx to show Manager Panel for manager users
  - Updated page.tsx admin screen access to include manager + all elevated roles
  - Updated data-fetch.ts to fetch platform settings for all elevated roles
  - Updated store/auth.ts switchRole to navigate to admin-dashboard for manager
  - Updated role switchers in shared.tsx, seller-screens.tsx, profile-screen.tsx to include manager
- Critical security fix: Added auth check to /api/admin/dashboard route (was completely unprotected!)
- Restricted /api/admin/settings PUT to Super Admin only (was any admin before)
- Updated orders API to include manager in admin checks
- Updated withdrawals API to include manager in admin checks
- Updated admin/stats route to include manager in staff count

Stage Summary:
- Manager role fully implemented with proper hierarchy enforcement
- Super Admin > Manager > Division Admin > Admin > Seller > Buyer
- 3 critical security fixes: unauthenticated dashboard, hardcoded emails, settings access
- All changes pass lint check
