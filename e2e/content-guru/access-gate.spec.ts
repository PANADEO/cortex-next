// E2E kafelka Content Guru — Tor A (PROJECT/cortex-frontend-content-guru-
// full-port-projekt.md §7, wzorem e2e/ilustromat/ilustromat-scenario.spec.ts
// i e2e/document-parser/access-gate.spec.ts): realny Postgres + realne
// requireTileAccess()/requireTileScope(), mockowana WYŁĄCZNIE powłoka
// (AppGate). Dwie bramki tego modułu (D6/D9): dostęp do kafelka
// (`content-guru`) i granularny scope `manage-templates` nad szablonami —
// zasobem WSPÓLNYM między userami (mutacje szablonów wymagają obu).

import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

test.describe.configure({ timeout: 90_000 })

test.describe("Content Guru — bramka dostępu", () => {
  test("użytkownik z grantem widzi ekran generowania i szablon wczytany z bazy", async ({
    page,
    seed,
    contentGuruGeneratePage,
  }) => {
    const { email } = await seed("content-guru-user")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })

    await contentGuruGeneratePage.goto()
    await expect(contentGuruGeneratePage.heading).toBeVisible()

    // Dowód, że dane jadą z PRAWDZIWEJ bazy przez requireTileAccess(), nie z
    // zamockowanej sieci — nazwa szablonu pochodzi wprost z seeda. Select
    // szablonu NIE auto-zaznacza się (page.tsx ma efekt auto-selekcji tylko
    // dla kategorii) — dowodem realnych danych jest to, że opcja w ogóle
    // istnieje w otwartej liście, nie treść triggera przed wyborem. Hojny
    // timeout na WŁĄCZENIE się selecta: pierwsze trafienie w
    // GET /api/content-guru/templates w tym przebiegu płaci za kompilację
    // route'a na zimno (wzorem ilustromat-scenario.spec.ts).
    await expect(contentGuruGeneratePage.templateSelect).toBeEnabled({ timeout: 30_000 })
    await contentGuruGeneratePage.selectTemplate("Post na LinkedIn")
    await expect(contentGuruGeneratePage.templateSelect).toContainText("Post na LinkedIn")
  })

  test("użytkownik bez grantu do kafelka nie dostaje danych modułu", async ({ page, seed }) => {
    await seed("content-guru-user")
    const intruder = "ktos-obcy-content-guru@e2e.local"
    await asUser(page, intruder)
    // Powłoka celowo PRZEPUSZCZA — chcemy zobaczyć, że odcina moduł, nie shell.
    await mockShellAccess(page, { email: intruder, apps: ["content-guru"] })

    const response = await page.request.get("/api/content-guru/templates", {
      headers: { "x-auth-request-email": intruder },
    })

    expect(response.status()).toBe(403)
  })

  test("brak nagłówka tożsamości: 401, nie 403", async ({ page, seed }) => {
    await seed("content-guru-user")

    const response = await page.request.get("/api/content-guru/templates")
    expect(response.status()).toBe(401)
  })

  test("dostęp do kafelka nie wystarcza, żeby zmienić szablon (manage-templates)", async ({
    page,
    seed,
  }) => {
    const { email } = await seed("content-guru-user")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })
    const headers = { "x-auth-request-email": email }

    // Odczyt listy: WOLNO (end-user musi wybrać szablon do generacji).
    const list = await page.request.get("/api/content-guru/templates", { headers })
    expect(list.status()).toBe(200)

    // Utworzenie szablonu: ZAKAZANE bez scope'u manage-templates.
    const create = await page.request.post("/api/content-guru/templates", {
      headers,
      data: { name: "Nielegalny szablon", category: "Główne", content: "Treść." },
    })
    expect(create.status()).toBe(403)
  })

  test("z grantem scope'u manage-templates tworzenie szablonu przechodzi (201)", async ({
    page,
    seed,
  }) => {
    const { email } = await seed("content-guru-manage-templates")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })

    const create = await page.request.post("/api/content-guru/templates", {
      headers: { "x-auth-request-email": email },
      data: { name: "Nowy legalny szablon", category: "Główne", content: "Treść." },
    })

    expect(create.status()).toBe(201)
    const body = await create.json()
    expect(body.name).toBe("Nowy legalny szablon")
  })
})
