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
  async redirects() {
    return [
      {
        source: "/avatares/gemeo-digital",
        destination: "/avatares/foto-real",
        permanent: true,
      },
      {
        source: "/avatares/gemeo-digital/treinar",
        destination: "/avatares/foto-real/treinar",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
