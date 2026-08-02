// E2E kafelka Ilustromat: realny Postgres + realne API modułu, mockowana
// wyłącznie POWŁOKA (AppGate) — czyli to, co jest POZA modułem.
//
// Czego tu świadomie NIE MA: pełnej generacji przez AI. cortex-proxy jest
// wołany SERVER-SIDE, więc `page.route` (interceptor przeglądarki) go nie
// dosięgnie — mockowanie musiałoby iść przez CORTEX_PROXY_URL wskazujący
// atrapę w env webServera. Ścieżka generacji ma pokrycie w testach route-level
// (guard-coverage.test.ts) i kontraktowych (cortex-proxy-image.test.ts),
// a E2E pilnuje tego, czego tamte nie widzą: że dane FAKTYCZNIE płyną
// baza -> API -> UI, że podgląd renderuje realny PNG z compose(), i że
// granica uprawnień działa na żywej ścieżce żądania.

import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

// Dev server kompiluje route'y NA ŻĄDANIE, więc pierwszy test w przebiegu
// płaci za kompilację strony i endpointu (zmierzone: 43 s na zimno vs 6 s na
// ciepło). Domyślne 30 s na test potrafi na to nie wystarczyć — podnosimy limit
// wyłącznie dla tego pliku, zamiast ruszać globalną konfigurację, na której
// stoją pozostałe suity.
test.describe.configure({ timeout: 90_000 })

test.describe("Ilustromat — generowanie", () => {
  test("użytkownik z grantem widzi ekran i szablony marki wczytane z bazy", async ({
    page,
    seed,
    ilustromatGenerationPage,
  }) => {
    const { email } = await seed("ilustromat-user")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["ilustromat"] })

    await ilustromatGenerationPage.goto()

    await expect(ilustromatGenerationPage.heading).toBeVisible()
    await expect(ilustromatGenerationPage.emptyState).toBeVisible()

    // Dowód, że lista jedzie z PRAWDZIWEJ bazy przez requireTileAccess(),
    // a nie z jakiegokolwiek mocka: nazwa pochodzi wprost z seeda i ląduje
    // jako wybrana wartość selecta.
    //
    // Hojny timeout jest tu celowy, nie "na wszelki wypadek": pierwszy test
    // w przebiegu trafia w dev server, który dopiero KOMPILUJE route
    // /api/ilustromat/templates na żądanie (zmierzone: przebieg na zimno
    // 43 s vs 6 s na ciepło). Domyślne 5 s wywracało ten test na zimnym
    // starcie, mimo że aplikacja działa poprawnie.
    await expect(ilustromatGenerationPage.templateSelect).toContainText("Crido — fioletowa", {
      timeout: 30_000,
    })
    // Kontrola dopełniająca: z wczytanym szablonem generowanie jest odblokowane.
    await expect(ilustromatGenerationPage.generateButton).toBeEnabled()
  })

  test("użytkownik bez grantu do kafelka nie dostaje danych modułu", async ({ page, seed }) => {
    await seed("ilustromat-user")
    const intruder = "ktos-obcy@e2e.local"
    await asUser(page, intruder)
    // Powłoka celowo PRZEPUSZCZA — chcemy zobaczyć, że odcina moduł, nie shell.
    await mockShellAccess(page, { email: intruder, apps: ["ilustromat"] })

    const response = await page.request.get("/api/ilustromat/templates", {
      headers: { "x-auth-request-email": intruder },
    })

    expect(response.status()).toBe(403)
  })
})

