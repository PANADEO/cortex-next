import { defineConfig, devices } from "@playwright/test"

// Port konfigurowalny, domyślnie 3000 — zachowanie bez E2E_PORT jest
// niezmienione. Powód: `reuseExistingServer` podłącza suite do DOWOLNEGO
// procesu słuchającego na 3000, także dev servera z innego checkoutu/worktree.
// Taki serwer serwuje CUDZY kod i CUDZE env (m.in. bez
// NEXT_PUBLIC_API_MOCKING=disabled, czyli z aktywnym MSW, które przechwytuje
// żądania przed `page.route`). Objawia się to testami, które "nie widzą"
// swoich mocków — zweryfikowane na żywo. Przy pracy w worktree ustaw E2E_PORT
// na wolny port; wymusza to też start własnego serwera zamiast reuse.
const PORT = process.env.E2E_PORT ?? "3000"
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  // Cała e2e/ — nie tylko e2e/issue-66/ (legacy, PO-per-issue). Nowa
  // struktura (e2e/poms, e2e/support) żyje obok niej, patrz
  // .claude/skills/code-e2e/SKILL.md.
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    viewport: { width: 1920, height: 1080 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI && !process.env.E2E_PORT,
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
