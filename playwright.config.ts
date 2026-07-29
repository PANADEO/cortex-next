import { defineConfig, devices } from "@playwright/test"

// testDir "./e2e" obejmuje OBIE struktury naraz: legacy `e2e/issue-66/**`
// (PO-ISSUE, mockuje wszystko przez page.route) i nową (`e2e/<kafelek>/*.spec.ts`
// + POM-y + seed na prawdziwym Postgresie). Patrz .claude/skills/code-e2e.
//
// Adres serwera przestawialny z env, bo nowa struktura CZYŚCI prawdziwą bazę
// (resetSystemConfig()): przebieg weryfikacyjny idzie na własnym porcie
// i własnej bazie, nigdy na współdzielonym 3000 i bazie `cortex`.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

// Wskazanie własnego, już działającego serwera wyłącza podnoszenie webServera —
// inaczej Playwright próbowałby wystartować drugi `npm run dev`.
const useExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL)

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // workers: 1 jest WYMAGANE przez seedScenario() — scenariusze resetują
  // wspólny schemat, więc przy >1 workerze nadpisywałyby sobie dane nawzajem.
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    viewport: { width: 1920, height: 1080 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(useExternalServer
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: baseURL,
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
      }),
})
