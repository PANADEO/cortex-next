// E2E kafelka Content Guru — Profile klienta/rynku (Tor A, design doc D7):
// realny Postgres + realne API modułu, mockowana WYŁĄCZNIE powłoka. PER-USER
// (code-service SKILL.md "Rekordy per-user") — CRUD nie woła cortex-proxy,
// więc w pełni Tor A. Scenariusz `content-guru-with-archive` (db-seed.ts)
// seeduje jeden profil klienta i jeden profil rynku właściciela testu, plus
// po jednym rekordzie podrzuconym pod CONTENT_GURU_FOREIGN_EMAIL — dowód
// izolacji per-user.

import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

test.describe.configure({ timeout: 90_000 })

test.describe("Content Guru — profile klienta", () => {
  test("lista pokazuje własny profil, NIGDY cudzy; utwórz -> edytuj -> usuń", async ({
    page,
    seed,
    contentGuruClientProfilesPage,
  }) => {
    const { email } = await seed("content-guru-with-archive")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })

    await contentGuruClientProfilesPage.goto()
    await expect(contentGuruClientProfilesPage.heading).toBeVisible({ timeout: 30_000 })
    // Hojny timeout: nagłówek renderuje się od razu (statyczny PageHeader),
    // ale wiersz czeka na GET /api/content-guru/client-profiles — pierwsze
    // trafienie w ten route+stronę w przebiegu płaci za kompilację na zimno.
    await expect(contentGuruClientProfilesPage.row("Klient testowy S.A.")).toBeVisible({ timeout: 30_000 })
    // Dowód izolacji: rekord podrzucony pod CONTENT_GURU_FOREIGN_EMAIL nigdy
    // nie wychodzi na liście właściciela testu.
    await expect(page.getByText("Cudzy profil klienta")).not.toBeVisible()

    // --- utwórz ---
    await contentGuruClientProfilesPage.newProfileButton.click()
    await contentGuruClientProfilesPage.profileNameInput.fill("Nowy klient E2E")
    await contentGuruClientProfilesPage.descriptionInput.fill("Opis nowego klienta.")
    await contentGuruClientProfilesPage.saveButton.click()
    await expect(contentGuruClientProfilesPage.row("Nowy klient E2E")).toBeVisible()

    // --- edytuj ---
    await contentGuruClientProfilesPage.editButton("Nowy klient E2E").click()
    await expect(contentGuruClientProfilesPage.profileNameInput).toHaveValue("Nowy klient E2E")
    await contentGuruClientProfilesPage.profileNameInput.fill("Nowy klient E2E (zmieniony)")
    await contentGuruClientProfilesPage.saveButton.click()
    await expect(contentGuruClientProfilesPage.row("Nowy klient E2E (zmieniony)")).toBeVisible()

    // --- usuń profil z seeda, nowy zostaje ---
    await contentGuruClientProfilesPage.deleteButton("Klient testowy S.A.").click()
    await contentGuruClientProfilesPage.confirmDeleteButton.click()
    await expect(contentGuruClientProfilesPage.row("Klient testowy S.A.")).not.toBeVisible()
    await expect(contentGuruClientProfilesPage.row("Nowy klient E2E (zmieniony)")).toBeVisible()
  })
})

test.describe("Content Guru — profile rynku", () => {
  test("lista pokazuje własny profil, NIGDY cudzy; utwórz -> edytuj -> usuń", async ({
    page,
    seed,
    contentGuruMarketProfilesPage,
  }) => {
    const { email } = await seed("content-guru-with-archive")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })

    await contentGuruMarketProfilesPage.goto()
    await expect(contentGuruMarketProfilesPage.heading).toBeVisible({ timeout: 30_000 })
    // Hojny timeout — ten sam powód co client-profiles wyżej: pierwsze
    // trafienie w GET /api/content-guru/market-profiles w przebiegu.
    await expect(contentGuruMarketProfilesPage.row("Rynek testowy")).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("Cudzy profil rynku")).not.toBeVisible()

    // --- utwórz ---
    await contentGuruMarketProfilesPage.newProfileButton.click()
    await contentGuruMarketProfilesPage.profileNameInput.fill("Nowy rynek E2E")
    await contentGuruMarketProfilesPage.descriptionInput.fill("Opis nowego rynku.")
    await contentGuruMarketProfilesPage.saveButton.click()
    await expect(contentGuruMarketProfilesPage.row("Nowy rynek E2E")).toBeVisible()

    // --- edytuj ---
    await contentGuruMarketProfilesPage.editButton("Nowy rynek E2E").click()
    await expect(contentGuruMarketProfilesPage.profileNameInput).toHaveValue("Nowy rynek E2E")
    await contentGuruMarketProfilesPage.profileNameInput.fill("Nowy rynek E2E (zmieniony)")
    await contentGuruMarketProfilesPage.saveButton.click()
    await expect(contentGuruMarketProfilesPage.row("Nowy rynek E2E (zmieniony)")).toBeVisible()

    // --- usuń profil z seeda, nowy zostaje ---
    await contentGuruMarketProfilesPage.deleteButton("Rynek testowy").click()
    await contentGuruMarketProfilesPage.confirmDeleteButton.click()
    await expect(contentGuruMarketProfilesPage.row("Rynek testowy")).not.toBeVisible()
    await expect(contentGuruMarketProfilesPage.row("Nowy rynek E2E (zmieniony)")).toBeVisible()
  })
})

test.describe("Content Guru — izolacja profili po bezpośrednim id", () => {
  test("cudzy profil klienta/rynku: 404, nie 403", async ({ page, seed }) => {
    const { email } = await seed("content-guru-with-archive")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })
    const headers = { "x-auth-request-email": email }

    // "a1000000-...-0002"/"...-0003" to REALNE, istniejące w bazie rekordy —
    // należące do CONTENT_GURU_FOREIGN_EMAIL, nie do właściciela testu
    // (db-seed.ts). Route musi odróżnić "cudze" od "nie istnieje" identycznie
    // — oba 404, nigdy 403 (403 zdradzałby, że rekord o tym id w ogóle istnieje).
    const client = await page.request.get(
      "/api/content-guru/client-profiles/a1000000-0000-0000-0000-000000000002",
      { headers },
    )
    expect(client.status()).toBe(404)

    const market = await page.request.get(
      "/api/content-guru/market-profiles/a1000000-0000-0000-0000-000000000003",
      { headers },
    )
    expect(market.status()).toBe(404)

    // Kontrola dopełniająca: id, które NIE istnieje w ogóle, daje ten sam wynik.
    const missing = await page.request.get(
      "/api/content-guru/client-profiles/00000000-0000-0000-0000-000000000000",
      { headers },
    )
    expect(missing.status()).toBe(404)
  })
})
