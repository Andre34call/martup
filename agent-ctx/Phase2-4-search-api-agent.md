# Task Phase2-4 — Search API Agent

## Summary
Created `/api/search/route.ts` — a dedicated advanced search endpoint replacing the basic `?search=` on `/api/products`.

## What was done
- **File created**: `src/app/api/search/route.ts`
- Public GET endpoint (no auth required for browsing)
- Query params: `q`, `category`, `minPrice`, `maxPrice`, `condition`, `sortBy`, `page`, `limit`
- Multi-field search: name, description, tags, category name (Prisma OR conditions, case-insensitive)
- Filters: category slug, price range (discount-aware), condition
- Sort options: relevance (name-match-first), price_asc, price_desc, newest, popular, rating
- Facets: categories with counts, priceRange (min/max), conditions with counts
- Pagination: page/limit/total/totalPages
- Rate limit: 30 req/min per IP
- Structured logging with Pino
- `serializeDecimal` for all Decimal fields
- `parseJsonField` for images/tags JSON strings
- Consistent response format with existing `/api/products`

## Verification
- `bun run lint` — 0 errors, 0 warnings
- Dev server running cleanly
