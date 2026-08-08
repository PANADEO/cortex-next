// Strażnik K2 (PROJECT/cortex-frontend/ARTIFACTS/licencjonowanie/
// cortex-frontend-konsolidacja-rejestrow-kafelka-projekt.md §5, "Gdzie leży
// ryzyko"): przeniesienie wartości prezentacyjnych ze statycznej listy
// APPLICATIONS do manifestów ma zmienić WYŁĄCZNIE źródło tych wartości, nigdy
// samą wartość.
//
// Co dokładnie ten test broni — i czemu nie broni tego nic innego. Kod
// z literówką w `entitlementCode` NIE DAJE BŁĘDU: seed to
// `insert ... on conflict (code)`, więc zły kod nie trafia w żaden konflikt
// i po cichu zakłada NOWY wiersz (nieaktywny, bez grantów), a prawdziwy
// kafelek zostaje osierocony i przestaje dostawać cokolwiek z manifestu.
// Build zielony, seed zielony, śmieć w bazie. Ani `tsc`, ani `defineTile()`
// tego nie widzą — "idp-basik" jest w pełni poprawnym kodem uprawnienia.
//
// Dlatego porównanie jest robione MECHANICZNIE po obu stronach: lista
// APPLICATIONS jest wycinana ze źródła seed-system-config.mjs i wykonywana
// jako literał, a nie przepisywana tutaj ręcznie. Ręczna kopia oczekiwań
// byłaby trzecim rejestrem tych samych wartości i mogłaby zawierać dokładnie
// tę literówkę, której ma szukać.
//
// `sortOrder` po stronie listy jest POZYCYJNY (`index * 10` w pętli seeda),
// nie polem wpisu — liczony tu z indeksu w PEŁNEJ liście, razem z
// `meeting-guru`, bo tamten wpis też przesuwa numerację wszystkim po sobie.
//
// ŻYWOTNOŚĆ: ten plik ginie razem z listą w K3. Zamrożenie oczekiwań jako
// fixture przeżywającego usunięcie APPLICATIONS byłoby wskrzeszeniem tego
// samego rejestru pod nazwą "dane testowe" — drugiej ręcznie utrzymywanej
// kopii wartości, którą trzeba by edytować przy każdej legalnej zmianie
// domyślnego opisu czy kategorii, a która po zniknięciu punktu odniesienia
// nie potwierdza już niczego poza tym, że manifest zawiera to, co zawiera.
// Ciągłość ochrony przejmuje strażnik K5 (kod `kind='native'` w bazie MUSI
// mieć manifest), który celuje w tę samą literówkę, tylko od strony skutku,
// i nie wymaga do tego kopii wartości.

import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { runInNewContext } from "node:vm"
import { describe, expect, it } from "vitest"
import { ALL_TILE_MANIFESTS } from "./tile-manifests"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const seedSource = readFileSync(
  path.join(repoRoot, "packages/@cortex/db/scripts/seed-system-config.mjs"),
  "utf8",
)

type ApplicationEntry = {
  code: string
  description?: string
  icon?: string
  color?: string
  categoryFunctional?: string
  categoryDepartment?: string[]
  showOnHub?: boolean
}

/** Sześć pól, których dotyczy K2 — dokładnie te, które manifest dostał w K1. */
type Presentation = {
  description: string | null
  icon: string | null
  color: string | null
  categoryFunctional: string | null
  categoryDepartment: string[] | null
  sortOrder: number
}

/** Literał tablicy wycięty ze źródła i wykonany. Zakotwiczony na `\n]`, czyli
 *  na nawiasie w pierwszej kolumnie — jedyne takie miejsce w tym pliku to
 *  koniec listy (tablice wartości, np. `["operations"]`, są zawsze w linii). */
const literal = seedSource.match(/const APPLICATIONS = (\[[\s\S]*?\n\])\n/)?.[1] ?? ""
const APPLICATIONS: ApplicationEntry[] = literal ? runInNewContext(literal) : []

/** Jedyny kod listy bez manifestu (D3: `external-link` nie ma kodu w tym
 *  repo, więc manifest byłby dowodem czegoś, czego nie ma). Wypisany wprost,
 *  nie wyliczony — inaczej literówka w `entitlementCode` po prostu
 *  powiększałaby ten zbiór i test dalej byłby zielony. */
const CODES_WITHOUT_MANIFEST = ["meeting-guru"]

/** Kody, które mają manifest i NIGDY nie były na liście — działały
 *  manifest-only jeszcze przed tym projektem. Ich wartości prezentacyjne nie
 *  pochodzą z APPLICATIONS (nie ma z czego), tylko z żywej bazy, więc są poza
 *  zakresem porównania niżej. Też wypisane wprost i z tego samego powodu:
 *  literówka w manifeście objawia się właśnie jako nowy kod "manifest-only". */
