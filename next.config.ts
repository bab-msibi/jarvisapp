import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is only ever served to this Mac or through the device-gated tunnel
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
