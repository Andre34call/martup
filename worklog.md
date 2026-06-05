---
Task ID: 1
Agent: Main
Task: Fix Gmail login bug + Audit mock data + Move Tipe Produk to top + Verify checkout features

Work Log:
- Investigated the full Google OAuth flow: login-screen → signIn('google') → NextAuth callback → sync-user → DataFetcher → /api/auth/me
- Found INTERNAL_API_SECRET returns '' in production when not set, causing sync-user to always fail → Fixed to always fall back to NEXTAUTH_SECRET
- Found /api/auth/me doesn't set martup_session/martup_auth cookies for NextAuth users → Fixed to set cookies for NextAuth users so DataFetcher Path 1 works on refresh
- Found existing NextAuth session users in DB but verifyAuth failing → Added fallback that checks NextAuth session directly and returns user data
- Improved DataFetcher with better error handling (ApiClientError status-based handling) and separate refs for Path 1 vs Path 2 recovery
- Added Google OAuth diagnostic endpoint at /api/auth/google-diagnostic for debugging configuration issues
- Moved Tipe Produk toggle to sticky position below header (top-14 z-30) with backdrop blur
- Verified checkout already has quantity +/- buttons and clickable products
- Deleted dangerous supabase-seed.sql (plaintext passwords)
- Deleted dead src/lib/mock-data.ts (zero imports)
- Added NODE_ENV=production guard to prisma/seed.ts
- Changed SMS_PROVIDER and EMAIL_PROVIDER defaults from 'mock' to '' in production
- Added disclaimer to product detail shipping modal ("Harga estimasi — ongkir akurat dihitung saat checkout")

Stage Summary:
- INTERNAL_API_SECRET now always derives from NEXTAUTH_SECRET (fixes sync-user in production)
- /api/auth/me sets martup cookies for NextAuth users (consistent session detection on refresh)
- DataFetcher has better error handling and cleaner recovery logic
- Google OAuth diagnostic endpoint available for debugging
- Tipe Produk is now sticky below the header bar
- Mock data cleanup: deleted 2 dangerous files, added production guards
- All wallet/balance data confirmed to come from DB/API (not hardcoded)
