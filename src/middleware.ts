// Next.js middleware entry point
// Re-exports the proxy middleware from proxy.ts
// This file MUST exist as src/middleware.ts for Next.js to discover and run the middleware
export { proxy as middleware, config } from '@/proxy'
