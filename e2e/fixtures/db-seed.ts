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
  frameTemplates,
  permissionsMatrix,
  roleApplicationScopes,
  roles,
  templateAssets,
  userRoles,
  users,
  getDb,
  type ApplicationRow,
} from "@cortex/db"
import { execFileSync } from "node:child_process"
import path from "node:path"

const ADMIN_ROLE_CODE = "admin"
const SYSTEM_CONFIG_APP_CODE = "system-config"
const ILUSTROMAT_APP_CODE = "ilustromat"
const OKNA_CZASOWE_APP_CODE = "okna-czasowe"
const MANAGE_TEMPLATES_SCOPE = "manage-templates"
const TOKEN_USAGE_APP_CODE = "token-usage"
const COWORK_APP_CODE = "cortex-cowork"
// Musi się zgadzać z e2e/fixtures/json-store.ts COWORK_STRANGER_EMAIL — ten
// sam e-mail, dwie warstwy: JSON store (governance open-mode) i tu, Postgres
// (grant platformowy, którego od 30.07.2026 wymaga bootstrapTrusts() nawet
// w trybie otwartym — patrz app/idp/lib/cortex-governance/bootstrap-trust.ts).
const COWORK_STRANGER_EMAIL = "obcy@cortex.local"

export type ScenarioName =
  | "empty"
  | "user-no-roles"
  | "admin-with-one-tile"
  | "five-tiles-one-external-link"
  // Rejestr zseedowany PRAWDZIWYM skryptem deployowym + jeden użytkownik na
  // każdy kod, z dokładnie jednym grantem. Podstawa macierzy uprawnień powłoki.
  | "registry-one-user-per-code"
  // Ilustromat: te dwa scenariusze różnią się WYŁĄCZNIE grantem scope'u —
  // po to, żeby dało się pokazać, że dostęp do kafelka nie nadaje prawa do
  // zmiany marki (warstwa granularna, application_scopes).
  | "ilustromat-user"
  | "ilustromat-template-manager"
  // Okna czasowe. Kafelek trzyma dane w plikach JSON, ale od 30.07.2026 jego
  // API stoi za requireTileAccess() na Postgresie, więc E2E ciągnące dane
  // przez route'y musi nieść PRAWDZIWY grant, nie tylko zamockowaną powłokę.
  | "okna-czasowe-user"
  // Raportowanie Tokenow: kafelek admin-only, JEDNA warstwa uprawnien
  // (bez application_scopes) - patrz app/idp/app/api/token-usage/_lib/guard.ts.
  | "token-usage-admin"
  // Cortex Cowork, tryb otwarty: bootstrapTrusts() (naprawa 30.07.2026,
  // zamknięcie otwartego panelu governance) wymaga REALNEGO grantu
  // `cortex-cowork` z Postgresa nawet gdy governance.json jest w trybie
  // otwartym (zero przypisanych ról) — sam mock powłoki już nie wystarcza
  // dla GET /api/cortex-cowork/projects w tym trybie. Grant dla dokładnie
  // e-maila używanego jako "obcy" w scenariuszach JSON (COWORK_STRANGER_EMAIL).
  | "cowork-open-mode-stranger"

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
  // Schemat modułu Ilustromat. Czyszczony razem z system_config, bo scenariusz
  // ma dawać JEDEN deterministyczny stan całej bazy, nie tylko jednego
  // schematu. template_assets ma FK cascade, ale kasujemy jawnie — kolejność
  // czytelna wprost, bez polegania na definicji FK.
  await db.delete(templateAssets)
  await db.delete(frameTemplates)
}

