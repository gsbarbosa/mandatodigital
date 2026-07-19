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
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
