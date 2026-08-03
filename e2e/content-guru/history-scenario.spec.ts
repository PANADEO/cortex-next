// E2E kafelka Content Guru — Historia (Tor A, design doc §4.5, Round E):
// realny Postgres + realne API modułu, mockowana WYŁĄCZNIE powłoka. Cztery
// zaseedowane treści (mix done/done-with-warnings, mix typów) + jeden wiersz
// podrzucony pod CONTENT_GURU_FOREIGN_EMAIL pochodzą z jednego, nazwanego
// scenariusza — seedContentGuruWithArchive() w e2e/fixtures/db-seed.ts.

import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

test.describe.configure({ timeout: 90_000 })
const SLOW = { timeout: 30_000 }

test.describe("Content Guru — historia", () => {
  test("lista pokazuje wszystkie własne wpisy, NIGDY cudzy rekord", async ({
    page,
    seed,
    contentGuruHistoryPage,
  }) => {
    const { email } = await seed("content-guru-with-archive")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })

    await contentGuruHistoryPage.goto()
    await expect(contentGuruHistoryPage.heading).toBeVisible(SLOW)

    await expect(contentGuruHistoryPage.row("Rekrutacja Senior .NET Developer")).toBeVisible(SLOW)
    await expect(contentGuruHistoryPage.row("Premiera nowej funkcji")).toBeVisible()
    await expect(contentGuruHistoryPage.row("Wyniki finansowe Q3")).toBeVisible()
    await expect(contentGuruHistoryPage.row("Rekrutacja Backend Developera")).toBeVisible()

    // Dowód izolacji: rekord podrzucony pod CONTENT_GURU_FOREIGN_EMAIL nigdy
    // nie wychodzi na liście właściciela testu.
    await expect(page.getByText("Cudzy temat niewidoczny dla właściciela testu")).not.toBeVisible()
  })

  test("filtr statusu 'Zakazane frazy' zawęża listę do wpisu done-with-warnings", async ({
    page,
    seed,
    contentGuruHistoryPage,
  }) => {
    const { email } = await seed("content-guru-with-archive")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })

    await contentGuruHistoryPage.goto()
    await expect(contentGuruHistoryPage.row("Premiera nowej funkcji")).toBeVisible(SLOW)

    await contentGuruHistoryPage.statusFilter.click()
    await page.getByRole("option", { name: "Zakazane frazy" }).click()

    await expect(contentGuruHistoryPage.row("Premiera nowej funkcji")).toBeVisible()
    await expect(contentGuruHistoryPage.row("Rekrutacja Senior .NET Developer")).not.toBeVisible()
    await expect(contentGuruHistoryPage.row("Wyniki finansowe Q3")).not.toBeVisible()
  })

  test("filtr typu treści zawęża listę do dwóch wpisów tej samej kategorii", async ({
    page,
    seed,
    contentGuruHistoryPage,
  }) => {
    const { email } = await seed("content-guru-with-archive")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })

    await contentGuruHistoryPage.goto()
    await expect(contentGuruHistoryPage.row("Rekrutacja Senior .NET Developer")).toBeVisible(SLOW)

    await contentGuruHistoryPage.contentTypeFilter.click()
    await page.getByRole("option", { name: "Rekrutacja — Post na LinkedIn" }).click()

    await expect(contentGuruHistoryPage.row("Rekrutacja Senior .NET Developer")).toBeVisible()
    await expect(contentGuruHistoryPage.row("Rekrutacja Backend Developera")).toBeVisible()
    await expect(contentGuruHistoryPage.row("Premiera nowej funkcji")).not.toBeVisible()
    await expect(contentGuruHistoryPage.row("Wyniki finansowe Q3")).not.toBeVisible()
  })

  test("wyszukiwanie zawęża listę do wpisu zawierającego frazę w temacie", async ({
    page,
    seed,
    contentGuruHistoryPage,
  }) => {
    const { email } = await seed("content-guru-with-archive")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })

    await contentGuruHistoryPage.goto()
    await expect(contentGuruHistoryPage.row("Wyniki finansowe Q3")).toBeVisible(SLOW)
    await contentGuruHistoryPage.searchInput.fill("finansowe")

    await expect(contentGuruHistoryPage.row("Wyniki finansowe Q3")).toBeVisible()
    await expect(contentGuruHistoryPage.row("Rekrutacja Senior .NET Developer")).not.toBeVisible()
    await expect(contentGuruHistoryPage.row("Premiera nowej funkcji")).not.toBeVisible()
  })

  test("szczegóły wpisu z zakazaną frazą: banner ostrzegawczy + <mark> na dopasowanym fragmencie", async ({
    page,
    seed,
    contentGuruHistoryPage,
    contentGuruHistoryDetailPage,
  }) => {
    const { email } = await seed("content-guru-with-archive")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })

    await contentGuruHistoryPage.goto()
    await expect(contentGuruHistoryPage.row("Premiera nowej funkcji")).toBeVisible(SLOW)
    await contentGuruHistoryPage.openDetails("Premiera nowej funkcji")

    await expect(contentGuruHistoryDetailPage.heading).toBeVisible(SLOW)
    // Hojny timeout na TĘ konkretną asercję (nie na `heading` wyżej): nagłówek
    // renderuje się od razu (statyczny PageHeader), ale banner czeka na dane z
    // GET /api/content-guru/archive/[id] — pierwsze trafienie w ten route w
    // przebiegu płaci za kompilację na zimno (wzorem
    // visual-guru/history-scenario.spec.ts).
    await expect(contentGuruHistoryDetailPage.warningsBanner).toBeVisible(SLOW)
    await expect(contentGuruHistoryDetailPage.markedPhrase("najlepszy na rynku")).toBeVisible()
  })

  test("szczegóły wpisu BEZ zakazanych fraz: brak bannera i <mark>", async ({
    page,
    seed,
    contentGuruHistoryPage,
    contentGuruHistoryDetailPage,
  }) => {
    const { email } = await seed("content-guru-with-archive")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })

    await contentGuruHistoryPage.goto()
    await expect(contentGuruHistoryPage.row("Wyniki finansowe Q3")).toBeVisible(SLOW)
    await contentGuruHistoryPage.openDetails("Wyniki finansowe Q3")

    await expect(contentGuruHistoryDetailPage.heading).toBeVisible(SLOW)
    await expect(contentGuruHistoryDetailPage.warningsBanner).not.toBeVisible()
    await expect(page.locator("mark")).toHaveCount(0)
  })

  test("cudzy wpis jest niewidoczny nawet po bezpośrednim id (404, nie 403)", async ({
    page,
    seed,
    contentGuruHistoryDetailPage,
  }) => {
    const { email } = await seed("content-guru-with-archive")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })

    // Znane z góry id realnego wpisu podrzuconego pod CONTENT_GURU_FOREIGN_EMAIL
    // (db-seed.ts).
    await contentGuruHistoryDetailPage.goto("a1000000-0000-0000-0000-000000000001")
    await expect(contentGuruHistoryDetailPage.heading).toBeVisible(SLOW)
    await expect(contentGuruHistoryDetailPage.notFound).toBeVisible(SLOW)

    // Kontrola dopełniająca: id, które NIE istnieje w ogóle, daje ten sam wynik.
    await contentGuruHistoryDetailPage.goto("00000000-0000-0000-0000-000000000000")
    await expect(contentGuruHistoryDetailPage.notFound).toBeVisible(SLOW)
  })
})
