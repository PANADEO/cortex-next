// Strażnik parzystości `sort_order` — dwie liczby, każda żyjąca w dwóch
// miejscach naraz.
//
// KROK (10). @cortex/service dokłada go do maksimum, wyliczając pozycję nowego
// wiersza (nextSortOrder); app/idp/app/(main)/system-config/applications/
// page.tsx przenumerowuje nim CAŁĄ listę w trybie "Zmień kolejność"
// (`(index + 1) * SORT_ORDER_STEP`). Stała jest zduplikowana ŚWIADOMIE —
// tamten plik jest komponentem klienckim, więc import z @cortex/service
// wciągnąłby drizzle i sterownik bazy do bundla — a wiąże je dziś wyłącznie
// komentarz. Rozjazd niczego nie wywala: wiersz założony ręcznie i lista po
// przenumerowaniu przestają po prostu leżeć na tej samej PODZIAŁCE, cicho i
// bez błędu.
//
// Uściślenie, żeby ten plik nie obiecywał więcej, niż pilnuje: chodzi o tę
// samą podziałkę, NIE o jeden ciągły przedział. Po przenumerowaniu widoczna
// lista siedzi np. na 10..60, a kolejne utworzenie i tak dostanie 230, bo
// maksimum liczone jest po CAŁEJ tabeli — także po zarejestrowanych, jeszcze
// nieaktywowanych kandydatach, których panel nie pokazuje. To poprawna
// konsekwencja wyboru globalnego maksimum (patrz nextSortOrder), nie rozjazd.
//
// SUFIT (10000). applicationFieldsSchema (@cortex/service) i TileManifestSchema
// (@cortex/tile-sdk) to DWIE ścieżki zapisu do tej samej kolumny. Gdyby
// manifest wolno było postawić wyżej, niż przyjmuje panel, pierwszy ręcznie
// założony wiersz dostałby `max + 10` ponad kontrakt zapisu — i wracał 400 przy
// każdej edycji, która sama nie niesie `sortOrder` (patrz komentarz przy
// MAX_SORT_ORDER).
//
// Dlaczego test, a nie lint/tsc: ani jedno, ani drugie nie widzi, że dwie
// liczby w dwóch pakietach mają znaczyć to samo. Ten sam wzorzec i ten sam
// powód co seed-chain-parity.test.ts, migrations-journal-parity.test.ts i
// module-licensing.parity.test.mjs.
//
// Strona @cortex/service czytana ZACHOWANIEM (nextSortOrder), nie regexem po
// źródle: obie stałe są prywatne dla modułu i mają takie zostać, a wiąże te
// pliki wynik funkcji, nie tekst deklaracji.

import { TileManifestSchema } from "@cortex/tile-sdk"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { nextSortOrder } from "./system-config"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const APPLICATIONS_PAGE = "app/idp/app/(main)/system-config/applications/page.tsx"

/** Krok serwisu: o ile ląduje wyżej wiersz dokładany za wierszem na pozycji 0. */
const SERVICE_STEP = nextSortOrder(0)

/** Sufit serwisu: wartość, na której nextSortOrder saturuje. */
const SERVICE_MAX = nextSortOrder(Number.MAX_SAFE_INTEGER)

function pageSortOrderStep(): number {
  const source = readFileSync(path.join(repoRoot, APPLICATIONS_PAGE), "utf8")
  const match = source.match(/^const SORT_ORDER_STEP = (\d+)$/m)
  // Zniknięcie/przemianowanie stałej ma paść tutaj, a nie po cichu zwolnić
  // strażnika z pilnowania czegokolwiek.
  if (!match) {
    throw new Error(
      `Nie znalazłem deklaracji "const SORT_ORDER_STEP = <liczba>" w ${APPLICATIONS_PAGE}. ` +
        "Jeśli tryb zmiany kolejności przestał jej używać, ten strażnik trzeba przepisać albo usunąć — nie zostawiać ślepego.",
    )
  }
  return Number(match[1])
}

/** Najwęższy manifest, jaki przechodzi walidację — bada wyłącznie granicę
 *  `sortOrder`, reszta pól jest wypełniaczem. */
function manifestWithSortOrder(sortOrder: number) {
  return TileManifestSchema.safeParse({
    id: "sonda-parzystosci",
    kind: "native",
    label: "Sonda parzystości",
    entitlementCode: "sonda-parzystosci",
    route: "/sonda-parzystosci",
    sortOrder,
  })
}

describe("parzystość sort_order — serwis, panel, manifest", () => {
  it("krok przenumerowania w panelu = krok, którym serwis dokłada nowy wiersz", () => {
    expect(pageSortOrderStep()).toBe(SERVICE_STEP)
  })

  it("sufit sortOrder w manifeście = sufit kontraktu zapisu panelu", () => {
    expect(manifestWithSortOrder(SERVICE_MAX).success).toBe(true)
    expect(manifestWithSortOrder(SERVICE_MAX + 1).success).toBe(false)
  })
})
