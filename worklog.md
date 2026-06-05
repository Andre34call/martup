---
Task ID: 1
Agent: main
Task: Fix Google login bug - add Google domains to CSP + fix redirect mode

Work Log:
- Added https://accounts.google.com, https://oauth2.googleapis.com, https://www.googleapis.com to CSP connect-src in proxy.ts
- Added https://accounts.google.com to CSP frame-src in proxy.ts
- Fixed handleGoogleLogin to use redirect: true (default) instead of redirect: false — with redirect: false, NextAuth v4 returns OAuth URL but doesn't navigate, so user never reaches Google consent screen
- Added OAuthAccountNotLinked error message to login screen error handling
- Added google_oauth_not_configured error message

Stage Summary:
- Google OAuth was broken because: (1) CSP blocked Google domains, (2) redirect:false doesn't work for OAuth providers
- Fixed by updating CSP and changing to redirect mode
- User must still set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel env vars for it to work in production

---
Task ID: 2
Agent: main
Task: Audit balance data - verify all data comes from DB/API, no mock data

Work Log:
- Audited entire wallet/balance data flow: DB → API → Store → UI
- Found seed route creates fake Rp 500,000 balance for seller users
- Fixed seed route to create wallets with balance: 0 (real data only)
- Verified admin dashboard uses real DB data via /api/admin/stats
- Verified buyer wallet uses real DB data via /api/user-data
- Verified seller wallet uses real DB data via /api/user-data
- Confirmed: Buyer and Seller have SEPARATE wallets — this is correct by design
- MOCK_SELLER_STATS and MOCK_ADMIN_STATS in mock-data.ts are no longer used by any component

Stage Summary:
- All balance data comes from DB via API — NOT mock/hardcoded
- Seed data was the source of the Rp 500,000 fake balance — fixed to 0
- Buyer/Seller wallets are separate by design
- No mock data is used in any live UI component

---
Task ID: 3
Agent: main
Task: Move Product Type (Barang/Tolong Mas) filter to top of home screen + add to search API

Work Log:
- Added productType query parameter to /api/search route.ts
- Added productType query parameter to /api/products route.ts
- Added productType to search facet results (productTypes facet)
- Added prominent "Semua / 📦 Barang / 🤝 Tolong Mas" toggle at the TOP of home screen (right below top bar)
- Updated product feed to filter by activeProductType
- Dynamic section header based on active type
- Added product type toggle to search screen filter bar (emoji buttons: Semua/📦/🤝)
- Added productTypeFilter state to search screen
- Added productType mapping to search results
- Updated SearchFacets type to include productTypes

Stage Summary:
- Product Type filter is now at the very top of the home page
- Search API and Products API support productType filtering
- Search screen has emoji-based quick filter for product type
- Home screen shows dynamic headers based on selected type
