import { createRequire } from "node:module";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);
const packageJson = require("./package.json") as { version: string };

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Playwright e alguns clients usam 127.0.0.1; Next 16 bloqueia HMR/dev assets
  // como cross-origin se o server subiu como localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  serverExternalPackages: ["ffmpeg-static", "pdfkit"],
  outputFileTracingIncludes: {
    "/api/profile/training-assets/**": ["./node_modules/ffmpeg-static/**/*"],
    "/api/heygen/**": ["./node_modules/ffmpeg-static/**/*"],
    "/api/media/seal": [
      "./node_modules/ffmpeg-static/**/*",
      "./assets/fonts/DejaVuSans.ttf",
      "./assets/seals/tse-seal.png",
      "./assets/seals/guest-test-seal.png",
    ],
    "/api/workers/seal": [
      "./node_modules/ffmpeg-static/**/*",
      "./assets/fonts/DejaVuSans.ttf",
      "./assets/seals/tse-seal.png",
      "./assets/seals/guest-test-seal.png",
    ],
    "/api/jobs/**": ["./node_modules/ffmpeg-static/**/*"],
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
  async rewrites() {
    return [
      // Landings estáticas em public/ (HTML pronto, fora do MarketingShell).
      { source: "/vozdelas", destination: "/vozdelas/index.html" },
      { source: "/vozdelas/", destination: "/vozdelas/index.html" },
      { source: "/materialidade", destination: "/materialidade/index.html" },
      { source: "/materialidade/", destination: "/materialidade/index.html" },
      { source: "/chapas-femininas", destination: "/chapas-femininas/index.html" },
      { source: "/chapas-femininas/", destination: "/chapas-femininas/index.html" },
    ];
  },
};

export default nextConfig;