/**
 * Ustawia bazę w jednym z nazwanych, deterministycznych stanów. Wołaj na
 * początku testu (nie w `beforeAll` dzielonym między testami — każdy test
 * dostaje świeży stan):
 *
 *   const { email } = await seedScenario("admin-with-one-tile")
 *   await asUser(page, email)
 *   await page.goto("/system-config/users")
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

    case "registry-one-user-per-code":
      return seedRegistryPerCodeUsers()

    case "ilustromat-user":
      return seedIlustromat({ withManageTemplatesScope: false })

    case "ilustromat-template-manager":
      return seedIlustromat({ withManageTemplatesScope: true })

    case "okna-czasowe-user": {
      const email = "okna-czasowe-user@e2e.local"
      const [user] = await db.insert(users).values({ email, fullName: "Okna czasowe E2E" }).returning()
      const [role] = await db
        .insert(roles)
        .values({ code: "okna-czasowe-e2e", name: "Rola E2E" })
        .returning()
      const [app] = await db
        .insert(applications)
        .values({
          code: OKNA_CZASOWE_APP_CODE,
          name: "Okna czasowe",
          kind: "native",
          route: "/okna-czasowe/dashboard",
        })
        .returning()
      await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
      await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId: app!.id })
      return { email, applications: [app!] }
    }

    case "token-usage-admin": {
      const email = "token-usage-admin@e2e.local"
      const [user] = await db
        .insert(users)
        .values({ email, fullName: "Admin raportu tokenow" })
        .returning()
      const [role] = await db
        .insert(roles)
        .values({ code: ADMIN_ROLE_CODE, name: "Administrator", isSystem: true })
        .returning()
      const [app] = await db
        .insert(applications)
        .values({
          code: TOKEN_USAGE_APP_CODE,
          name: "Raportowanie Tokenow",
          kind: "native",
          route: "/token-usage",
        })
        .returning()
      await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
      await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId: app!.id })
      return { email, applications: [app!] }
    }

    case "cowork-open-mode-stranger": {
      const email = COWORK_STRANGER_EMAIL
      const [user] = await db.insert(users).values({ email, fullName: "Obcy E2E" }).returning()
      const [role] = await db
        .insert(roles)
        .values({ code: "cowork-open-mode-e2e", name: "Rola E2E" })
        .returning()
      const [app] = await db
        .insert(applications)
        .values({
          code: COWORK_APP_CODE,
          name: "Cortex Config",
          kind: "native",
          route: "/cortex-config/projects",
        })
        .returning()
      await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
      await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId: app!.id })
      return { email, applications: [app!] }
    }
  }
}

// Kolejność i zawartość MUSZĄ odpowiadać komendzie usługi `migrate` w
// docker-compose.yml / docker-compose.image.yml — inaczej macierz uprawnień
// niżej dowodzi czegoś o rejestrze, którego na wdrożonym środowisku nie ma.
const SEED_SCRIPTS = [
  "seed-system-config.mjs",
  "seed-ilustromat.mjs",
  "seed-token-usage.mjs",
] as const

// Playwright uruchamia testy z katalogu konfiguracji (korzeń repo). Świadomie
// bez import.meta.url — pliki testowe są transpilowane do CJS, w którym ten
// zapis jest błędem składniowym.
const dbPackageDir = path.resolve(process.cwd(), "packages/@cortex/db")

/**
 * Uruchamia PRAWDZIWE skrypty seedujące — te same, które w deployu odpala
 * usługa `migrate` z docker-compose. Świadomie przez `node`, a nie przez
 * przepisanie ich zawartości do TypeScriptu: gdyby test miał własną kopię
 * rejestru aplikacji, sprawdzałby zgodność kopii z samą sobą, a rozjazd
 * z produkcyjnym seedem przechodziłby niezauważony. To dokładnie ta klasa
 * błędu ("dwie ręcznie utrzymywane listy"), którą ta migracja likwiduje.
 *
 * Wymaga wcześniejszych migracji — schemat musi już istnieć.
 */
export function runRegistrySeed(options: { adminEmail?: string } = {}): void {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("runRegistrySeed: DATABASE_URL nie jest ustawione")

  for (const script of SEED_SCRIPTS) {
    execFileSync("node", [path.join(dbPackageDir, "scripts", script)], {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        // Pusty ADMIN_EMAIL = seed w ogóle nie dotyka bloku administratora.
        ADMIN_EMAIL: options.adminEmail ?? "",
      },
      stdio: "pipe",
    })
  }
}

