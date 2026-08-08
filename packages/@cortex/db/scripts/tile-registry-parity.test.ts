// Strażnik K5 (PROJECT/cortex-frontend/ARTIFACTS/licencjonowanie/
// cortex-frontend-konsolidacja-rejestrow-kafelka-projekt.md, etap 5 +
// ...-implementacja.md "K5 — co ma sprawdzać strażnik"):
//
//   każdy wiersz applications z kind='native'  ->  MUSI mieć manifest
//   każdy wiersz bez manifestu                 ->  MUSI być kind != 'native'
//
// Te dwa zdania to JEDNA reguła i jej kontrapozycja — nie dwa niezależne
// sprawdzenia. Drugie jest zapisem decyzji D3, czyli tego, czego strażnik
// NIE ma prawa wymagać: manifest jest DOWODEM, ŻE KOD ISTNIEJE W TYM REPO,
// więc kafelek `external-link` (dziś `meeting-guru`, zakładany ręcznie z UI
// admina) legalnie go nie ma i musi przejść. Reguła patrzy więc na `kind`,
// nie na listę wyjątków — allowlista kodów byłaby trzecim rejestrem tych
// samych nazw i rosłaby o każdą literówkę, której ma szukać.
//
// CZEGO TO PILNUJE — literówka w `entitlementCode` NIE DAJE BŁĘDU.
// seed-tile-manifests.mjs to `insert ... on conflict (code)`, więc zły kod nie
// trafia w żaden konflikt i po cichu zakłada NOWY wiersz (nieaktywny, bez
// grantów), a prawdziwy kafelek zostaje osierocony i przestaje dostawać
// cokolwiek z manifestu. Build zielony, seed zielony, śmieć w bazie, objaw
// tygodnie później. Ani `tsc`, ani `defineTile()` tego nie widzą — "idp-basik"
// jest w pełni poprawnym kodem uprawnienia.
//
// DLACZEGO TERAZ, PRZED K3: do dziś jedyną ochroną przed tą klasą było
// app/idp/lib/tile-presentation-migration.test.ts (K2), które porównuje
// manifesty ze statyczną listą APPLICATIONS — i ginie razem z nią w K3.
// Ten plik przejmuje ciągłość: celuje w tę samą literówkę, tylko od strony
// SKUTKU (osierocony wiersz), więc nie potrzebuje do tego kopii wartości.
// Zamrożenie oczekiwanych kodów jako fixture byłoby wskrzeszeniem usuwanego
// rejestru pod nazwą "dane testowe" — patrz nagłówek tamtego pliku.
//
// PORÓWNUJEMY Z BARRELEM (app/idp/lib/tile-manifests.ts), NIE Z JSON-em.
// tile-manifests.generated.json obok jest artefaktem buildu: gitignorowany,
// nieobecny na świeżym klonie i — co ważniejsze — to WEJŚCIE seeda, więc
// porównanie bazy z nim dowodziłoby wyłącznie, że seed wykonał to, co dostał.
// Autorytetem w pytaniu "czy ten kod istnieje w repo" jest barrel, bo to on
// jest w gicie i to z niego JSON powstaje. JSON dostaje osobną, tanią asercję
// niżej — nie jako źródło prawdy, tylko jako ogniwo, którego rozjazd z
// barrelem tłumaczy pozostałe porażki (baza zaseedowana z innego zbioru).
//
// Import kodu aplikacji z pakietu jest tu świadomym wyjątkiem: TESTOWYM, bez
// odpowiednika w runtime (żaden `.mjs` obok niczego z app/ nie importuje).
// Rozważone i odrzucone: postawienie tego testu w app/idp, gdzie import byłby
// naturalny. Odrzucone, bo strażnik dotyczy SEEDA — mieszka obok skryptu,
// który go łamie, i obok trzech innych strażników tego samego katalogu
// (scripts-parse, seed-chain-parity, migrations-journal-parity).
//
// GATE NA DATABASE_URL — blok "prawdziwa baza" jest domyślnie POMIJANY, tak
// jak suity integracyjne w @cortex/service:
//   DATABASE_URL=postgres://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/db/scripts/tile-registry-parity.test.ts
// Koszt do świadomego przyjęcia: CI nie uruchamia vitest w ogóle
// (.github/workflows/docker-build.yml buduje obrazy i odpala pytest wyłącznie
// dla usług pythonowych), więc cały ten katalog i tak biegnie tylko lokalnie,
// a blok bazowy dokłada do tego drugi warunek. Dlatego REGUŁA jest wyciągnięta
// do funkcji i sprawdzana osobno, bez bazy — bez DATABASE_URL zostaje dowód,
// że reguła nazywa właściwe wiersze, brakuje wyłącznie obserwacji stanu.
//
// KIEDY BĘDZIE WYĆ NA NIEWINNEGO: L2 z roadmapy licencjonowania (skrypt
// strippujący moduły z obrazu klienta) usuwa manifest ŚWIADOMIE, a wiersz
// aktywowanego wcześniej kafelka zostaje w bazie klienta — czyli dokładnie
// kształt "native bez manifestu". Nie budujemy tego dziś (L1 i L2 są za K5 w
// kolejności), ale odpowiedź jest z góry znana i wynika z akapitu o barrelu:
// dla obrazu okrojonego zbiorem prawdy przestaje być barrel z checkoutu, a
// staje się tile-manifests.generated.json ZBUDOWANY DLA TEGO OBRAZU. Wtedy ten
// strażnik ma biec w obrazie i przeciw temu JSON-owi, a nie tutaj — nie
// dopisywać wyjątków na kody wykluczone, bo to znowu byłaby lista.

