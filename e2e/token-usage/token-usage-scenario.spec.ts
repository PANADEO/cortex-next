// E2E kafelka "Raportowanie Tokenów".
//
// Ten kafelek różni się od system-config/ilustromat jedną istotną rzeczą: NIE
// MA własnych danych w naszej bazie. Jego treść pochodzi w całości z cudzego
// serwisu (cortex-proxy, SQLite w tamtym kontenerze), więc "zaseeduj bazę
// i sprawdź, czy dane dopłynęły" jest tu niewykonalne — nie ma czego seedować.
//
// Stąd podział, świadomy i opisany też w e2e/support/mocks/token-usage.ts:
//   - TREŚĆ EKRANU  — mock granicy modułu (`/api/token-usage`), bo to jedyne
//     miejsce, w którym przeglądarka w ogóle rozmawia z tym modułem.
//   - UPRAWNIENIA   — `page.request` na PRAWDZIWY route, z prawdziwym
//     Postgresem i prawdziwym requireTileAccess(). Zero mocków po drodze.
//
// Czego tu NIE MA i być nie może: `page.route("**/usage")`. cortex-proxy jest
// wołany server-side, więc interceptor przeglądarki go nie dosięgnie.

import type { Page } from "@playwright/test"
import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"
import { mockTokenUsage } from "../support/mocks/token-usage"

// Dev server kompiluje route'y na żądanie — pierwszy test w przebiegu płaci za
// kompilację strony i endpointu. Wzorem suity Ilustromatu podnosimy limit
// wyłącznie dla tego pliku, zamiast ruszać globalną konfigurację.
test.describe.configure({ timeout: 90_000 })

const APPS = ["token-usage"]

test.describe("Raportowanie Tokenów — ekran", () => {
  test("administrator widzi metryki, notę o jakości danych i zakładki wymiarów", async ({
    page,
    seed,
    tokenUsagePage,
  }) => {
    const { email } = await seed("token-usage-admin")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: APPS })
    await mockTokenUsage(page)

    await tokenUsagePage.goto()

    await expect(tokenUsagePage.heading).toBeVisible({ timeout: 30_000 })

    // Nota o jakości danych jest WYMOGIEM projektu (1.4), nie ozdobą: bez niej
    // te liczby czyta się jak rozliczenie co do tokena, którym nie są.
    await expect(tokenUsagePage.dataQualityNote).toBeVisible()

    // 4600 + 1000 + 250 + 150 = 6000. Wzorzec toleruje separator tysięcy albo
    // jego brak: pl-PL ma minimumGroupingDigits=2, więc ICU NIE grupuje liczb
    // czterocyfrowych ("6000"), ale pięciocyfrowe już tak ("60 000",
    // twardą spacją). Sztywny literał złamałby się przy innej wersji ICU.
    await expect(page.getByText(/^6\s?000$/)).toBeVisible()

    for (const tab of ["Użytkownicy", "Modele", "Aplikacje", "Zakresy", "Szczegóły"]) {
      await expect(tokenUsagePage.tab(tab)).toBeVisible()
    }
  })

  test("normalizuje oba warianty pustych wymiarów w jedną pozycję", async ({
    page,
    seed,
    tokenUsagePage,
  }) => {
    const { email } = await seed("token-usage-admin")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: APPS })
    await mockTokenUsage(page)

    await tokenUsagePage.goto()
    await expect(tokenUsagePage.heading).toBeVisible({ timeout: 30_000 })

    await tokenUsagePage.tab("Aplikacje").click()

    // Dane wejściowe mają source_app="unknown" ORAZ source_app="" — na ekranie
    // ma być JEDNA pozycja zastępcza, nie dwie, i nie słowo "unknown" udające
    // nazwę aplikacji. Dokładnie tego oryginał nie robił.
    await expect(page.getByText("(nieznana aplikacja)").first()).toBeVisible()
    await expect(page.getByText("unknown", { exact: true })).toHaveCount(0)
  })

  test("tokeny rozumowania są widoczne — poprawka wobec oryginału", async ({
    page,
    seed,
    tokenUsagePage,
  }) => {
    const { email } = await seed("token-usage-admin")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: APPS })
    await mockTokenUsage(page)

    await tokenUsagePage.goto()
    await expect(tokenUsagePage.heading).toBeVisible({ timeout: 30_000 })

    await expect(page.getByText("Tokeny rozumowania")).toBeVisible()
    await expect(page.getByText("800", { exact: true })).toBeVisible()
  })

  test("pusty okres pokazuje stan pusty, nie błąd", async ({ page, seed, tokenUsagePage }) => {
    const { email } = await seed("token-usage-admin")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: APPS })
    await mockTokenUsage(page, { rows: [] })

    await tokenUsagePage.goto()

    await expect(tokenUsagePage.emptyState).toBeVisible({ timeout: 30_000 })
  })

  test("brak konfiguracji sekretu daje czytelny komunikat, nie surowy błąd", async ({
    page,
    seed,
    tokenUsagePage,
  }) => {
    const { email } = await seed("token-usage-admin")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: APPS })
    await mockTokenUsage(page, { errorCode: "cortex-proxy-not-configured", status: 503 })

    await tokenUsagePage.goto()

    await expect(tokenUsagePage.errorTitle).toBeVisible({ timeout: 30_000 })
    // Nazwa zmiennej jest w komunikacie celowo — to jedyna informacja, dzięki
    // której administrator wie, co ma ustawić.
    await expect(page.getByText(/CORTEX_PROXY_ADMIN_API_KEY/)).toBeVisible()
  })
})

