// Seedowanie danych demo dla modułów, które trzymają stan w PLIKACH JSON, a nie
// w Postgresie — Cortex Cowork (`app/idp/lib/cortex-governance/store.ts`) oraz
// Okna czasowe (`app/idp/lib/okna-czasowe/store.ts`). Odpowiednik
// `db-seed.ts` dla tych dwóch modułów: ta sama konwencja NAZWANYCH scenariuszy
// (patrz .claude/skills/code-e2e/SKILL.md, reguła 3), tylko nośnikiem jest
// katalog na dysku zamiast schematu w bazie.
//
// DLACZEGO seed zamiast `page.route`: filtr widoczności projektów per rola
// (`visibleProjectsFor()` w store.ts, wołany przez GET /api/cortex-cowork/projects)
// to DOKŁADNIE ten kod, który testy tego modułu mają udowodnić. Zamockowanie
// odpowiedzi tego endpointu zamieniłoby test w sprawdzanie, czy React renderuje
// tablicę. Mockujemy więc tylko POWŁOKĘ (`mockShellAccess()`), a moduł zostaje
// prawdziwy — dokładnie jak `system-config` robi to na Postgresie.
//
// WYMAGANIE ŚRODOWISKOWE: oba store'y czytają swój katalog danych ze zmiennej
// środowiskowej RAZ, przy ładowaniu modułu (`const DATA_DIR = ...` na poziomie
// pliku), więc `COWORK_DATA_DIR`/`OKNA_CZASOWE_DATA_DIR` muszą być ustawione w
// procesie DEV SERVERA, nie w procesie `playwright test`. Ustawia je
// `playwright.config.ts` (`webServer.env`) na stałe wartości niżej. Przy
// uruchomieniu z `PLAYWRIGHT_BASE_URL` (serwer podniesiony ręcznie) trzeba je
// wyeksportować samemu.
//
// JAK WYGLĄDA POMYŁKA W TYM MIEJSCU (zaobserwowane, nie teoretyczne): seed pisze
// do katalogu e2e, a serwer czyta domyślny `app/idp/.data/**`. Objaw NIE jest
// błędem połączenia, tylko cichym „złym stanem":
//   - Okna czasowe pokazują 0 filmów i EmptyState mimo zaseedowanych danych,
//   - Cortex Cowork wchodzi w tryb bootstrap z domyślnego seedConfig()
//     (adminEmails puste => każdy jest adminem, jeden projekt „Cortex Cowork"),
//     więc czerwienią się testy oczekujące CZEGOŚ, a zielenią te oczekujące
//     BRAKU czegoś — mylące, bo suita wygląda na „częściowo działającą".
// Jeśli widzisz dokładnie ten wzór (9 z 24 testów czerwonych, same asercje
// „ma być widoczne"), sprawdź najpierw te dwie zmienne, a nie treść testów.

import { mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"

/**
 * Katalogi WYŁĄCZNIE dla e2e. Dwa powody, żeby były to katalogi w tmp, a nie
 * `app/idp/.data/e2e-*`:
 *
 * 1. Bezpieczeństwo danych dewelopera — seed czyści katalog w całości
 *    (`rm -rf`), więc nie może celować w to samo miejsce, co lokalny `.data/`
 *    (ta sama ostrożność, co ostrzeżenie o `resetSystemConfig()` w db-seed.ts).
 * 2. Determinizm testów — `app/idp/**` jest pod obserwacją watchera `next dev`.
 *    Kasowanie i odtwarzanie plików JSON w tym drzewie wywoływało przebudowę
 *    dev servera w środku testu: strona wisiała pusta (AppGate renderuje `null`,
 *    dopóki zapytania powłoki są pending) dłużej niż domyślne 5 s asercji, a
 *    testy przewracały się losowo, po ok. jednej trzeciej przebiegów.
 *    Zweryfikowane na żywo: po przeniesieniu do tmp cała suita jest zielona
 *    seria za serią.
 */
const E2E_DATA_ROOT = path.join(tmpdir(), "cortex-frontend-e2e-data")

export const E2E_COWORK_DATA_DIR = path.join(E2E_DATA_ROOT, "cortex-cowork")
export const E2E_OKNA_CZASOWE_DATA_DIR = path.join(E2E_DATA_ROOT, "okna-czasowe")

async function resetDir(dir: string): Promise<void> {
  await rm(dir, { force: true, recursive: true })
  await mkdir(dir, { recursive: true })
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await writeFile(file, JSON.stringify(data, null, 2), "utf8")
}

// --- Cortex Cowork / cortex-config -------------------------------------------

export const COWORK_ADMIN_EMAIL = "admin@cortex.local"
export const COWORK_ANALYST_EMAIL = "analityk@cortex.local"
export const COWORK_MANAGER_EMAIL = "manager@cortex.local"
export const COWORK_STRANGER_EMAIL = "obcy@cortex.local"

export const COWORK_ANALYST_PROJECT = "Projekt Analiza"
export const COWORK_MANAGER_PROJECT = "Projekt Raporty"
export const COWORK_DISABLED_PROJECT = "Projekt Wylaczony"

function project(
  id: string,
  name: string,
  allowedRoleIds: string[],
  enabled = true,
): CoworkProjectConfig {
  return {
    id,
    name,
    description: `Opis projektu ${name}`,
    enabled,
    archetype: "task-chat",
    allowedRoleIds,
    model: { provider: "anthropic", modelId: "claude-sonnet-4-5" },
    composition: {
      skills: { branches: [], leaves: [] },
      connectors: { branches: [], leaves: [] },
      secrets: { branches: [], leaves: [] },
    },
    sandbox: { mode: "local", allowedPaths: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

const PROJECTS: CoworkProjectConfig[] = [
  project("proj-analiza", COWORK_ANALYST_PROJECT, ["analyst"]),
  project("proj-raporty", COWORK_MANAGER_PROJECT, ["manager"]),
  project("proj-wylaczony", COWORK_DISABLED_PROJECT, ["analyst", "manager"], false),
]

/**
 * `"open-mode"` — zero przypisań ról. Wg `isOpenMode()` governance jeszcze nie
 * wystartowało, więc KAŻDY (także nie-admin) widzi każdy WŁĄCZONY projekt.
 * `"roles-assigned"` — pierwsze przypisanie roli włącza governance: analityk
 * widzi tylko swój projekt, manager tylko swój, jawny admin widzi wszystkie
 * włączone, ktoś bez roli nie widzi nic.
 *
 * Oba scenariusze zawierają ten sam WYŁĄCZONY projekt — to jedyny sposób
 * pokazać, że `enabled:false` wycina projekt niezależnie od ról.
 */
export type CoworkScenario = "open-mode" | "roles-assigned"

function coworkConfig(scenario: CoworkScenario): CoworkGovernanceConfig {
  const base: CoworkGovernanceConfig = {
    version: 2,
    departments: ["wspolne"],
    skillSources: [],
    connectors: [],
    roles: [
      { id: "analyst", name: "Analityk" },
      { id: "manager", name: "Manager" },
    ],
    userAssignments: {},
    adminEmails: [],
    projects: PROJECTS,
  }
  if (scenario === "open-mode") return base
  return {
    ...base,
    adminEmails: [COWORK_ADMIN_EMAIL],
    userAssignments: {
      [COWORK_ANALYST_EMAIL]: ["analyst"],
      [COWORK_MANAGER_EMAIL]: ["manager"],
    },
  }
}

export async function seedCowork(scenario: CoworkScenario): Promise<void> {
  await resetDir(E2E_COWORK_DATA_DIR)
  await writeJson(path.join(E2E_COWORK_DATA_DIR, "governance.json"), coworkConfig(scenario))
}

// --- Okna czasowe -------------------------------------------------------------

// Tytuły celowo BEZ wspólnego podciągu: `hasText` w Playwrighcie dopasowuje
// podciąg bez uwzględniania wielkości liter, więc para "Dostepny Film" /
// "Niedostepny Film" trafiała w oba wiersze naraz (strict mode violation).
export const OKNA_AVAILABLE_FILM = "Rakuten Premiera"
export const OKNA_UNAVAILABLE_FILM = "Kino Bez Oferty"

/**
 * `"empty"` — brak plików w ogóle (store zwraca `[]` na ENOENT), czyli stan
 * świeżej instalacji: dashboard ma pokazać EmptyState.
 * `"two-films-one-available"` — dwa filmy i po jednym snapshocie na każdy;
 * jeden dostępny na Rakuten PL, jeden nie. Minimalny stan, w którym KAŻDA
 * kolumna dashboardu i każdy licznik ma nietrywialną wartość.
 */
export type OknaScenario = "empty" | "two-films-one-available"

const SCAN_AT = "2026-07-20T09:30:00.000Z"

export async function seedOknaCzasowe(scenario: OknaScenario): Promise<void> {
  await resetDir(E2E_OKNA_CZASOWE_DATA_DIR)
  if (scenario === "empty") return

  const films = [
    {
      id: "film-dostepny",
      title: OKNA_AVAILABLE_FILM,
      year: 2024,
      foreignTitles: ["Available Film"],
      firstSeenAvailable: "2026-07-18T00:00:00.000Z",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-18T00:00:00.000Z",
    },
    {
      id: "film-niedostepny",
      title: OKNA_UNAVAILABLE_FILM,
      year: 2019,
      foreignTitles: [],
      firstSeenAvailable: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  ]

  const snapshots = [
    {
      id: "snap-1",
      filmId: "film-dostepny",
      scannedAt: SCAN_AT,
      available: true,
      offerType: "RENT",
      price: "9,99 zl",
      matchedTitle: OKNA_AVAILABLE_FILM,
      ambiguous: false,
    },
    {
      id: "snap-2",
      filmId: "film-niedostepny",
      scannedAt: SCAN_AT,
      available: false,
      offerType: null,
      price: null,
      matchedTitle: null,
      ambiguous: false,
    },
  ]

  const log = [
    {
      id: "log-1",
      startedAt: SCAN_AT,
      finishedAt: "2026-07-20T09:31:00.000Z",
      filmsScanned: 2,
      newAvailabilities: 1,
      changesDetected: 1,
      errors: [],
    },
  ]

  await writeJson(path.join(E2E_OKNA_CZASOWE_DATA_DIR, "films.json"), films)
  await writeJson(path.join(E2E_OKNA_CZASOWE_DATA_DIR, "snapshots.json"), snapshots)
  await writeJson(path.join(E2E_OKNA_CZASOWE_DATA_DIR, "log.json"), log)
}
