import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    serverExternalPackages: [],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  ignore: ["examples/**"],
});
