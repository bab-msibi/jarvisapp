import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is only ever served to this Mac or through the device-gated tunnel
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // The proxy (device gate) buffers request bodies; file uploads go up to Cloudflare's 100MB cap
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
