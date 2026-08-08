// Bramka POWŁOKI na realnej ścieżce: seed w Postgresie -> prawdziwy
// GET /api/me/access -> AppGate -> treść kafelka.
//
// > TEN PLIK CELOWO NIE WOŁA mockShellAccess().
// > Reszta pakietu E2E zaślepia `/api/me/access` przez page.route, więc
// > zostałaby ZIELONA nawet przy kompletnie zepsutym endpoincie — zaślepka
// > przykrywa dokładnie to, co ta zmiana przebudowuje. Bez tego pliku migracja
// > uprawnień powłoki z cortex-admina na własnego Postgresa nie ma ani jednego
// > testu regresji end-to-end.
//
// Mockowany jest wyłącznie `/user/me` (zewnętrzny backend IDP, w testach
// nieobecny) i szum konfiguracyjny powłoki. Uprawnienia idą z bazy.
//
// Wymaga DATABASE_URL wskazującego WŁASNĄ bazę testową — scenariusze czyszczą
// schemat system_config (patrz db-seed.ts).

import type { ApplicationRow } from "@cortex/db"
import type { Page } from "@playwright/test"
import { asUser, expect, test } from "../fixtures/fixtures"
import {
  accessMatrixEmail,
  resetSystemConfig,
  runRegistrySeed,
  seedScenario,
} from "../fixtures/db-seed"
import { mockIdpConfig } from "../support/mocks/idp-config"

// Dev server kompiluje trasy na żądanie, a macierz odwiedza kilkanaście
// różnych tras. Pierwszy przebieg płaci za kompilację każdej z nich.
test.describe.configure({ timeout: 300_000 })

/** Kody, które są UPRAWNIENIEM, a nie kafelkiem: ich `route` wskazuje ekran
 *  należący do INNEGO kafelka (Intrastat), więc sam taki grant nie otwiera
 *  strony. Rozróżnienia nie ma dziś w schemacie — gdy pojawi się nowy kod
 *  tego rodzaju, macierz niżej zapali się na nim i wymusi decyzję. */
const GRANT_ONLY_CODES = new Set(["intrastat-cn-editor", "intrastat-config-editor"])

const DENIED_HEADING = "Brak dostępu"
const ERROR_HEADING = "Brak uprawnień"

/** Nazwa projektu task-chat podstawianego zamiast governance store. */
const COWORK_TILE_LABEL = "Projekt E2E Cowork"

/**
 * Rozstrzygnięcie bramki dla bieżącej strony.
 *
 * "blank" jest osobnym wynikiem, a nie cichym "wpuszczono": AppGate renderuje
 * `null`, dopóki czeka na sygnały, więc pusta strona jest nieodróżnialna od
 * przepuszczenia, jeśli patrzeć wyłącznie na BRAK nagłówka odmowy. Właśnie ta
 * różnica ujawniła zawieszanie się na /user/me — asercje muszą ją widzieć.
 */
type GateOutcome = "allowed" | "denied" | "blank"

async function settle(page: Page): Promise<boolean> {
  return page
    .waitForFunction(
      () =>
        (document.body.innerText ?? "").trim().length > 0 ||
        document.querySelector("main, header, aside") !== null,
      null,
      { timeout: 60_000 },
    )
    .then(() => true)
    .catch(() => false)
}

async function gateOutcome(page: Page): Promise<GateOutcome> {
  if (!(await settle(page))) return "blank"
  const denied = await page.getByRole("heading", { name: DENIED_HEADING }).isVisible()
  const errored = await page.getByRole("heading", { name: ERROR_HEADING }).isVisible()
  return denied || errored ? "denied" : "allowed"
}

