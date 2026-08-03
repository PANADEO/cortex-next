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
  calculations as geoScoreCalculations,
  config as geoScoreConfig,
  frameTemplates,
  generations,
  generationVariants,
  jobs,
  permissionsMatrix,
  roleApplicationScopes,
  roles,
  templateAssets,
  userRoles,
  users,
  getDb,
  type ApplicationRow,
  type Grade,
} from "@cortex/db"
// Jedyny import z @cortex/service w tym pliku — CELOWO wyłącznie DANE
// (literał `GEO_SCORE_CONFIG_DEFAULTS`, zero funkcji/logiki), żeby nie
// zakładać CZWARTEJ ręcznie utrzymywanej kopii tych samych ~90 linii wag/
// benchmarków/list słów (constants.py, seed-geo-score-calculator.mjs,
// service.ts już mają po jednej — komentarz w geo-score-calculator.ts
// wprost nazywa trzecią kopię świadomą; czwarta nie zwiększałaby ryzyka
// dryfu inaczej niż trzecia, ale po co ją w ogóle dopisywać). Import
// rozwiązuje się identycznie jak "@cortex/db" (alias tsconfig "paths" na
// packages/@cortex/service/src/index.ts, ten sam mechanizm), nie przez
// bare node_modules resolution — inaczej niż przestroga o `drizzle-orm`
// w e2e/shell/hub-activation.spec.ts (tamta dotyczy pakietu BEZ aliasu).
import { GEO_SCORE_CONFIG_DEFAULTS } from "@cortex/service"
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
const DOCUMENT_PARSER_APP_CODE = "document-parser"
// Rekord podrzucony pod jawnie innym adresem (code-service SKILL.md
// "Rekordy per-user" pkt 5, wzorem COWORK_STRANGER_EMAIL) — dowodzi izolacji
// historii Parser Dokumentów bez logowania się jako drugi user.
const DOCUMENT_PARSER_FOREIGN_EMAIL = "document-parser-foreign@e2e.local"
const VISUAL_GURU_APP_CODE = "visual-guru"
// Jak wyżej, dla archiwum Visual Guru (§8 design docu, Tor A).
const VISUAL_GURU_FOREIGN_EMAIL = "visual-guru-foreign@e2e.local"
const GEO_SCORE_CALCULATOR_APP_CODE = "geo-score-calculator"
// Jak wyżej, dla historii GEO Score Calculator (design doc §7 pkt 4 —
// historia jest per-user; schema/geo-score-calculator.ts nazywa to wprost
// pierwszym przypadkiem "userEmail jako FILTR WIDOCZNOŚCI", nie tylko
// śladem audytowym).
const GEO_SCORE_CALCULATOR_FOREIGN_EMAIL = "geo-score-calculator-foreign@e2e.local"
// 1x1 przezroczysty PNG — jedyne, co testom Toru A potrzeba jako "obraz
// wynikowy" w bytea; treść bajtów jest bez znaczenia dla żadnej asercji.
const FIXTURE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

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
  // Parser Dokumentów: grant do kafelka + wiersze document_parser.jobs w
  // czterech stanach (queued/processing/done/error) dla właściciela testu,
  // plus jeden wiersz podrzucony pod DOCUMENT_PARSER_FOREIGN_EMAIL — dowód
  // izolacji per-user (Tor A, sekcja 6.3 design docu).
  | "document-parser-with-history"
  // Visual Guru: grant do kafelka + dwie generacje właściciela testu (z i
  // bez obrazu referencyjnego, różna liczba wariantów), plus jeden wiersz
  // podrzucony pod VISUAL_GURU_FOREIGN_EMAIL — dowód izolacji per-user
  // (Tor A, design doc §8).
  | "visual-guru-with-history"
  // GEO Score Calculator, Faza 4 (E2E): grant do kafelka + WSPÓLNY config
  // (singleton, domyślne wartości — GEO_SCORE_CONFIG_DEFAULTS) + pusta
  // historia. Do kalkulatora (analiza przez PRAWDZIWY mikroserwis Python,
  // design doc §6 — jedyny moduł dzisiejszej rundy testowany bez mocka
  // sieci), pustego stanu Historii i Ustawień z defaultami.
  | "geo-score-calculator-user"
  // Jak wyżej + 6 zaseedowanych `calculations` właściciela testu (oceny
  // A/B/B/C/D/F, różne daty — sort/filter/search w CortexDataGrid), plus
  // jeden wiersz podrzucony pod GEO_SCORE_CALCULATOR_FOREIGN_EMAIL — dowód
  // izolacji per-user (code-service SKILL.md "Rekordy per-user" pkt 5,
  // wzorem document-parser-with-history/visual-guru-with-history).
  | "geo-score-calculator-with-history"

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
  // Schemat modułu Parser Dokumentów — ten sam powód co Ilustromat wyżej.
  await db.delete(jobs)
  // Schemat modułu Visual Guru — dzieci (generation_variants) przed rodzicem
  // (generations), kolejność czytelna wprost, bez polegania na FK cascade.
  await db.delete(generationVariants)
  await db.delete(generations)
  // Schemat modułu GEO Score Calculator — dwie niezależne tabele (brak FK
  // między nimi, patrz schema/geo-score-calculator.ts), kasowane osobno tak
  // jak reszta tego bloku.
  await db.delete(geoScoreCalculations)
  await db.delete(geoScoreConfig)
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

    case "document-parser-with-history":
      return seedDocumentParserWithHistory()

    case "visual-guru-with-history":
      return seedVisualGuruWithHistory()

    case "geo-score-calculator-user":
      return seedGeoScoreCalculatorUser()

    case "geo-score-calculator-with-history":
      return seedGeoScoreCalculatorWithHistory()
  }
}