test.describe("Raportowanie Tokenów — filtr dat", () => {
  test("odwrócony zakres jest odrzucany w UI, zanim powstanie żądanie", async ({
    page,
    seed,
    tokenUsagePage,
  }) => {
    const { email } = await seed("token-usage-admin")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: APPS })
    await mockTokenUsage(page)

    await tokenUsagePage.goto()
    await expect(tokenUsagePage.heading).toBeVisible({ timeout: 30_000 })

    await tokenUsagePage.startDate.fill("2026-07-30")
    await tokenUsagePage.endDate.fill("2026-07-01")

    await expect(tokenUsagePage.validationError).toBeVisible()
    await expect(tokenUsagePage.showButton).toBeDisabled()
  })

  test("etykieta mówi o strefie cortex-proxy, nie przeglądarki", async ({
    page,
    seed,
    tokenUsagePage,
  }) => {
    const { email } = await seed("token-usage-admin")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: APPS })
    await mockTokenUsage(page)

    await tokenUsagePage.goto()

    await expect(tokenUsagePage.rangeHint).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Europe\/Warsaw/)).toBeVisible()
  })

  test("preset zmienia zakres i przeładowuje raport", async ({ page, seed, tokenUsagePage }) => {
    const { email } = await seed("token-usage-admin")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: APPS })
    await mockTokenUsage(page)

    await tokenUsagePage.goto()
    await expect(tokenUsagePage.heading).toBeVisible({ timeout: 30_000 })

    await tokenUsagePage.presetButton("Ostatnie 7 dni").click()

    // Preset liczy 7 dni obustronnie domkniętych, więc start != end i oba są
    // wypełnione — sprawdzamy, że pola faktycznie się zmieniły.
    await expect(tokenUsagePage.startDate).not.toHaveValue("")
    await expect(tokenUsagePage.endDate).not.toHaveValue("")
    await expect(tokenUsagePage.heading).toBeVisible()
  })
})

