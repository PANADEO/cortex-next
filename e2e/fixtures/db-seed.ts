// Manipulacja danymi demo dla E2E — bezpośrednio przez Drizzle (@cortex/db),
// z pominięciem UI. Ten sam sposób łączenia z prawdziwym Postgresem co
// packages/@cortex/service/src/rbac.integration.test.ts, tylko wywoływany z
// procesu testowego Playwrighta zamiast Vitest.
//
// WAŻNE: ten plik działa w procesie Node, który uruchamia `playwright test`
// (fixtures.ts, patrz niżej) — NIE w przeglądarce i NIE w procesie webServer
// (`npm run dev`). DATABASE_URL musi być ustawione w środowisku URUCHAMIAJĄCYM
// `playwright test`, np.:
//   DATABASE_URL=postgres://cortex:cortex@localhost:5432/cortex npx playwright test
//
// Każdy scenariusz zaczyna od pełnego resetu schematu system_config — testy
// nie zależą od kolejności ani resztek po poprzednim teście. Bezpieczne przy
// `workers: 1` (patrz playwright.config.ts); przy >1 workerze scenariusze
// nadpisywałyby sobie dane nawzajem — nie zwiększaj workers bez zmiany tego
// mechanizmu (np. schema-per-worker) na coś izolowanego.
//
// ⚠️ DESTRUKCYJNE: resetSystemConfig() czyści WSZYSTKIE tabele system_config
// bezwarunkowo. Zweryfikowane na żywo 29.07.2026 — jeden przebieg testów
// skasował realnego admina (BOOTSTRAP_ADMIN_EMAIL) i ręcznie dodane wiersze
// z lokalnej bazy dev. NIGDY nie wskazuj DATABASE_URL na bazę, na której
// zależy Ci na istniejących danych — osobna baza/kontener dla e2e (patrz
// code-e2e/REFERENCE.md "Bezpieczeństwo bazy dla e2e"), nigdy ta sama
// instancja co ręczny `npm run dev`.

import {
  applications,
  applicationScopes,
  permissionsMatrix,
  roleApplicationScopes,
  roles,
  userRoles,
  users,
  getDb,
  type ApplicationRow,
} from "@cortex/db"

const ADMIN_ROLE_CODE = "admin"
const SYSTEM_CONFIG_APP_CODE = "system-config"

export type ScenarioName =
  | "empty"
  | "user-no-roles"
  | "admin-with-one-tile"
  | "five-tiles-one-external-link"

export interface ScenarioResult {
  /** Wstrzyknij jako nagłówek `x-auth-request-email` żeby "być" tym userem —
   *  patrz fixtures.ts `asUser()`. */
  email: string
  applications: ApplicationRow[]
}

/** Czyści WSZYSTKIE tabele schematu system_config, w kolejności bezpiecznej
 *  dla FK (dzieci przed rodzicami). Wywoływane na starcie każdego scenariusza
 *  — nie trzeba (i nie należy) wołać osobno w testach. */
export async function resetSystemConfig(): Promise<void> {
  const db = getDb()
  await db.delete(roleApplicationScopes)
  await db.delete(applicationScopes)
  await db.delete(permissionsMatrix)
  await db.delete(userRoles)
  await db.delete(applications)
  await db.delete(roles)
  await db.delete(users)
}

/**
 * Ustawia bazę w jednym z nazwanych, deterministycznych stanów. Wołaj na
 * początku testu (nie w `beforeAll` dzielonym między testami — każdy test
 * dostaje świeży stan):
 *
 *   const { email } = await seedScenario("admin-with-one-tile")
 *   await asUser(page, email)
 *   await page.goto("/system-config/uzytkownicy")
 *
 * Dodanie nowego scenariusza: nowy literal w `ScenarioName` + `case` niżej.
 * Nie dodawaj parametrów do `seedScenario()` (np. "custom" wariantu) — każdy
 * scenariusz ma być nazwany i czytelny z samej nazwy, jak stan w Storybooku.
 */
export async function seedScenario(name: ScenarioName): Promise<ScenarioResult> {
  await resetSystemConfig()
  const db = getDb()

  switch (name) {
    case "empty":
      // Zero wierszy. `requireTileAccess()` odmawia każdemu — do testowania
      // stanów "brak dostępu" / pustych ekranów bez żadnego usera w tle.
      return { email: "empty-scenario@e2e.local", applications: [] }

    case "user-no-roles": {
      const email = "no-roles@e2e.local"
      await db.insert(users).values({ email, fullName: "Użytkownik bez ról" })
      // Shell (mockShellAccess) wpuści go do modułu, ale własne API modułu
      // (requireTileAccess, DB-backed) odmówi — 403 na /api/system-config/*.
      return { email, applications: [] }
    }

    case "admin-with-one-tile": {
      const email = "admin-one-tile@e2e.local"
      const [user] = await db.insert(users).values({ email, fullName: "Admin E2E" }).returning()
      const [role] = await db
        .insert(roles)
        .values({ code: ADMIN_ROLE_CODE, name: "Administrator", isSystem: true })
        .returning()
      const [app] = await db
        .insert(applications)
        .values({
          code: SYSTEM_CONFIG_APP_CODE,
          name: "Konfiguracja Systemu",
          kind: "native",
          route: "/system-config",
        })
        .returning()
      await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
      await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId: app!.id })
      return { email, applications: [app!] }
    }

    case "five-tiles-one-external-link": {
      const email = "admin-one-tile@e2e.local"
      const [user] = await db.insert(users).values({ email, fullName: "Admin E2E" }).returning()
      const [role] = await db
        .insert(roles)
        .values({ code: ADMIN_ROLE_CODE, name: "Administrator", isSystem: true })
        .returning()

      // Kinds: "native" | "external-link" | "iframe" — APPLICATION_KINDS w
      // @cortex/db/src/schema/system-config.ts jest źródłem prawdy.
      const nativeCodes = ["idp", "intrastat", "cortex-config", SYSTEM_CONFIG_APP_CODE]
      const inserted = await db
        .insert(applications)
        .values([
          ...nativeCodes.map((code, i) => ({
            code,
            name: code,
            kind: "native",
            route: `/${code}`,
            sortOrder: i,
          })),
          {
            code: "openwebui",
            name: "OpenWebUI",
            kind: "external-link",
            url: "https://chat.example.local",
            target: "_blank",
            sortOrder: nativeCodes.length,
          },
        ])
        .returning()

      await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
      await db
        .insert(permissionsMatrix)
        .values(inserted.map((app) => ({ roleId: role!.id, applicationId: app.id })))
      return { email, applications: inserted }
    }
  }
}

export { closeDb } from "@cortex/db"
