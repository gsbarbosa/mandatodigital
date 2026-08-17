import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      // O cofre de provider secrets e a assinatura do state do OAuth exigem
      // ADMIN_SESSION_SECRET e não têm fallback — ver src/lib/admin/credentials.ts.
      // Valor só de teste: não vale em nenhum ambiente real.
      ADMIN_SESSION_SECRET: "test-only-admin-session-secret",
    },
  },
});