// Kolejność i zawartość MUSZĄ odpowiadać komendzie usługi `migrate` w
// docker-compose.yml / docker-compose.image.yml — inaczej macierz uprawnień
// niżej dowodzi czegoś o rejestrze, którego na wdrożonym środowisku nie ma.
// seed-tile-manifests.mjs PRZED seed-system-config.mjs (patrz komentarz w
// docker-compose.yml) — czyta packages/@cortex/db/scripts/tile-manifests.generated.json,
// wygenerowany przez `node scripts/generate-tile-manifests.mjs`
// (package.json `test:e2e`/`test:e2e:ui` uruchamiają go PRZED `playwright
// test`, bo lokalne e2e nie przechodzą przez etap `builder` Dockerfile, który
// robi to samo w realnym deployu).
const SEED_SCRIPTS = [
  "seed-tile-manifests.mjs",
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

/**
 * Kafelek Parser Dokumentów + historia w czterech stanach dla właściciela
 * testu, plus jeden wiersz podrzucony pod inny e-mail (izolacja per-user,
 * code-service SKILL.md "Rekordy per-user" pkt 5). `backendJobId` na
 * wierszach queued/processing jest celowo `null`/ustawiony analogicznie do
 * tego, co realny POST /jobs zostawia w tych stanach — testy Toru A nie
 * odpytują backendu Pythona (poza zakresem E2E, sekcja 6.3), więc te wiersze
 * nigdy nie przechodzą dalej w tym scenariuszu.
 */
async function seedDocumentParserWithHistory(): Promise<ScenarioResult> {
  const db = getDb()
  const email = "document-parser-user@e2e.local"

  const [user] = await db.insert(users).values({ email, fullName: "Parser Dokumentów E2E" }).returning()
  const [role] = await db
    .insert(roles)
    .values({ code: "document-parser-e2e", name: "Rola E2E" })
    .returning()
  const [app] = await db
    .insert(applications)
    .values({
      code: DOCUMENT_PARSER_APP_CODE,
      name: "Parser Dokumentów",
      kind: "native",
      route: "/document-parser/upload",
    })
    .returning()

  await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
  await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId: app!.id })

  await db.insert(jobs).values([
    {
      id: "job-done-1",
      backendJobId: "backend-done-1",
      userEmail: email,
      status: "done",
      fileName: "raport-kwartalny.pdf",
      fileSizeBytes: 245_000,
      mimeType: "application/pdf",
      model: "openai/gpt-4o-mini",
      markdown: "# Raport kwartalny\n\nTreść wyekstrahowana z dokumentu testowego E2E.",
      pageCount: 3,
      imageCount: 3,
      truncated: false,
      elapsedSeconds: 4.2,
      completedAt: new Date(),
    },
    {
      id: "job-error-1",
      backendJobId: "backend-error-1",
      userEmail: email,
      status: "error",
      fileName: "umowa-uszkodzona.docx",
      fileSizeBytes: 51_200,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      errorMessage: "unoconvert failed (exit 1): file is corrupted",
      errorCode: "conversion-failed",
      completedAt: new Date(),
    },
    {
      id: "job-processing-1",
      backendJobId: "backend-processing-1",
      userEmail: email,
      status: "processing",
      fileName: "prezentacja.pptx",
      fileSizeBytes: 1_200_000,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      startedAt: new Date(),
    },
    {
      id: "job-queued-1",
      userEmail: email,
      status: "queued",
      fileName: "notatka.txt",
      fileSizeBytes: 512,
      mimeType: "text/plain",
    },
    // Podrzucony rekord CUDZY — test dowodzi, że nigdy nie wychodzi na
    // liście/w szczegółach właściciela testu.
    {
      id: "job-foreign-1",
      userEmail: DOCUMENT_PARSER_FOREIGN_EMAIL,
      status: "done",
      fileName: "cudzy-dokument.pdf",
      fileSizeBytes: 1_000,
      mimeType: "application/pdf",
      markdown: "# Cudza treść",
      pageCount: 1,
      imageCount: 1,
      completedAt: new Date(),
    },
  ])

  return { email, applications: [app!] }
}

