import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/profile/training-assets/**": ["./node_modules/ffmpeg-static/**/*"],
    "/api/heygen/**": ["./node_modules/ffmpeg-static/**/*"],
  },
  experimental: {
    proxyClientMaxBodySize: "200mb",
  },
};

export default nextConfig;
