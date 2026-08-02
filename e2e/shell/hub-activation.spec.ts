// Aktywacja natywnego kafelka z listy manifestów (D6-rewizja/D10-rewizja d,
// PROJECT/cortex-frontend-hub-db-driven-projekt.md) — realna ścieżka E2E, nie
// tylko unit-test walidacji w izolacji: prawdziwy Postgres, prawdziwy request
// HTTP przez formularz "Dodaj aplikację", prawdziwy hub.
//
// Scenariusz odtwarza dokładnie stan, który w realnym deployu tworzy
// seed-tile-manifests.mjs dla kodu jeszcze nieobecnego w APPLICATIONS
// seed-system-config.mjs: wiersz `kind=native`, `is_active=false`,
// `show_on_hub=false`, `activated_at=null` — zarejestrowany w kodzie, nigdy
// nie aktywowany w tej instancji. Dziś (po Kroku 1b) wszystkie 24 manifesty
// mają już swój wpis w jednym z trzech seedów, więc taki wiersz nie powstaje
// sam z siebie na czystym deployu — test tworzy go wprost, żeby dowieść
// mechanizmu niezależnie od tego, czy akurat istnieje naturalny kandydat.

import { applications, getDb, permissionsMatrix, roles } from "@cortex/db"
import { asUser, expect, test } from "../fixtures/fixtures"
import { resetSystemConfig, runRegistrySeed } from "../fixtures/db-seed"
import { mockIdpConfig } from "../support/mocks/idp-config"

test.describe.configure({ timeout: 300_000 })

const ADMIN_EMAIL = "admin-activation@e2e.local"
const UNACTIVATED_CODE = "e2e-unactivated-native"
const UNACTIVATED_NAME = "E2E Nieaktywowany Moduł"
const UNACTIVATED_ROUTE = `/${UNACTIVATED_CODE}`

/**
 * Stan bazy: pełny rejestr prawdziwych seedów (`runRegistrySeed`, ten sam
 * łańcuch co usługa `migrate`) + admin z grantem do WSZYSTKIEGO (jak dziś na
 * realnym deployu) + JEDEN dodatkowy wiersz `kind=native` bez historii
 * aktywacji, granty adminowi dograne ręcznie (na realnym deployu robi to
 * seed-system-config.mjs, tu wstawiony PO tamtym seedzie, więc trzeba
 * dogonić grant — dokładnie ten sam powód, dla którego seed-tile-manifests.mjs
 * musi wyprzedzać seed-system-config.mjs w łańcuchu migrate).
 */
async function seedUnactivatedNativeCandidate(): Promise<void> {
  await resetSystemConfig()
  runRegistrySeed({ adminEmail: ADMIN_EMAIL })

  const db = getDb()
  const [candidate] = await db
    .insert(applications)
    .values({
      code: UNACTIVATED_CODE,
      name: UNACTIVATED_NAME,
      kind: "native",
      route: UNACTIVATED_ROUTE,
      isActive: false,
      showOnHub: false,
      activatedAt: null,
      sortOrder: 999,
    })
    .returning()

  // Bez drizzle-orm `eq()` w tym pliku celowo — root package.json nie
  // deklaruje drizzle-orm jako własnej zależności (mają ją tylko
  // @cortex/db/@cortex/service), więc bezpośredni import spod e2e/ nie
  // rozwiązuje się w tsc. Filtr w JS zamiast w WHERE — jedna rola "admin",
  // zbiór jest mały.
  const allRoles = await db.select({ id: roles.id, code: roles.code }).from(roles)
  const adminRole = allRoles.find((role) => role.code === "admin")
  await db.insert(permissionsMatrix).values({ roleId: adminRole!.id, applicationId: candidate!.id })
}

/**
 * Krok 5 (PROJECT/cortex-frontend-hub-db-driven-projekt.md — stan pusty
 * SELECT-a): rejestr bez ŻADNEGO dodatkowego, ręcznie wstawionego kandydata —
 * WSZYSTKIE ~24 dzisiejsze manifesty przychodzą z prawdziwych seedów już
 * aktywowane (`activated_at = now()`, patrz seed-system-config.mjs), więc
 * listUnactivatedNativeApplications() zwraca pustą listę tak samo, jak
 * zwróciłaby na świeżym, w pełni zaktywowanym deployu.
 */
async function seedFullyActivatedRegistry(): Promise<void> {
  await resetSystemConfig()
  runRegistrySeed({ adminEmail: ADMIN_EMAIL })
}

