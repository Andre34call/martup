---
Task ID: 1
Agent: Main
Task: Fix login failure on production - change Prisma provider from SQLite to PostgreSQL

Work Log:
- Investigated login failure: found Prisma schema had `provider = "sqlite"` but production uses PostgreSQL (Supabase)
- This generated a SQLite Prisma client that could not connect to the PostgreSQL database
- Changed prisma/schema.prisma provider from "sqlite" to "postgresql"
- Updated src/lib/db.ts to properly resolve PostgreSQL URL (falls back to SUPABASE_DATABASE_URL when DATABASE_URL is SQLite)
- Fixed isPostgres check in login route (removed, always use mode:insensitive with PostgreSQL)
- Updated .env DATABASE_URL to use Supabase PostgreSQL URL
- Removed better-sqlite3 dependency (no longer needed)
- Pushed multiple commits to trigger Vercel redeployment
- Vercel build appears to be failing - needs manual intervention on Vercel Dashboard

Stage Summary:
- Code changes are correct and build locally successfully
- Vercel deployment is likely failing because DATABASE_URL environment variable on Vercel needs to be verified
- User needs to: (1) Check Vercel Dashboard for build errors, (2) Ensure DATABASE_URL on Vercel is set to Supabase PostgreSQL URL, (3) Run prisma db push via Vercel dashboard if needed, (4) Redeploy