import { ALL_TILE_MANIFESTS } from "@/lib/tile-manifests"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { closeDb, getDb } from "../src/client"
import { APPLICATION_KINDS, applications } from "../src/schema/system-config"

const hasDatabase = Boolean(process.env.DATABASE_URL)

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const generatedJson = path.join(scriptsDir, "tile-manifests.generated.json")

const MANIFEST_CODES = new Set(ALL_TILE_MANIFESTS.map((manifest) => manifest.entitlementCode))

/** Wiersz rejestru w zakresie, w jakim widzi go REGUŁA — sam `code` i `kind`.
 *  Reszta kolumn służy wyłącznie do opisania winowajcy w komunikacie. */
interface RegistryRow {
  code: string
  kind: string
}

type RealRow = RegistryRow & { isActive: boolean; route: string | null }

/** Wiersze zakładane przez suity integracyjne (@cortex/service/src/*.integration.test.ts)
 *  — wszystkie `kind='native'`, wszystkie bez manifestu i wszystkie sprzątane
 *  dopiero w `afterAll` swojego pliku. `DATABASE_URL=... pnpm test` (cała suita
 *  przeciw prawdziwej bazie) to tryb w pełni przewidziany — tamte pliki mają
 *  własną izolację "per suita" właśnie po to, żeby biec RÓWNOLEGLE — więc bez
 *  tego filtra ten strażnik meldowałby cudze fixture'y jako świeże sieroty,
 *  losowo, zależnie od tego, który worker akurat trzyma swoje wiersze.
 *  Sprawdzone: wiersz `kafelek-itest-<pid>-<uuid>` wywraca asercję niżej.
 *
 *  Filtr celowo NIE jest listą kodów, tylko konwencją nazewniczą testów
 *  (wspólne `SUFFIX = itest-<pid>-<uuid>` we WSZYSTKICH tych plikach): nie
 *  rośnie razem z rejestrem i nie da się w nim ukryć literówki, bo prawdziwy
 *  kod kafelka musiałby w tym celu nosić w nazwie `itest-`. */
const FIXTURE_CODE = /itest-/

/** Cała reguła tego pliku, w jednym miejscu i BEZ bazy — dzięki temu daje się
 *  sprawdzić w obie strony na danych syntetycznych (blok niżej), a do
 *  prawdziwych wierszy stosuje się ją już bez powtarzania warunku. */
function nativeCodesWithoutManifest(
  rows: readonly RegistryRow[],
  manifestCodes: ReadonlySet<string>,
): string[] {
  return rows
    .filter((row) => row.kind === "native" && !manifestCodes.has(row.code))
    .map((row) => row.code)
    .sort()
}

