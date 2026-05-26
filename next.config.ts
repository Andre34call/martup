import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
};

export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
});