test.describe("Bramka powłoki — macierz per kod aplikacji", () => {
  let registry: ApplicationRow[] = []

  // Seed RAZ na cały plik: wszystkie testy poniżej wyłącznie CZYTAJĄ (nawigują),
  // żaden nie mutuje bazy, a scenariusz uruchamia dwa procesy `node` z
  // prawdziwymi skryptami seedującymi — powtarzanie tego per test kupowałoby
  // izolację, której nie ma czego chronić.
  test.beforeAll(async () => {
    const seeded = await seedScenario("registry-one-user-per-code")
    registry = seeded.applications
  })

  test("rejestr został zseedowany prawdziwym skryptem deployowym", async () => {
    // Sanity check samego testu: gdyby seed przestał cokolwiek wstawiać,
    // macierz niżej przebiegłaby pustą pętlą i została zielona.
    expect(registry.length).toBeGreaterThanOrEqual(20)
    const codes = registry.map((application) => application.code)
    // Kody, które stara allowlista w kodzie gubiła — po migracji do rejestru w
    // bazie problem znika strukturalnie, nie przez czujność. `meeting-guru`
    // wypadł z tej listy razem z APPLICATIONS w K3 (D3): to `external-link`,
    // czyli dane instancji zakładane z UI admina, więc żaden seed go już nie
    // tworzy i nie ma go czym tu sprawdzać.
    expect(codes).toEqual(expect.arrayContaining(["sp-console", "sp-client", "okna-czasowe"]))
    expect(codes).toContain("ilustromat")
  })

  test("każdy kod otwiera WYŁĄCZNIE swoją trasę", async ({ page }) => {
    let currentEmail = ""
    // Jeden handler na cały przebieg zamiast rejestrowania kolejnego per kod.
    await page.route("**/user/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email: currentEmail, has_access: true }),
      })
    })
    await mockIdpConfig(page)

    for (const application of registry) {
      currentEmail = accessMatrixEmail(application.code)
      await asUser(page, currentEmail)

      await test.step(`kod ${application.code}`, async () => {
        if (application.route) {
          await page.goto(application.route)
          const outcome = await gateOutcome(page)

          if (GRANT_ONLY_CODES.has(application.code)) {
            expect
              .soft(outcome, `${application.code}: to uprawnienie, nie kafelek — ma odmawiać`)
              .toBe("denied")
          } else {
            expect
              .soft(outcome, `${application.code}: własna trasa ${application.route}`)
              .toBe("allowed")
          }
        }

        // Trasa cudzego kafelka. Ta asercja jest jednocześnie dowodem, że
        // ekran odmowy w ogóle się renderuje — więc "nie odmówiono" wyżej nie
        // może przejść dlatego, że strona się nie załadowała.
        const foreign = application.code === "system-config" ? "/idp/dashboard" : "/system-config"
        await page.goto(foreign)
        expect
          .soft(await gateOutcome(page), `${application.code}: cudza trasa ${foreign}`)
          .toBe("denied")
      })
    }
  })

  test("hub pokazuje dokładnie kafelki tego użytkownika", async ({ page }) => {
    await mockIdpConfig(page)
    const email = accessMatrixEmail("intrastat")
    await asUser(page, email)
    await page.route("**/user/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email, has_access: true }),
      })
    })

    await page.goto("/")
    await settle(page)

    await expect(page.getByText("Intrastat", { exact: true })).toBeVisible()
    await expect(page.getByText("IDP", { exact: true })).toBeHidden()
    await expect(page.getByText("Ilustromat", { exact: true })).toBeHidden()
  })

  // Kafelki task-chat NIE mają wiersza w rejestrze aplikacji — hub dociąga je z
  // governance store, który zna wyłącznie role PER PROJEKT i o grant
  // `cortex-cowork` nie pyta w ogóle. Zaślepiony jest tu WYŁĄCZNIE ten store
  // (żeby test nie zależał od zawartości JSON-a na dysku i od ról projektu —
  // to osobna warstwa). Uprawnienia nadal idą z bazy przez prawdziwy
  // /api/me/access, więc bramkę sekcji test sprawdza realną ścieżką.
  test("kafelki task-chat na hubie widzi wyłącznie user z grantem cortex-cowork", async ({
    page,
  }) => {
    await mockIdpConfig(page)
    let currentEmail = ""
    await page.route("**/user/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email: currentEmail, has_access: true }),
      })
    })
    await page.route("**/api/cortex-cowork/projects", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "projekt-e2e",
            name: COWORK_TILE_LABEL,
            description: "Kafelek task-chat z governance store",
            exportEnabled: false,
            briefs: [],
          },
        ]),
      })
    })

    currentEmail = accessMatrixEmail("intrastat")
    await asUser(page, currentEmail)
    await page.goto("/")
    await settle(page)

    // Własny kafelek widoczny — dowód, że hub się wyrenderował, więc ukryty
    // kafelek Coworka nie jest artefaktem pustej strony.
    await expect(page.getByText("Intrastat", { exact: true })).toBeVisible()
    await expect(page.getByText(COWORK_TILE_LABEL, { exact: true })).toBeHidden()

    currentEmail = accessMatrixEmail("cortex-cowork")
    await asUser(page, currentEmail)
    await page.goto("/")
    await settle(page)

    await expect(page.getByText(COWORK_TILE_LABEL, { exact: true })).toBeVisible()
  })

  test("grant zbiorczy ai-tools odsłania wszystkie dziewięć narzędzi", async ({ page }) => {
    await mockIdpConfig(page)
    const email = accessMatrixEmail("ai-tools")
    await asUser(page, email)
    await page.route("**/user/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email, has_access: true }),
      })
    })

    await page.goto("/")
    await settle(page)

    for (const label of [
      "Podświetlacz tekstu",
      "Transformator tekstu",
      "Analizator tekstu",
      "Sumaryzator",
      "Kreator treści",
      "Generator LinkedIn",
      "Generator prezentacji",
      "Analizator faktur",
      "Chatbot AI",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }
  })

  test("grant na jedno narzędzie nie przecieka na pozostałe", async ({ page }) => {
    await mockIdpConfig(page)
    const email = accessMatrixEmail("linkedin-generator")
    await asUser(page, email)
    await page.route("**/user/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email, has_access: true }),
      })
    })

    await page.goto("/")
    await settle(page)

    await expect(page.getByText("Generator LinkedIn", { exact: true })).toBeVisible()
    await expect(page.getByText("Chatbot AI", { exact: true })).toBeHidden()
    await expect(page.getByText("Sumaryzator", { exact: true })).toBeHidden()
  })

  test("konto bez żadnego grantu dostaje ekran odmowy na hubie", async ({ page }) => {
    await mockIdpConfig(page)
    const email = "bez-grantow@matrix.e2e.local"
    await asUser(page, email)
    await page.route("**/user/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email, has_access: true }),
      })
    })

    await page.goto("/")

    expect(await gateOutcome(page)).toBe("denied")
  })
})