/** `<kod>@matrix.e2e.local` — użytkownik z grantem WYŁĄCZNIE do tego kodu. */
export function accessMatrixEmail(code: string): string {
  return `${code}@matrix.e2e.local`
}

/**
 * Zseedowany rejestr + po jednym koncie na każdy istniejący kod aplikacji.
 * Konta powstają NA PODSTAWIE ZAWARTOŚCI BAZY po seedzie, nie z listy w tym
 * pliku — dopisanie kodu do produkcyjnego seeda automatycznie rozszerza
 * macierz w testach.
 */
async function seedRegistryPerCodeUsers(): Promise<ScenarioResult> {
  runRegistrySeed()
  const db = getDb()
  const registry = await db.select().from(applications)

  for (const application of registry) {
    const [user] = await db
      .insert(users)
      .values({ email: accessMatrixEmail(application.code), fullName: `Tylko ${application.code}` })
      .returning()
    const [role] = await db
      .insert(roles)
      .values({ code: `matrix-${application.code}`, name: `Tylko ${application.code}` })
      .returning()

    await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
    await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId: application.id })
  }

  // `email` scenariusza to konto BEZ ŻADNYCH grantów — punkt odniesienia dla
  // asercji "odmowa". Konta per kod bierze się z accessMatrixEmail().
  const noGrants = "bez-grantow@matrix.e2e.local"
  await db.insert(users).values({ email: noGrants, fullName: "Bez grantów" })

  return { email: noGrants, applications: registry }
}

/**
 * Kafelek Ilustromat + dwa domyślne szablony marki (te same wartości co
 * _seed_defaults() w PoC). `withManageTemplatesScope` decyduje o warstwie
 * GRANULARNEJ: bez niego user ma dostęp do kafelka, ale nie ma prawa
 * dotknąć szablonów.
 */
async function seedIlustromat(options: {
  withManageTemplatesScope: boolean
}): Promise<ScenarioResult> {
  const db = getDb()
  const email = options.withManageTemplatesScope
    ? "ilustromat-admin@e2e.local"
    : "ilustromat-user@e2e.local"

  const [user] = await db.insert(users).values({ email, fullName: "Ilustromat E2E" }).returning()
  const [role] = await db
    .insert(roles)
    .values({ code: `ilustromat-e2e-${options.withManageTemplatesScope}`, name: "Rola E2E" })
    .returning()
  const [app] = await db
    .insert(applications)
    .values({
      code: ILUSTROMAT_APP_CODE,
      name: "Ilustromat",
      kind: "native",
      route: "/ilustromat/generation",
    })
    .returning()

  await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
  await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId: app!.id })

  const [scope] = await db
    .insert(applicationScopes)
    .values({
      applicationId: app!.id,
      code: MANAGE_TEMPLATES_SCOPE,
      name: "Zarządzanie szablonami marki",
    })
    .returning()

  if (options.withManageTemplatesScope) {
    await db
      .insert(roleApplicationScopes)
      .values({ roleId: role!.id, applicationScopeId: scope!.id })
  }

  await db.insert(frameTemplates).values([
    {
      id: "crido-violet",
      name: "Crido — fioletowa (domyślna)",
      colorBg: "#5B3DA8",
      colorText: "#FFFFFF",
      colorAccent: "#FF8C42",
      fontSource: "library",
      fontLibraryId: "noto-sans",
      websiteText: "crido.pl",
    },
    {
      id: "crido-light",
      name: "Crido — jasna",
      colorBg: "#FFFFFF",
      colorText: "#3D267A",
      colorAccent: "#FF8C42",
      fontSource: "library",
      fontLibraryId: "noto-sans",
      websiteText: "crido.pl",
    },
  ])

  return { email, applications: [app!] }
}

export { closeDb } from "@cortex/db"