test.describe("Aktywacja natywnego kafelka z listy manifestów (D6-rewizja/D10-rewizja d)", () => {
  test.beforeEach(async ({ page }) => {
    await seedUnactivatedNativeCandidate()
    await asUser(page, ADMIN_EMAIL)
    await mockIdpConfig(page)
    await page.route("**/user/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email: ADMIN_EMAIL, has_access: true }),
      })
    })
  })

  test("kafelek NIE widoczny na hubie przed aktywacją, widoczny natychmiast po", async ({
    page,
    applicationsPage,
  }) => {
    // 1. Przed aktywacją: kafelek nie renderuje się na hubie mimo grantu —
    //    listHubApplications() filtruje is_active/show_on_hub, nie samą
    //    obecność grantu (D7).
    await page.goto("/")
    await expect(page.getByText("Konfiguracja Systemu", { exact: true })).toBeVisible()
    await expect(page.getByText(UNACTIVATED_NAME, { exact: true })).toBeHidden()

    // 2. Formularz "Dodaj aplikację": dla kind=native (domyślny) formularz
    //    pokazuje SELECT kandydatów z listUnactivatedNativeApplications(),
    //    nie wolne pole route.
    await applicationsPage.goto()
    await applicationsPage.openCreateDialog()
    await applicationsPage.selectManifest(UNACTIVATED_NAME)

    // Kod/ścieżka pochodzą z manifestu, wyświetlone jako podgląd tylko do
    // odczytu — dowód, że formularz naprawdę wziął je z wybranego kandydata,
    // nie z wpisanego tekstu (bo nic tu nie da się wpisać).
    await expect(applicationsPage.dialog.getByText(UNACTIVATED_CODE, { exact: true })).toBeVisible()
    await expect(applicationsPage.dialog.getByText(UNACTIVATED_ROUTE, { exact: true })).toBeVisible()

    await applicationsPage.activateButton.click()

    // 3. Po aktywacji: redirect na szczegóły, is_active/show_on_hub prawdziwe.
    await expect(page).toHaveURL(`/system-config/applications/${UNACTIVATED_CODE}`)
    await expect(page.getByRole("heading", { name: UNACTIVATED_NAME })).toBeVisible()

    // 4. Hub TERAZ pokazuje kafelek — bez przeładowania przez ręczny refetch,
    //    invalidateQueries po aktywacji (useActivateApplication) załatwia to
    //    samo, ale nawigacja i tak wymusza świeże query.
    await page.goto("/")
    await expect(page.getByText(UNACTIVATED_NAME, { exact: true })).toBeVisible()
  })

  test("aktywacja jest bezpieczna na wyścig — drugi POST na już aktywowanym kodzie to no-op, nie błąd", async ({
    page,
  }) => {
    // Aktywuj raz przez prawdziwy request HTTP (nie przez serwis w izolacji —
    // to jest dokładnie ta ścieżka, którą pokonuje przeglądarka).
    const first = await page.request.post("/api/system-config/applications/activate", {
      headers: { "x-auth-request-email": ADMIN_EMAIL },
      data: { code: UNACTIVATED_CODE },
    })
    expect(first.ok()).toBe(true)
    const firstBody = await first.json()
    expect(firstBody.activatedAt).not.toBeNull()

    // Drugi request na tym samym kodzie: no-op, wraca 200 z NIE ZMIENIONYM
    // activated_at — nie 409, nie podwójna aktywacja.
    const second = await page.request.post("/api/system-config/applications/activate", {
      headers: { "x-auth-request-email": ADMIN_EMAIL },
      data: { code: UNACTIVATED_CODE },
    })
    expect(second.ok()).toBe(true)
    const secondBody = await second.json()
    expect(secondBody.activatedAt).toBe(firstBody.activatedAt)
  })

  test("nieznany kod aktywacji wraca jako 404, nie 500", async ({ page }) => {
    const response = await page.request.post("/api/system-config/applications/activate", {
      headers: { "x-auth-request-email": ADMIN_EMAIL },
      data: { code: "kod-ktory-nigdy-nie-istnial" },
    })
    expect(response.status()).toBe(404)
  })

  // Krok 5 (PROJECT/cortex-frontend-hub-db-driven-projekt.md — "rozróżnienie
  // wizualne na liście Aplikacje"): to samo rozróżnienie co test wyżej
  // ("kafelek NIE widoczny na hubie..."), ale sprawdzone na liście ADMINA
  // (/system-config/applications), nie na hubie. Wiersz native bez historii
  // aktywacji żyje WYŁĄCZNIE w SELECT-cie "Dodaj aplikację" — nie ma się
  // pojawić na liście głównej, dopóki ktoś go nie aktywuje.
  test("wiersz native bez historii aktywacji NIE jest widoczny na liście Aplikacje, widoczny natychmiast po aktywacji", async ({
    page,
    applicationsPage,
  }) => {
    await applicationsPage.goto()
    await expect(applicationsPage.heading).toBeVisible()
    await expect(page.getByRole("row", { name: new RegExp(UNACTIVATED_CODE) })).toBeHidden()

    await applicationsPage.openCreateDialog()
    await applicationsPage.selectManifest(UNACTIVATED_NAME)
    await applicationsPage.activateButton.click()
    await expect(page).toHaveURL(`/system-config/applications/${UNACTIVATED_CODE}`)

    await applicationsPage.goto()
    await expect(page.getByRole("row", { name: new RegExp(UNACTIVATED_CODE) })).toBeVisible()
  })
})