/**
 * Kafelek Visual Guru + archiwum dla właściciela testu: jedna generacja BEZ
 * obrazu referencyjnego (4 warianty), jedna Z obrazem referencyjnym (2
 * warianty, `referenceImageFileName` ustawione — D5: tylko ślad, nigdy
 * bajty), plus jeden wiersz podrzucony pod VISUAL_GURU_FOREIGN_EMAIL — dowód
 * izolacji per-user bez logowania się jako drugi user (code-service
 * SKILL.md "Rekordy per-user" pkt 5).
 */
async function seedVisualGuruWithHistory(): Promise<ScenarioResult> {
  const db = getDb()
  const email = "visual-guru-user@e2e.local"
  const image = Buffer.from(FIXTURE_PNG_BASE64, "base64")

  const [user] = await db.insert(users).values({ email, fullName: "Visual Guru E2E" }).returning()
  const [role] = await db.insert(roles).values({ code: "visual-guru-e2e", name: "Rola E2E" }).returning()
  const [app] = await db
    .insert(applications)
    .values({ code: VISUAL_GURU_APP_CODE, name: "Visual Guru", kind: "native", route: "/visual-guru" })
    .returning()

  await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
  await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId: app!.id })

  const [noReference] = await db
    .insert(generations)
    .values({
      id: "11111111-1111-1111-1111-111111111111",
      userEmail: email,
      prompt: "Minimalistyczna ilustracja lisa na tle gór",
      additionalContext: "Płaski styl wektorowy, ciepła paleta",
      hadReferenceImage: false,
      referenceImageFileName: null,
      model: "google/gemini-3.1-flash-lite-image",
      variantCount: 4,
    })
    .returning()
  await db.insert(generationVariants).values(
    Array.from({ length: 4 }, (_, variantIndex) => ({
      generationId: noReference!.id,
      variantIndex,
      image,
      contentType: "image/png",
    })),
  )

  const [withReference] = await db
    .insert(generations)
    .values({
      id: "22222222-2222-2222-2222-222222222222",
      userEmail: email,
      prompt: "Baner produktowy w stylu logo firmy",
      additionalContext: null,
      hadReferenceImage: true,
      referenceImageFileName: "logo-firmy.png",
      model: "google/gemini-3.1-flash-lite-image",
      variantCount: 2,
    })
    .returning()
  await db.insert(generationVariants).values(
    Array.from({ length: 2 }, (_, variantIndex) => ({
      generationId: withReference!.id,
      variantIndex,
      image,
      contentType: "image/png",
    })),
  )

  // Podrzucony rekord CUDZY — test dowodzi, że nigdy nie wychodzi na
  // liście/w szczegółach właściciela testu.
  const [foreign] = await db
    .insert(generations)
    .values({
      id: "33333333-3333-3333-3333-333333333333",
      userEmail: VISUAL_GURU_FOREIGN_EMAIL,
      prompt: "Cudzy prompt niewidoczny dla właściciela testu",
      hadReferenceImage: false,
      referenceImageFileName: null,
      model: "google/gemini-3.1-flash-lite-image",
      variantCount: 1,
    })
    .returning()
  await db.insert(generationVariants).values({
    generationId: foreign!.id,
    variantIndex: 0,
    image,
    contentType: "image/png",
  })

  return { email, applications: [app!] }
}

