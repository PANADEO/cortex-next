import { defineConfig, devices } from "@playwright/test"
import { E2E_COWORK_DATA_DIR, E2E_OKNA_CZASOWE_DATA_DIR } from "./e2e/fixtures/json-store"

// testDir "./e2e" obejmuje OBIE struktury naraz: legacy `e2e/issue-66/**`
// (PO-ISSUE, mockuje wszystko przez page.route) i nową (`e2e/<kafelek>/*.spec.ts`
// + POM-y + seed na prawdziwym Postgresie). Patrz .claude/skills/code-e2e.
//
// Adres serwera przestawialny z env, bo nowa struktura CZYŚCI prawdziwą bazę
// (resetSystemConfig()): przebieg weryfikacyjny idzie na własnym porcie
// i własnej bazie, nigdy na współdzielonym 3000 i bazie `cortex`.
//
// Dwa niezależne sposoby wskazania innego serwera niż domyślny 3000:
// - PLAYWRIGHT_BASE_URL — serwer już działa gdzie indziej (dowolny adres),
//   Playwright nie próbuje go podnosić.
// - E2E_PORT — Playwright ma sam podnieść WŁASNY `npm run dev` na tym porcie
//   (wymusza to też pominięcie reuseExistingServer, patrz webServer niżej).
const PORT = process.env.E2E_PORT ?? "3000"
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`
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
          command: `npm run dev -- -p ${PORT}`,
          url: baseURL,
          // reuseExistingServer podłącza suite do DOWOLNEGO procesu słuchającego
          // na tym porcie, także dev servera z innego checkoutu/worktree — taki
          // serwer serwuje CUDZY kod i CUDZE env (m.in. bez
          // NEXT_PUBLIC_API_MOCKING=disabled, czyli z aktywnym MSW, które
          // przechwytuje żądania przed page.route). Ustawienie E2E_PORT wymusza
          // więc też start własnego serwera zamiast reuse.
          reuseExistingServer: !process.env.CI && !process.env.E2E_PORT,
          timeout: 180_000,
          env: {
            // MSW disabled: page.route is the single interceptor for the test suite.
            // Keeps the request flow predictable — no SW passthrough racing the
            // Next middleware which would otherwise rewrite to a missing IDP backend.
            NEXT_PUBLIC_API_MOCKING: "disabled",
            NEXT_PUBLIC_DEV_USER_EMAIL: "demo@cortex.local",
            // Store'y plikowe (Cortex Cowork, Okna czasowe) czytają swój katalog
            // danych RAZ, przy ładowaniu modułu — więc musi go dostać proces
            // dev servera, nie proces `playwright test`. Osobne katalogi e2e:
            // seed je czyści przed każdym scenariuszem, a lokalny `.data/`
            // dewelopera zostaje nietknięty. Patrz e2e/fixtures/json-store.ts.
            COWORK_DATA_DIR: E2E_COWORK_DATA_DIR,
            OKNA_CZASOWE_DATA_DIR: E2E_OKNA_CZASOWE_DATA_DIR,
            // Bez tego `getRequestEmail()`/`requestEmail()` mają poza produkcją
            // fallback na DEV_USER_EMAIL — "brak nagłówka" przestałoby wtedy
            // znaczyć "brak tożsamości" i testy bramek nic by nie dowodziły.
            DEV_USER_EMAIL: "",
          },
        },
      }),
})
