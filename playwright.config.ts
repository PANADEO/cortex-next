import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e/issue-66",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    viewport: { width: 1920, height: 1080 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // MSW disabled: page.route is the single interceptor for the test suite.
      // Keeps the request flow predictable — no SW passthrough racing the
      // Next middleware which would otherwise rewrite to a missing IDP backend.
      NEXT_PUBLIC_API_MOCKING: "disabled",
      NEXT_PUBLIC_DEV_USER_EMAIL: "demo@cortex.local",
    },
  },
})