const MANIFEST_ONLY_CODES = [
  "document-parser",
  "geo-score-calculator",
  "ilustromat",
  "token-usage",
  "visual-guru",
]

const fromApplications = new Map<string, Presentation>(
  APPLICATIONS.map((application, index) => [
    application.code,
    {
      description: application.description ?? null,
      icon: application.icon ?? null,
      color: application.color ?? null,
      categoryFunctional: application.categoryFunctional ?? null,
      categoryDepartment: application.categoryDepartment ?? null,
      // Pozycyjny, dokładnie jak w pętli seeda: `${index * 10}`.
      sortOrder: index * 10,
    },
  ]),
)

const fromManifests = new Map<string, Presentation>(
  ALL_TILE_MANIFESTS.map((manifest) => [
    manifest.entitlementCode,
    {
      description: manifest.description ?? null,
      icon: manifest.icon ?? null,
      color: manifest.color ?? null,
      categoryFunctional: manifest.categoryFunctional ?? null,
      categoryDepartment: manifest.categoryDepartment ? [...manifest.categoryDepartment] : null,
      // Kolumna jest NOT NULL DEFAULT 0, a seed wstawia `sortOrder ?? 0` —
      // pominięcie pola i jawne zero dają tę samą wartość w bazie.
      sortOrder: manifest.sortOrder ?? 0,
    },
  ]),
)

const SHARED_CODES = [...fromApplications.keys()].filter((code) => fromManifests.has(code))

describe("K2 — manifesty niosą DOKŁADNIE te wartości, które daje dziś APPLICATIONS", () => {
  // Bez tych trzech asercji cała reszta przechodziłaby triumfalnie na pustym
  // zbiorze: gdyby regex przestał pasować (przeformatowana lista, zmieniona
  // nazwa stałej), `SHARED_CODES` byłoby puste, a `it.each([])` nie
  // uruchamia ani jednego przypadku.
  it("literał APPLICATIONS w ogóle się wyciął i wykonał", () => {
    expect(literal).not.toBe("")
    expect(APPLICATIONS.length).toBeGreaterThan(20)
    for (const application of APPLICATIONS) {
      expect(typeof application.code).toBe("string")
    }
  })

  it("barrel manifestów jest niepusty i porównanie obejmuje 22 kody", () => {
    expect(ALL_TILE_MANIFESTS.length).toBeGreaterThan(0)
    expect(SHARED_CODES.length).toBe(APPLICATIONS.length - CODES_WITHOUT_MANIFEST.length)
  })

  // TO jest asercja łapiąca literówkę w `entitlementCode` — i to od obu
  // stron naraz. "idp-basik" w manifeście znika z pierwszego zbioru
  // (osierocony "idp-basic" na liście bez manifestu) i pojawia się w drugim
  // (nowy, nieznany kod manifest-only), więc oba porównania nazywają go
  // wprost, zamiast cicho pominąć w `it.each`.
  it("zbiory bez odpowiednika po drugiej stronie są DOKŁADNIE te dwa znane", () => {
    const listedWithoutManifest = [...fromApplications.keys()].filter(
      (code) => !fromManifests.has(code),
    )
    const manifestedWithoutListing = [...fromManifests.keys()].filter(
      (code) => !fromApplications.has(code),
    )

    expect(listedWithoutManifest.sort()).toEqual([...CODES_WITHOUT_MANIFEST].sort())
    expect(manifestedWithoutListing.sort()).toEqual([...MANIFEST_ONLY_CODES].sort())
  })

  it.each(SHARED_CODES)("%s — sześć pól prezentacyjnych zgadza się co do znaku", (code) => {
    expect(fromManifests.get(code)).toEqual(fromApplications.get(code))
  })

  // `show_on_hub` nie jest jednym z sześciu przenoszonych pól, ale jedzie tym
  // samym INSERT-em i ma dziś dwa źródła (K1b): `showOnHub: false` na liście
  // i `entitlementOnly: true` w manifeście. Rozjazd wystawiłby na hub kartę
  // prowadzącą do ekranu, który kafelkiem nie jest — albo ukryłby prawdziwy
  // kafelek. Osobno od tile-manifests.test.ts: tamten pilnuje, że pole niosą
  // cztery ZNANE kody, ten — że to te same cztery, które lista trzyma poza
  // hubem, czyli że K2 nie ruszyło tej równowagi przy okazji.
  it("showOnHub: false z listy pokrywa się z entitlementOnly z manifestu", () => {
    const hiddenByList = APPLICATIONS.filter(
      (application) => application.showOnHub === false && fromManifests.has(application.code),
    ).map((application) => application.code)
    const entitlementOnly = ALL_TILE_MANIFESTS.filter(
      (manifest) => manifest.entitlementOnly === true,
    ).map((manifest) => manifest.entitlementCode)

    expect(hiddenByList.length).toBeGreaterThan(0)
    expect([...hiddenByList].sort()).toEqual([...entitlementOnly].sort())
  })
})