test.describe("Ilustromat — szablony marki", () => {
  test("kreator renderuje podgląd realną funkcją compose()", async ({
    page,
    seed,
    ilustromatTemplatesPage,
  }) => {
    const { email } = await seed("ilustromat-template-manager")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["ilustromat"] })

    await ilustromatTemplatesPage.goto()
    await expect(ilustromatTemplatesPage.heading).toBeVisible()

    // Podgląd to prawdziwy PNG z serwera (image/png z route preview), nie
    // placeholder — naturalWidth > 0 dowodzi, że przeglądarka go zdekodowała.
    const preview = ilustromatTemplatesPage.preview
    await expect(preview).toBeVisible({ timeout: 15_000 })
    await expect
      .poll(async () => preview.evaluate((img: HTMLImageElement) => img.naturalWidth), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0)
  })

  test("lista pokazuje oba domyślne szablony z bazy", async ({
    page,
    seed,
    ilustromatTemplatesPage,
  }) => {
    const { email } = await seed("ilustromat-template-manager")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["ilustromat"] })

    await ilustromatTemplatesPage.goto()

    await expect(ilustromatTemplatesPage.templateRow("Crido — fioletowa (domyślna)")).toBeVisible()
    await expect(ilustromatTemplatesPage.templateRow("Crido — jasna")).toBeVisible()
  })

  test("ostrzega o kontraście poniżej progu WCAG AA", async ({
    page,
    seed,
    ilustromatTemplatesPage,
  }) => {
    const { email } = await seed("ilustromat-template-manager")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["ilustromat"] })

    await ilustromatTemplatesPage.goto()
    await expect(ilustromatTemplatesPage.heading).toBeVisible()

    // Jasnoszary tekst na białym tle — kontrast ~1.6:1, głęboko poniżej 4.5:1.
    await ilustromatTemplatesPage.colorBg.fill("#FFFFFF")
    await ilustromatTemplatesPage.colorText.fill("#DDDDDD")

    await expect(ilustromatTemplatesPage.contrastWarning).toBeVisible()
  })
})

test.describe("Ilustromat — warstwa granularna uprawnień", () => {
  // Sedno wariantu (a) z projektu: application_scopes dostaje pierwszego
  // realnego konsumenta. Dostęp do kafelka NIE nadaje prawa do zmiany marki.
  test("dostęp do kafelka nie wystarcza, żeby zmienić szablon marki", async ({ page, seed }) => {
    const { email } = await seed("ilustromat-user")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["ilustromat"] })

    const headers = { "x-auth-request-email": email }

    // Odczyt listy: WOLNO (end-user musi wybrać szablon do generacji).
    const list = await page.request.get("/api/ilustromat/templates", { headers })
    expect(list.status()).toBe(200)

    // Zmiana szablonu: ZAKAZANA bez scope'u manage-templates.
    const patch = await page.request.patch("/api/ilustromat/templates/crido-violet", {
      headers,
      data: { action: "set-active", isActive: false },
    })
    expect(patch.status()).toBe(403)

    // Podgląd kreatora też jest administracyjny.
    const preview = await page.request.post("/api/ilustromat/templates/nowy/preview", {
      headers,
      data: {
        template: {
          name: "Podmiana marki",
          colorBg: "#000000",
          colorText: "#FFFFFF",
          colorAccent: "#FF8C42",
          fontSource: "library",
          fontLibraryId: "noto-sans",
          logoPosition: "bottom-right",
          cornerRadius: 28,
          minImageAreaRatio: 0.45,
          websiteText: null,
          layout: "image-top",
          textAlign: "left",
        },
      },
    })
    expect(preview.status()).toBe(403)
  })

  test("z grantem scope'u te same operacje przechodzą", async ({ page, seed }) => {
    const { email } = await seed("ilustromat-template-manager")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["ilustromat"] })

    const headers = { "x-auth-request-email": email }

    const patch = await page.request.patch("/api/ilustromat/templates/crido-violet", {
      headers,
      data: { action: "set-active", isActive: false },
    })
    expect(patch.status()).toBe(200)

    // Kontrola pozytywna dla podglądu: 200 i realny obrazek PNG.
    const preview = await page.request.post("/api/ilustromat/templates/crido-light/preview", {
      headers,
      data: {
        template: {
          name: "Crido — jasna",
          colorBg: "#FFFFFF",
          colorText: "#3D267A",
          colorAccent: "#FF8C42",
          fontSource: "library",
          fontLibraryId: "noto-sans",
          logoPosition: "bottom-right",
          cornerRadius: 28,
          minImageAreaRatio: 0.45,
          websiteText: "crido.pl",
          layout: "image-top",
          textAlign: "left",
        },
        title: "Kontrola pozytywna",
      },
    })
    expect(preview.status()).toBe(200)
    expect(preview.headers()["content-type"]).toContain("image/png")

    const body = await preview.body()
    // Sygnatura PNG — dowód, że to realny obraz, nie strona błędu.
    expect(body.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  })
})
