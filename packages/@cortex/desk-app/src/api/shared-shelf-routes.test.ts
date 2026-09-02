// Każda trasa, która sięga po dysk Biurka, MUSI zapytać bramę wspólnej półki.
//
// DLACZEGO TEN STRAŻNIK ISTNIEJE. Brama była pilnowana w połowie i nikt tego nie widział,
// bo połowa działała wzorowo. `files.ts` filtrował spis po `shared.read` i blokował zmiany
// bez `shared.write` — więc na ekranie wspólnych katalogów po prostu nie było. Ale
// `file.ts` oddawał BAJTY każdemu, kto zna ścieżkę, a `files-upload.ts` przyjmował katalog
// z formularza i pisał na półkę bez pytania. Odebranie zdolności nie odbierało niczego.
//
// Testy jednostkowe tego nie łapały, bo każda z tych tras z osobna robiła to, co miała.
// Brakowało nie sprawdzenia zachowania, tylko sprawdzenia KOMPLETU: bramy nie stawia się
// na trasie, tylko na całej powierzchni. Dlatego ten strażnik czyta katalog tras, a nie
// wywołuje którejkolwiek z nich — nowy plik obok jest dokładnie tym zdarzeniem, którego
// żaden istniejący test nie zobaczy.

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const API = __dirname

/**
 * Sięga po dysk — przez warstwę Biurka ALBO wprost przez system plików.
 *
 * Drugi wariant dopisany po tym, jak weryfikator obszedł tego strażnika sondą, która
 * importowała `node:fs` i składała ścieżkę z `DESK_DATA_DIR` i parametru zapytania.
 * Trasa nie tknęła `desk-storage`, więc strażnik jej nie widział — a czytała pliki tak
 * samo. Brama pilnowana po IMPORCIE jednego modułu jest pilnowana po nazwie, nie po skutku.
 */
const TOUCHES_DISK = /from "@cortex\/desk-core\/desk-storage"|from "node:fs(?:\/promises)?"/

/**
 * Pyta bramę — obojętne, którą z dwóch twarzy tej samej decyzji, ale musi ją WYWOŁAĆ
 * W KODZIE. Dwie poprawki, obie po nieudanych próbach obejścia:
 *
 * 1. Nawias. Bez niego wzorzec łapał sam napis, więc wystarczyło wspomnieć nazwę
 *    gdziekolwiek. Wyszło przy wstrzykiwaniu błędu: podmiana na `mayTouchSharedXX`
 *    zostawiała strażnika zielonym.
 * 2. Zdejmowanie komentarzy. `// TODO: mayTouchShared(may, p, "read")` przechodziło —
 *    czyli notatka „kiedyś to dopiszę" wystarczała za bramę. Znalazł to weryfikator.
 *
 * Zdejmowanie jest zgrubne: nie rozumie napisów ani wyrażeń regularnych, więc `"//"`
 * w napisie utnie resztę wiersza. Dla tras HTTP tego repozytorium to nie ma znaczenia,
 * a każde nieporozumienie idzie w stronę SUROWSZĄ — trasa wygląda wtedy na taką,
 * która bramy nie woła, i strażnik krzyczy zamiast milczeć.
 */
const ASKS_GATE = /(?:mayTouchShared|refuseShared)\s*\(/

const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

/**
 * Trasy, które dysku dotykają, a bramy NIE potrzebują — każda z powodem wpisanym tutaj,
 * a nie domyślnym. Dopisanie się do tej listy ma być decyzją, którą ktoś zobaczy
 * w przeglądzie zmian.
 */
const EXEMPT: Record<string, string> = {
  "case-new.ts":
    "ścieżkę teczki składa serwer z identyfikatora sprawy — katalog nie przychodzi od przeglądarki",
  "case-events.ts":
    "parametr `from` to kursor zdarzeń (liczba), nie ścieżka na dysku",
  "test-reset.ts": "narzędzie testowe, nie trasa produktu",
  "test-saved-file.ts": "narzędzie testowe, nie trasa produktu",
  "test-seed-turn.ts": "narzędzie testowe, nie trasa produktu",
}

const routes = readdirSync(API)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => ({ name: f, source: readFileSync(path.join(API, f), "utf8") }))
  .filter((r) => TOUCHES_DISK.test(r.source))

describe("brama wspólnej półki na całej powierzchni HTTP", () => {
  it("w ogóle znajduje trasy sięgające po dysk", () => {
    // Bez tego cały plik mógłby być zielony dlatego, że nie sprawdził niczego.
    expect(routes.map((r) => r.name).sort()).toContain("file.ts")
    expect(routes.length).toBeGreaterThanOrEqual(4)
  })

  it.each(routes.map((r) => [r.name, r]))("%s pyta bramę albo ma wpisany powód", (_n, route) => {
    const reason = EXEMPT[route.name]
    if (reason) {
      expect(reason.length, `powód zwolnienia ${route.name} jest pusty`).toBeGreaterThan(20)
      return
    }
    expect(
      ASKS_GATE.test(withoutComments(route.source)),
      `${route.name} sięga po dysk Biurka, ale nie pyta o wspólną półkę. ` +
        "Dołóż `mayTouchShared` przy ścieżce od użytkownika albo wpisz powód do EXEMPT.",
    ).toBe(true)
  })

  it("nie zwalnia tras, których już nie ma", () => {
    // Zwolnienie, które przeżyło usunięcie trasy, jest zaproszeniem do pomyłki:
    // nowy plik o tej samej nazwie odziedziczyłby cudzy powód.
    const onDisk = new Set(readdirSync(API))
    for (const name of Object.keys(EXEMPT)) {
      expect(onDisk.has(name), `EXEMPT wymienia ${name}, którego nie ma w katalogu`).toBe(true)
    }
  })
})