test.describe("Bramka powłoki bez backendu IDP (D7)", () => {
  // Środowisko cortex-next stawiane jest BEZ osobnego cortex-admina i bez
  // backendu IDP (docs/infrastructure.md). Wcześniej błąd /user/me odcinał
  // KAŻDĄ stronę, więc taka instancja była martwa niezależnie od zawartości
  // Postgresa. Tutaj /user/me nie jest w ogóle zaślepiony — middleware
  // przepisuje je na nieistniejący IDP_BACKEND_URL, dokładnie jak na
  // środowisku bez tego backendu.
  test("użytkownik z grantem wchodzi na swój kafelek mimo martwego /user/me", async ({
    page,
    seed,
  }) => {
    const { email } = await seed("ilustromat-user")
    await asUser(page, email)
    await mockIdpConfig(page)

    await page.goto("/ilustromat/generation")

    expect(await gateOutcome(page)).toBe("allowed")
  })

  test("hub też działa mimo martwego /user/me", async ({ page, seed }) => {
    const { email } = await seed("ilustromat-user")
    await asUser(page, email)
    await mockIdpConfig(page)

    await page.goto("/")
    await settle(page)

    await expect(page.getByText("Ilustromat", { exact: true })).toBeVisible()
  })

  // Tożsamość w menu użytkownika — drugi objaw tej samej przyczyny co bramka.
  // Powłoka brała "kim jestem" z /user/me, więc bez backendu IDP menu pokazywało
  // "—" mimo poprawnie uwierzytelnionego żądania. Asercja idzie REALNĄ ścieżką:
  // e-mail z nagłówka (asUser), nazwa z zaseedowanego system_config.users,
  // prawdziwe /api/me/identity, a /user/me — jak w całym tym bloku — celowo
  // NIEZAŚLEPIONE. Zaślepka na /user/me utrzymałaby ten test zielonym również
  // wtedy, gdyby powłoka wróciła do pytania backendu IDP o tożsamość.
  test("menu użytkownika pokazuje tożsamość, a nie '—', mimo martwego /user/me", async ({
    page,
    seed,
  }) => {
    const { email } = await seed("ilustromat-user")
    await asUser(page, email)
    await mockIdpConfig(page)

    await page.goto("/")
    await settle(page)

    await page.getByRole("button", { name: "User menu" }).click()

    const menu = page.getByRole("menu")
    await expect(menu.getByText("Ilustromat E2E", { exact: true })).toBeVisible()
    await expect(menu.getByText(email, { exact: true })).toBeVisible()
    await expect(menu.getByText("—", { exact: true })).toHaveCount(0)
  })
})

