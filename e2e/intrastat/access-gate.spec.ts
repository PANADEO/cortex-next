// Bramka dostępu do kafelka Intrastat, widziana z przeglądarki.
//
// ZAKRES, świadomie węższy niż dla dwóch pozostałych modułów: Intrastat nie ma
// w tym repo ani jednego route'a (`app/idp/app/api/` nie zawiera katalogu
// `intrastat`). Backend to osobna aplikacja FastAPI pod INTRASTAT_BACKEND_URL,
// do której middleware przepisuje `/intrastat/api/**` bez żadnego sprawdzenia.
// Dlatego dla tego kafelka NIE MA odpowiednika guard-coverage.test.ts — bramka
// na ścieżce żądania fizycznie żyje w innym repozytorium. To, czego można
// dowieść stąd, to bramka powłoki i granularne bramki widoczności w UI.
//
// Sam fakt, że tych route'ów nie ma, też jest tu asertowany — żeby dopisanie
// kiedyś route'u `/api/intrastat/**` bez bramki nie przeszło niezauważone tylko
// dlatego, że nikt nie pamiętał o tym wyjątku.

import { readdirSync } from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { IntrastatDashboardPage } from "../poms/intrastat/dashboard-page"
import { mockIdpConfig } from "../support/mocks/idp-config"
import { mockIntrastatBackend } from "../support/mocks/intrastat-backend"
import { mockShellAccess } from "../support/mocks/shell-access"

const EMAIL = "demo@cortex.local"

test.describe("Intrastat — bramka dostępu w UI", () => {
  test("użytkownik bez grantu na kafelek nie wchodzi na dashboard", async ({ page }) => {
    await mockShellAccess(page, { email: EMAIL, apps: ["idp"] })
    await mockIdpConfig(page)
    const backend = await mockIntrastatBackend(page)

    const dashboard = new IntrastatDashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.accessDeniedShell).toBeVisible()
    await expect(dashboard.heading).toHaveCount(0)
    // Odmowa nie może po drodze zapytać backendu Intrastatu o cudze dane.
    expect(backend.exports).toHaveLength(0)
  })

  test("grant na inny kafelek nie otwiera Intrastatu", async ({ page }) => {
    await mockShellAccess(page, { email: EMAIL, apps: ["okna-czasowe", "ilustromat"] })
    await mockIdpConfig(page)
    await mockIntrastatBackend(page)

    const dashboard = new IntrastatDashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.accessDeniedShell).toBeVisible()
  })

  test("grant na kafelek intrastat otwiera dashboard", async ({ page }) => {
    await mockShellAccess(page, { email: EMAIL, apps: ["intrastat"] })
    await mockIdpConfig(page)
    await mockIntrastatBackend(page)

    const dashboard = new IntrastatDashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.heading).toBeVisible()
    await expect(dashboard.accessDeniedShell).toHaveCount(0)
  })

  test("moduł nadal nie ma własnych route'ów w tym repo (założenie zakresu testów)", () => {
    // Gdy ktoś doda `app/idp/app/api/intrastat/**`, ten test zrobi się czerwony
    // — i słusznie: od tej chwili moduł POTRZEBUJE własnego guard-coverage.test.ts,
    // tak jak cortex-config i okna-czasowe.
    const apiDir = path.resolve(__dirname, "..", "..", "app", "idp", "app", "api")

    expect(readdirSync(apiDir)).not.toContain("intrastat")
  })
})