/** Porażka tego strażnika jest z gatunku nieodtwarzalnych z komunikatu ("22 !=
 *  23" nie prowadzi do niczego), więc komunikat musi nieść i winowajcę, i
 *  powód, dla którego to jest złe. */
function orphanReport(orphans: readonly RealRow[]): string {
  return [
    `Wiersze system_config.applications z kind='native' BEZ manifestu w tym repo (${orphans.length}):`,
    ...orphans.map(
      (row) => `  - ${row.code} (route=${row.route ?? "brak"}, is_active=${row.isActive})`,
    ),
    "",
    "Manifest jest dowodem, że kod kafelka istnieje w tym repo. Wiersz native bez",
    "manifestu jest więc jednym z dwóch:",
    "  (a) OSIEROCONY PRZEZ LITERÓWKĘ w entitlementCode — seed jest",
    "      `insert ... on conflict (code)`, więc poprawiony/zepsuty kod nie trafił w",
    "      konflikt i założył NOWY wiersz obok (nieaktywny, bez grantów), a ten",
    "      tutaj przestał dostawać cokolwiek z manifestu. Szukaj w barrelu kodu",
    "      podobnego do powyższego — dubler zwykle stoi w bazie tuż obok.",
    "  (b) POZOSTAŁOŚĆ po module, którego kod usunięto — wiersz i granty przeżyły",
    "      skasowanie manifestu, bo seed jest addytywny i nigdy niczego nie usuwa.",
    "",
    "Żaden z tych stanów nie daje błędu w buildzie ani w seedzie. Naprawa jest",
    "decyzją człowieka (poprawić entitlementCode albo usunąć wiersz wraz z",
    "grantami), nigdy automatem — kasowanie wierszy z seeda odbierałoby dostęp.",
  ].join("\n")
}

// ---------------------------------------------------------------------------
// REGUŁA — bez bazy, biegnie zawsze.
// ---------------------------------------------------------------------------