// TU JEST SEDNO TEJ SUITY. Za bramką leży lista e-maili wszystkich
// użytkowników instancji wraz z ich aktywnością — te trzy testy idą na
// PRAWDZIWY route, bez mocka modułu, przez prawdziwy requireTileAccess().
test.describe("Raportowanie Tokenów — granica uprawnień na żywej ścieżce", () => {
  const QUERY = "start=2026-07-01&end=2026-07-30"

  async function get(page: Page, email: string, query = QUERY) {
    return page.request.get(`/api/token-usage?${query}`, {
      headers: { "x-auth-request-email": email },
      // Pierwsze żądanie w przebiegu budzi zimną pulę połączeń dev servera do
      // Postgresa — zmierzone do ~30 s. Domyślne 30 s Playwrighta potrafi się
      // z tym zejść i dać mylące "połączenie zerwane" zamiast odpowiedzi.
      timeout: 60_000,
    })
  }

  /**
   * requireTileAccess() jest FAIL-CLOSED także przy awarii bazy: padnięty
   * Postgres daje 403 tak samo jak realny brak uprawnień. Test odmowy, który
   * sprawdza wyłącznie status, przechodziłby więc również przy niedostępnej
   * bazie — czyli nie dowodziłby niczego o RBAC.
   *
   * Zaobserwowane na żywo w tej suicie: pierwsze żądania miały CONNECT_TIMEOUT
   * do Postgresa i mimo to zwracały poprawne 403. Dlatego KAŻDY test odmowy
   * najpierw potwierdza, że ścieżka do bazy faktycznie działa — administrator
   * z tego samego seeda musi przejść bramkę.
   */
  async function expectRbacPathAlive(page: Page, adminEmail: string): Promise<void> {
    // Poll, a nie pojedyncze żądanie: pierwsze sięgnięcie dev servera do
    // Postgresa w przebiegu potrafi paść na CONNECT_TIMEOUT (zmierzone ~30 s,
    // domyślny connect_timeout postgres.js), a dopiero kolejne łapie połączenie.
    // Bez tego kontrola żywotności sama bywała ofiarą zimnego startu — czyli
    // dokładnie tego, przed czym ma chronić.
    await expect
      .poll(
        async () => {
          const control = await get(page, adminEmail)
          return control.status()
        },
        {
          timeout: 120_000,
          message:
            "administrator nie przeszedł bramki — baza/RBAC nie działa, więc test odmowy nic nie dowodzi",
        },
      )
      .not.toBe(403)
  }

  test("użytkownik bez grantu nie dostaje danych modułu", async ({ page, seed }) => {
    const { email: admin } = await seed("token-usage-admin")
    const intruder = "ktos-obcy@e2e.local"
    await asUser(page, intruder)
    // Powłoka celowo PRZEPUSZCZA — chcemy zobaczyć, że odcina MODUŁ, nie shell.
    await mockShellAccess(page, { email: intruder, apps: APPS })

    await expectRbacPathAlive(page, admin)

    const response = await get(page, intruder)

    expect(response.status()).toBe(403)
    // Odmowa nie ma prawa nieść ani grama danych.
    expect(await response.text()).not.toContain("user")
  })

  test("znany użytkownik bez roli też dostaje odmowę (fail-closed)", async ({ page, seed }) => {
    // Ten scenariusz nie ma administratora, więc kontrolę żywotności bazy
    // robimy wprost: user ISTNIEJE w bazie, a mimo to nie ma grantu.
    const { email } = await seed("user-no-roles")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: APPS })

    // Ten scenariusz celowo nie ma administratora, więc kontrolą żywotności jest
    // sam fakt, że 401 (brak tożsamości) i 403 (brak grantu) są rozróżnialne —
    // przy padniętej bazie oba schodziłyby do 403. Test 401 niżej domyka parę.
    const response = await get(page, email)

    expect(response.status()).toBe(403)
  })

  test("brak tożsamości to 401, nie 403 — inny problem, inna odpowiedź", async ({ page, seed }) => {
    await seed("token-usage-admin")

    const response = await get(page, "")

    expect(response.status()).toBe(401)
  })

  // Kontrola pozytywna: bez niej powyższe przechodziłyby też wtedy, gdyby route
  // odmawiał ZAWSZE. Administrator ma dojść dalej niż bramka — do walidacji
  // zakresu (400), która jest już PO niej.
  test("administrator przechodzi bramkę i trafia na walidację zakresu", async ({ page, seed }) => {
    const { email } = await seed("token-usage-admin")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: APPS })

    const response = await get(page, email, "start=2020-01-01&end=2026-07-30")

    expect([401, 403]).not.toContain(response.status())
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toBe("range-too-long")
  })
})