// Krok 5 (PROJECT/cortex-frontend-hub-db-driven-projekt.md, punkt 1): stan
// pusty SELECT-a w formularzu "Dodaj aplikację", gdy WSZYSTKIE zarejestrowane
// manifesty są już aktywowane — musi pokazać jasny komunikat, nie pustą,
// mylącą listę wyglądającą jak stan ładowania albo błąd.
test.describe("Pusty SELECT w \"Dodaj aplikację\", gdy wszystkie manifesty są już aktywowane (Krok 5)", () => {
  test.beforeEach(async ({ page }) => {
    await seedFullyActivatedRegistry()
    await asUser(page, ADMIN_EMAIL)
    await mockIdpConfig(page)
    await page.route("**/user/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email: ADMIN_EMAIL, has_access: true }),
      })
    })
  })

  test("pokazuje jasny komunikat zamiast pustej listy — SELECT w ogóle się nie renderuje", async ({
    page,
    applicationsPage,
  }) => {
    await applicationsPage.goto()
    // kind domyślnie "native" (EMPTY_FORM) — dialog otwiera się od razu na
    // ścieżce, której dotyczy ten stan pusty, bez dodatkowego przełączania.
    await applicationsPage.openCreateDialog()

    await expect(applicationsPage.noUnactivatedCandidatesLocator).toBeVisible()
    await expect(
      applicationsPage.dialog.getByText(
        "każdy natywny moduł zarejestrowany dziś w kodzie jest już aktywny w tej instancji",
      ),
    ).toBeVisible()
    // Dowód, że to naprawdę stan pusty, nie SELECT z zerem widocznych opcji —
    // sam element SELECT nie istnieje w DOM.
    await expect(page.locator("#manifest")).toHaveCount(0)
    await expect(applicationsPage.activateButton).toBeDisabled()
  })
})

// Krok 5, druga połowa "rozróżnienia wizualnego": wiersz native AKTYWOWANY,
// a potem ręcznie wyłączony przez admina, musi zostać widoczny na liście —
// zwykły wyszarzony wiersz, TĄ SAMĄ konwencją co dzisiejszy wyłączony
// external-link (Badge "Wyłączona", `691da0c`), nie nowym wariantem.
test.describe("Aktywowany-a-potem-wyłączony wiersz native — ten sam wygląd co dziś (Krok 5)", () => {
  test.beforeEach(async ({ page }) => {
    await seedUnactivatedNativeCandidate()
    await asUser(page, ADMIN_EMAIL)
    await mockIdpConfig(page)
    await page.route("**/user/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email: ADMIN_EMAIL, has_access: true }),
      })
    })

    const activated = await page.request.post("/api/system-config/applications/activate", {
      headers: { "x-auth-request-email": ADMIN_EMAIL },
      data: { code: UNACTIVATED_CODE },
    })
    expect(activated.ok()).toBe(true)
  })

  test("wyłączony wiersz native i wyłączony wiersz external-link (meeting-guru) renderują identyczny Badge \"Wyłączona\"", async ({
    page,
    applicationsPage,
  }) => {
    await applicationsPage.goto()

    await applicationsPage.deactivate(UNACTIVATED_NAME)
    await applicationsPage.deactivate("Nagrywanie Spotkań") // meeting-guru, kind=external-link (realny seed)

    const nativeBadge = await applicationsPage.statusBadge(UNACTIVATED_CODE)
    const externalBadge = await applicationsPage.statusBadge("meeting-guru")

    await expect(nativeBadge).toHaveText("Wyłączona")
    await expect(externalBadge).toHaveText("Wyłączona")

    // Nie tylko ten sam tekst — ten sam komponent (Badge variant="secondary"):
    // Krok 5 reużywa istniejącą konwencję, nie wprowadza nowego wariantu dla
    // wierszy native.
    expect(await nativeBadge.getAttribute("class")).toBe(await externalBadge.getAttribute("class"))

    // Wiersz zostaje na liście — dokładnie punkt 2 zakresu Kroku 5 (aktywowany
    // wcześniej, wyłączony ręcznie != nigdy nieaktywowany).
    await expect(page.getByRole("row", { name: new RegExp(UNACTIVATED_CODE) })).toBeVisible()
  })
})