describe("reguła rejestru kafelków", () => {
  it("kod native bez manifestu jest nazwany po imieniu — literówka, dla której ten plik powstał", () => {
    // Dokładnie scenariusz z §5 projektu: manifest "idp-basic" dostaje literówkę,
    // seed zakłada obok wiersz "idp-basik", oryginał zostaje osierocony. Reguła
    // ma wskazać OSIEROCONEGO (to on przestał dostawać cokolwiek z manifestu),
    // a nie dublera — ten ma swój manifest i formalnie jest w porządku.
    const rows: RegistryRow[] = [
      { code: "idp-basic", kind: "native" },
      { code: "idp-basik", kind: "native" },
    ]

    expect(nativeCodesWithoutManifest(rows, new Set(["idp", "idp-basik"]))).toEqual(["idp-basic"])
  })

  it("wiersz nienatywny bez manifestu przechodzi — D3, i to dla KAŻDEGO, nie dla znanej listy", () => {
    // `meeting-guru` jest tu przykładem, nie wyjątkiem: obok stoi link zewnętrzny
    // wymyślony na potrzebę tego testu (tak jak admin zakłada go z UI) i wiersz
    // `iframe`, którego jeszcze nie ma nigdzie w produkcie. Gdyby reguła
    // trzymała allowlistę kodów, drugi i trzeci by na niej padły.
    const nonNative = APPLICATION_KINDS.filter((kind) => kind !== "native")
    expect(nonNative).toEqual(["external-link", "iframe"])

    const rows: RegistryRow[] = [
      { code: "meeting-guru", kind: "external-link" },
      { code: "hurtownia-klienta", kind: "external-link" },
      { code: "raporty-w-ramce", kind: "iframe" },
      { code: "idp", kind: "native" },
    ]

    expect(nativeCodesWithoutManifest(rows, new Set(["idp"]))).toEqual([])
  })

  it("manifest bez wiersza NIE jest naruszeniem tej reguły — to osobne pytanie", () => {
    // Świeżo dopisany manifest, którego seed jeszcze nie widział, nie jest
    // defektem rejestru — jest stanem przejściowym. Pilnuje tego osobna asercja
    // w bloku bazowym, i to nie jako naruszenie reguły, tylko jako warunek, bez
    // którego zielony wynik reguły nic nie znaczy.
    expect(nativeCodesWithoutManifest([], new Set(["idp", "system-config"]))).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// ARTEFAKT BUDOWANY — ogniwo między barrelem a bazą.
// ---------------------------------------------------------------------------

describe("tile-manifests.generated.json", () => {
  // Pomijane, gdy pliku nie ma — jest gitignorowany i powstaje dopiero z
  // `pnpm tile-manifests` albo w etapie builder Dockerfile.
  it.skipIf(!existsSync(generatedJson))("niesie te same kody co barrel", () => {
    const generated = JSON.parse(readFileSync(generatedJson, "utf8")) as {
      entitlementCode: string
    }[]

    expect(
      generated.map((manifest) => manifest.entitlementCode).sort(),
      "JSON, który realnie karmi seed-tile-manifests.mjs, rozjechał się z barrelem — " +
        "uruchom `pnpm tile-manifests`. Dopóki się nie zgadza, baza dostała inny zbiór " +
        "kodów niż mówi kod i asercje o osieroconych wierszach dotyczą czegoś innego.",
    ).toEqual([...MANIFEST_CODES].sort())
  })
})

// ---------------------------------------------------------------------------
// PRAWDZIWA BAZA — obserwacja stanu, którego nie widać z kodu.
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabase)("rejestr kafelków w prawdziwej bazie", () => {
  let rows: RealRow[] = []

  beforeAll(async () => {
    const all = await getDb()
      .select({
        code: applications.code,
        kind: applications.kind,
        isActive: applications.isActive,
        route: applications.route,
      })
      .from(applications)

    rows = all.filter((row) => !FIXTURE_CODE.test(row.code))
  })

  afterAll(async () => {
    await closeDb()
  })

  // Bez tej asercji wszystko niżej przechodziłoby triumfalnie na pustej albo
  // niezaseedowanej bazie — a "zero wierszy native" spełnia regułę idealnie.
  it("jest w ogóle co sprawdzać (baza niepusta, barrel niepusty)", () => {
    expect(
      MANIFEST_CODES.size,
      "barrel manifestów jest pusty — reguła nie ma z czym porównywać",
    ).toBeGreaterThan(0)
    expect(
      rows.filter((row) => row.kind === "native").length,
      "W applications nie ma ANI JEDNEGO wiersza kind='native'. Ta baza nie jest " +
        "zaseedowana (migracje bez seedów?) — bez tej asercji zdanie niżej byłoby " +
        "zielone dokładnie dlatego, że nie ma czego naruszyć.",
    ).toBeGreaterThan(0)
  })

  it("żaden wiersz kind='native' nie jest osierocony", () => {
    const orphanCodes = nativeCodesWithoutManifest(rows, MANIFEST_CODES)
    const orphans = rows.filter((row) => orphanCodes.includes(row.code))

    expect(orphanCodes, orphanReport(orphans)).toEqual([])
  })

  // Odwrotny kierunek — NIE jest to druga własność z projektu (tamta jest
  // kontrapozycją pierwszej i mieści się w asercji wyżej), tylko warunek
  // sensowności tamtego zielonego wyniku: dopóki baza nie zna wszystkich
  // kodów z tego checkoutu, "brak osieroconych" jest zdaniem o innym,
  // starszym zbiorze kodów.
  it("każdy manifest ma już swój wiersz — inaczej zdanie wyżej dotyczy starszej bazy", () => {
    const known = new Set(rows.map((row) => row.code))
    const missing = [...MANIFEST_CODES].filter((code) => !known.has(code)).sort()

    expect(
      missing,
      [
        `Kody z manifestów bez wiersza w applications (${missing.length}): ${missing.join(", ")}.`,
        "",
        "Ta baza nie jest zaseedowana z tego checkoutu — najczęściej dlatego, że po",
        "dopisaniu manifestu nikt nie przegenerował JSON-a i nie puścił seeda:",
        "  pnpm tile-manifests && DATABASE_URL=... node packages/@cortex/db/scripts/seed-tile-manifests.mjs",
        "",
        "Dopóki to nie jest prawdą, asercja o osieroconych wierszach wyżej jest",
        "zdaniem o zbiorze kodów sprzed tej zmiany, a nie o obecnym.",
      ].join("\n"),
    ).toEqual([])
  })
})
