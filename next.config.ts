import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    proxyClientMaxBodySize: "200mb",
  },
};

export default nextConfig;