/** Insertuje jedyny, WSPÓLNY (singleton, `id: true`) wiersz konfiguracji —
 *  identyczne wartości co `GEO_SCORE_CONFIG_DEFAULTS`/seed-geo-score-
 *  calculator.mjs, żeby Kalkulator (POST /analyze) i Ustawienia mają
 *  spójny, znany-z-góry punkt startowy w każdym scenariuszu tego modułu. */
async function insertDefaultGeoScoreConfig(): Promise<void> {
  await getDb()
    .insert(geoScoreConfig)
    .values({ id: true, updatedBy: "e2e-seed@cortex.local", ...GEO_SCORE_CONFIG_DEFAULTS })
}

interface GeoScoreHistoryFixtureSpec {
  id: string
  userEmail: string
  /** Słowo unikalne w całym scenariuszu — cel wyszukiwania w
   *  `history-scenario.spec.ts` (searchable CortexDataGrid szuka w tekście). */
  companyLabel: string
  totalScore: number
  grade: Grade
  createdAt: Date
}

/** Buduje wiersz `calculations` z wewnętrznie spójnym `result` (kontrakt
 *  POST /analyze) — jeden zaokrąglony procent w tekście jako jedyny
 *  "znaleziony" przykład statystyki, z `position` policzonym przez
 *  `indexOf()` zamiast twardo wpisaną liczbą (ten sam powód co highlight.ts:
 *  offset musi realnie wskazywać na `statValue` w `textContent`, inaczej
 *  ekran szczegółów (§4.3, podświetlanie) dostałby niespójne dane). */
function buildGeoScoreHistoryRow(spec: GeoScoreHistoryFixtureSpec): typeof geoScoreCalculations.$inferInsert {
  const statValue = `${Math.round(spec.totalScore)}%`
  const text = `${spec.companyLabel} zwiększyła przychody o ${statValue} w tym kwartale dzięki wdrożeniu nowego systemu raportowania.`
  const statPosition = text.indexOf(statValue)
  const wordCount = text.trim().split(/\s+/).length

  const result = {
    totalScore: spec.totalScore,
    grade: spec.grade,
    wordCount,
    statistics: {
      score: spec.totalScore,
      count: 1,
      per100Words: Number(((1 / wordCount) * 100).toFixed(2)),
      examples: [{ value: statValue, position: statPosition }],
    },
    actionVerbs: {
      score: spec.totalScore,
      actionVerbCount: 1,
      totalVerbCount: 2,
      ratio: 0.5,
      foundVerbs: ["zwiększyła"],
      method: "spacy" as const,
    },
    structure: { score: spec.totalScore, bulletCount: 0, per500Words: 0, hasHeaders: false, paragraphCount: 1 },
    objectivity: { score: spec.totalScore, subjectiveCount: 0, subjectiveRatio: 0, foundWords: [] },
    recommendations: ["Dodaj bullet points lub listę numerowaną z kluczowymi informacjami"],
  }

  return {
    id: spec.id,
    userEmail: spec.userEmail,
    textContent: text,
    textPreview: text,
    wordCount,
    totalScore: spec.totalScore,
    grade: spec.grade,
    statsScore: spec.totalScore,
    verbsScore: spec.totalScore,
    structureScore: spec.totalScore,
    objectivityScore: spec.totalScore,
    result,
    configSnapshot: { id: true, updatedBy: "e2e-seed@cortex.local", ...GEO_SCORE_CONFIG_DEFAULTS },
    createdAt: spec.createdAt,
  }
}

/** Kafelek GEO Score Calculator, pusta historia + WSPÓLNY config z
 *  defaultami — Kalkulator (analiza przez PRAWDZIWY mikroserwis Python,
 *  design doc §6), pusty stan Historii, Ustawienia z defaultami. */
async function seedGeoScoreCalculatorUser(): Promise<ScenarioResult> {
  const db = getDb()
  const email = "geo-score-calculator-user@e2e.local"

  const [user] = await db.insert(users).values({ email, fullName: "GEO Score Calculator E2E" }).returning()
  const [role] = await db
    .insert(roles)
    .values({ code: "geo-score-calculator-e2e", name: "Rola E2E" })
    .returning()
  const [app] = await db
    .insert(applications)
    .values({
      code: GEO_SCORE_CALCULATOR_APP_CODE,
      name: "Kalkulator GEO Score",
      kind: "native",
      route: "/geo-score-calculator",
    })
    .returning()

  await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
  await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId: app!.id })
  await insertDefaultGeoScoreConfig()

  return { email, applications: [app!] }
}

