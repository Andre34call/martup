import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // SECURITY: Do NOT ignore build errors in production.
    // If there are TS errors in example/skill/mini-service files that
    // shouldn't block the build, exclude those directories in tsconfig.json instead.
    ignoreBuildErrors: false,
  },
  images: {
    // Payment channel logos come from the gateway's CDN. They are rendered via
    // next/image, which proxies them through same-origin /_next/image — so the
    // app CSP (img-src 'self' ...) does NOT need to whitelist the CDN domain.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.duitku.com' },
      { protocol: 'https', hostname: 'sandbox.duitku.com' },
      { protocol: 'https', hostname: 'app-sandbox.duitku.com' },
      { protocol: 'https', hostname: 'app-prod.duitku.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
