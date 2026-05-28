import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // SECURITY: Do NOT ignore build errors in production.
    // If there are TS errors in example/skill/mini-service files that
    // shouldn't block the build, exclude those directories in tsconfig.json instead.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