test.describe("Zimny start — pusta baza i odzyskiwanie przez seed (D4/R2)", () => {
  test("pusta baza odcina wszystkich, seed z ADMIN_EMAIL przywraca dostęp", async ({ page }) => {
    const adminEmail = "admin-zimny-start@matrix.e2e.local"
    await resetSystemConfig()
    await asUser(page, adminEmail)
    await mockIdpConfig(page)
    await page.route("**/user/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email: adminEmail, has_access: true }),
      })
    })

    // 1. Kontener wstający na pustym Postgresie: zero grantów dla wszystkich,
    //    łącznie z panelem, którym dałoby się to naprawić. To jest dokładnie
    //    stan, przed którym broni usługa `migrate` w docker-compose.
    await page.goto("/")
    expect(await gateOutcome(page)).toBe("denied")

    // 2. Ścieżka naprawy: ten sam seed, który odpala deploy. BEZ
    //    BOOTSTRAP_MODULES — czyli dokładnie tak, jak wstaje instancja, której
    //    nikt nie skonfigurował. Po K3 nie ma już listy APPLICATIONS, która
    //    aktywowałaby cokolwiek "przy okazji": jedyne, co włącza rdzeń, to
    //    bezwarunkowa aktywacja w seed-system-config.mjs.
    runRegistrySeed({ adminEmail })

    // 3. Ten sam użytkownik odzyskuje dostęp — ale NIE natychmiast: uprawnienia
    //    są cache'owane per proces aplikacji na 30 s, a zapis do bazy tego
    //    cache'u nie czyści (udokumentowane ograniczenie, nagłówek
    //    seed-system-config.mjs). Pierwsze żądanie po seedzie nadal dostaje
    //    odmowę i NIE znaczy to, że naprawa nie zadziałała. Poniższy poll
    //    utrwala to zachowanie zamiast je ukrywać.
    await expect
      .poll(
        async () => {
          await page.goto("/")
          return gateOutcome(page)
        },
        { timeout: 60_000, intervals: [5_000] },
      )
      .toBe("allowed")

    await expect(page.getByText("Konfiguracja Systemu", { exact: true })).toBeVisible()

    // Druga połowa wariantu A, do K3 nieprawdziwa i dlatego nigdy tu nie
    // zapisana: kafelek, którego nikt nie aktywował, ma NIE BYĆ na hubie. Bez
    // tej asercji powrót do hurtowej aktywacji (choćby przez wskrzeszenie
    // listy kodów w seedzie) przeszedłby tu niezauważony — administrator
    // miałby dostęp, czyli headline tego testu byłby zielony.
    //
    // Asercja jest na DWÓCH konkretnych kodach, a nie na "pusty hub poza
    // rdzeniem": ten seed zostawia aktywne także `ilustromat` i `token-usage`,
    // które włączają się same w swoich seedach (zaszłość, follow-up K3 opisany
    // w nagłówku seed-system-config.mjs). Asercja "tylko rdzeń" byłaby więc
    // po prostu nieprawdziwa i musiałaby nieść listę wyjątków.
    await expect(page.getByText("IDP", { exact: true })).toBeHidden()
    await expect(page.getByText("Intrastat", { exact: true })).toBeHidden()
  })

  // Druga strona tej samej decyzji: wariant A bez zmiennej bootstrapowej
  // znaczyłby 26 kliknięć na każde nowe środowisko. Ten test jest jedynym
  // miejscem, które dowodzi, że zmienna realnie DOCHODZI ze środowiska do
  // seeda i kończy się kafelkiem na hubie — reszta (przecięcie z licencją,
  // guard activated_at) jest sprawdzana bez bazy w
  // packages/@cortex/db/scripts/module-licensing.parity.test.mjs.
  test("BOOTSTRAP_MODULES włącza wskazane moduły przy pierwszym uruchomieniu", async ({ page }) => {
    const adminEmail = "admin-bootstrap@matrix.e2e.local"
    await resetSystemConfig()
    await asUser(page, adminEmail)
    await mockIdpConfig(page)
    await page.route("**/user/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email: adminEmail, has_access: true }),
      })
    })

    runRegistrySeed({ adminEmail, bootstrapModules: ["intrastat"] })

    await expect
      .poll(
        async () => {
          await page.goto("/")
          return gateOutcome(page)
        },
        { timeout: 60_000, intervals: [5_000] },
      )
      .toBe("allowed")

    await expect(page.getByText("Intrastat", { exact: true })).toBeVisible()
    // Kod NIEWYMIENIONY na liście zostaje kandydatem — inaczej ten test
    // przechodziłby także dla seeda aktywującego wszystko jak leci.
    await expect(page.getByText("IDP", { exact: true })).toBeHidden()
  })
})