/** Jak `seedGeoScoreCalculatorUser()`, plus 6 zaseedowanych analiz
 *  właściciela testu (oceny A/B/B/C/D/F, malejące daty dla sensownego
 *  sortu po kolumnie "Data") i jeden wiersz podrzucony pod
 *  GEO_SCORE_CALCULATOR_FOREIGN_EMAIL — dowód izolacji per-user bez
 *  logowania się jako drugi user (code-service SKILL.md "Rekordy
 *  per-user" pkt 5). */
async function seedGeoScoreCalculatorWithHistory(): Promise<ScenarioResult> {
  const db = getDb()
  const email = "geo-score-calculator-history-user@e2e.local"
  const dayMs = 24 * 60 * 60 * 1000
  const now = Date.now()

  const [user] = await db.insert(users).values({ email, fullName: "GEO Score Calculator E2E" }).returning()
  const [role] = await db
    .insert(roles)
    .values({ code: "geo-score-calculator-history-e2e", name: "Rola E2E" })
    .returning()
  const [app] = await db
    .insert(applications)
    .values({
      code: GEO_SCORE_CALCULATOR_APP_CODE,
      name: "Kalkulator GEO Score",
      kind: "native",
      route: "/geo-score-calculator",
    })
    .returning()

  await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
  await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId: app!.id })
  await insertDefaultGeoScoreConfig()

  // `createdAt` NIE koreluje monotonicznie z `totalScore` (przetasowane
  // przesunięcia dni) — CELOWO, żeby test sortowania po kolumnie "Wynik"
  // (history-scenario.spec.ts) odróżniał efekt sortu od domyślnej kolejności
  // (`desc(createdAt)`, listMyCalculations()). Ta sama korelacja
  // przypadkiem pokrywałaby się z sortem po wyniku, gdyby daty rosły/malały
  // razem z oceną, i test niczego by nie dowodził.
  await db.insert(geoScoreCalculations).values([
    buildGeoScoreHistoryRow({
      id: "a0000000-0000-0000-0000-000000000001",
      userEmail: email,
      companyLabel: "Vistulon",
      totalScore: 94.5,
      grade: "A",
      createdAt: new Date(now - 2 * dayMs),
    }),
    buildGeoScoreHistoryRow({
      id: "a0000000-0000-0000-0000-000000000002",
      userEmail: email,
      companyLabel: "Nordbrama",
      totalScore: 82.0,
      grade: "B",
      createdAt: new Date(now - 5 * dayMs),
    }),
    buildGeoScoreHistoryRow({
      id: "a0000000-0000-0000-0000-000000000003",
      userEmail: email,
      companyLabel: "Baltexon",
      totalScore: 76.5,
      grade: "B",
      createdAt: new Date(now),
    }),
    buildGeoScoreHistoryRow({
      id: "a0000000-0000-0000-0000-000000000004",
      userEmail: email,
      companyLabel: "Ceratech",
      totalScore: 63.0,
      grade: "C",
      createdAt: new Date(now - 4 * dayMs),
    }),
    buildGeoScoreHistoryRow({
      id: "a0000000-0000-0000-0000-000000000005",
      userEmail: email,
      companyLabel: "Wiklinex",
      totalScore: 47.5,
      grade: "D",
      createdAt: new Date(now - 1 * dayMs),
    }),
    buildGeoScoreHistoryRow({
      id: "a0000000-0000-0000-0000-000000000006",
      userEmail: email,
      companyLabel: "Rekineza",
      totalScore: 21.0,
      grade: "F",
      createdAt: new Date(now - 3 * dayMs),
    }),
    // Podrzucony rekord CUDZY — test dowodzi, że nigdy nie wychodzi na
    // liście/w szczegółach właściciela testu.
    buildGeoScoreHistoryRow({
      id: "a0000000-0000-0000-0000-000000000007",
      userEmail: GEO_SCORE_CALCULATOR_FOREIGN_EMAIL,
      companyLabel: "Cudzyfirm",
      totalScore: 55.0,
      grade: "D",
      createdAt: new Date(now),
    }),
  ])

  return { email, applications: [app!] }
}

export { closeDb } from "@cortex/db"
