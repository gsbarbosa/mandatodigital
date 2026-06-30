import { defineConfig, devices } from "@playwright/test";

const hasExternalBaseUrl = Boolean(process.env.APP_BASE_URL);
const localBaseUrl = process.env.PW_DEV_PORT
  ? `http://127.0.0.1:${process.env.PW_DEV_PORT}`
  : "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.APP_BASE_URL || localBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: hasExternalBaseUrl
    ? undefined
    : {
        command: process.env.PW_USE_START
          ? `npm run start -- --port ${process.env.PW_DEV_PORT ?? "3000"}`
          : process.env.PW_DEV_PORT
            ? `npm run dev -- --port ${process.env.PW_DEV_PORT}`
            : "npm run dev",
        url: localBaseUrl,
        reuseExistingServer: !process.env.PW_FORCE_FRESH_SERVER,
        timeout: 120_000,
        env: {
          ...process.env,
          ARGIL_DRY_RUN: process.env.ARGIL_DRY_RUN ?? "true",
          ARGIL_AVATAR_ID: process.env.ARGIL_AVATAR_ID ?? "dry-run-avatar-id",
          SENTINEL_RSS_FIXTURES: process.env.SENTINEL_RSS_FIXTURES ?? "true",
          SENTINEL_V2_PIPELINES: process.env.SENTINEL_V2_PIPELINES ?? "false",
          ...(process.env.E2E_DISABLE_AUTH === "true"
            ? {
                FIREBASE_SERVICE_ACCOUNT_JSON: "",
                FIREBASE_CONFIG: "",
                K_SERVICE: "",
                NEXT_PUBLIC_FIREBASE_API_KEY: "",
                NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "",
                NEXT_PUBLIC_FIREBASE_PROJECT_ID: "",
                NEXT_PUBLIC_FIREBASE_APP_ID: "",
                NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "",
                NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "",
              }
            : {}),
        },
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
