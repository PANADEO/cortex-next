// Każda trasa, która sięga po dysk Biurka, MUSI zapytać bramę wspólnej półki — i musi
// zapytać jej ROZSTRZYGAJĄCO, a nie tylko wymówić jej nazwę.
//
// DLACZEGO TEN STRAŻNIK ISTNIEJE. Brama była pilnowana w połowie i nikt tego nie widział,
// bo połowa działała wzorowo. `files.ts` filtrował spis po `shared.read` i blokował zmiany
// bez `shared.write` — więc na ekranie wspólnych katalogów po prostu nie było. Ale
// `file.ts` oddawał BAJTY każdemu, kto zna ścieżkę, a `files-upload.ts` przyjmował katalog
// z formularza i pisał na półkę bez pytania. Odebranie zdolności nie odbierało niczego.
//
// DLACZEGO DRZEWO SKŁADNIOWE, A NIE WYRAŻENIE REGULARNE. Pierwsza wersja szukała napisów
// i została obeszła PIĘCIOMA sposobami, każdy zwykłym, niewinnym TypeScriptem:
//
//   from "fs"                           — bez przedrostka `node:`
//   from 'node:fs'                      — apostrofy zamiast cudzysłowów
//   await import("node:fs/promises")     — import dynamiczny
//   mayTouchShared(…); return read(…)    — brama WYWOŁANA, wynik WYRZUCONY
//   const N = "mayTouchShared(…)"        — nazwa bramy w napisie
//
// Trzy pierwsze to sama pisownia; wzorzec dałoby się łatać w nieskończoność. Czwarty jest
// inny i to on przesądził o przepisaniu: strażnik sprawdzał, czy brama została WYMÓWIONA,
// nie czy ROZSTRZYGA. Tego wyrażenie regularne nie odróżni, bo różnica siedzi w składni,
// nie w tekście. Parser TypeScriptu widzi jedno i drugie: import w każdej postaci
// i wywołanie, którego wynik naprawdę steruje przebiegiem.
//
// GRANICA, ŚWIADOMA: skanujemy `.ts` wprost w tym katalogu, bez podkatalogów. Dziś tras
// w podkatalogach nie ma — a osobny test niżej pilnuje, żeby ta granica nie stała się
// cicho dziurą w dniu, w którym ktoś taki katalog założy.

import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const API = __dirname

/** Moduły, przez które da się dotknąć dysku — po NAZWIE MODUŁU, nie po pisowni importu. */
const DISK_MODULES = new Set([
  "@cortex/desk-core/desk-storage",
  "node:fs",
  "node:fs/promises",
  "fs",
  "fs/promises",
])

const GATES = new Set(["mayTouchShared", "refuseShared"])

/**
 * Trasy, które dysku dotykają, a bramy NIE potrzebują — każda z powodem wpisanym tutaj,
 * a nie domyślnym. Dopisanie się do tej listy ma być decyzją, którą ktoś zobaczy
 * w przeglądzie zmian.
 */
const EXEMPT: Record<string, string> = {
  "case-new.ts":
    "ścieżkę teczki składa serwer z identyfikatora sprawy — katalog nie przychodzi od przeglądarki",
  "case-events.ts": "parametr `from` to kursor zdarzeń (liczba), nie ścieżka na dysku",
  "test-reset.ts": "narzędzie testowe, nie trasa produktu",
  "test-saved-file.ts": "narzędzie testowe, nie trasa produktu",
  "test-seed-turn.ts": "narzędzie testowe, nie trasa produktu",
}

const parse = (file: string) =>
  ts.createSourceFile(
    file,
    readFileSync(path.join(API, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

/** Każdy import — statyczny i dynamiczny — sprowadzony do nazwy modułu. */
function importedModules(source: ts.SourceFile): Set<string> {
  const found = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      found.add(node.moduleSpecifier.text)
    }
    // `await import("node:fs")` — wywołanie, którego „nazwą” jest słowo kluczowe `import`.
    const first = ts.isCallExpression(node) ? node.arguments[0] : undefined
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      first &&
      ts.isStringLiteralLike(first)
    ) {
      found.add(first.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/**
 * Czy brama gdziekolwiek ROZSTRZYGA. Nie wystarczy ją wywołać: wynik musi sterować
 * przebiegiem — stać w warunku, w wyrażeniu logicznym, w `return` albo wpaść do zmiennej,
 * którą ktoś dalej czyta. Wywołanie, którego wynik nigdzie nie idzie, jest wymówieniem
 * nazwy — i to jest dokładnie to obejście, przez które ten test został przepisany.
 */
function gateDecides(source: ts.SourceFile): boolean {
  let decides = false
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      GATES.has(node.expression.text)
    ) {
      // W górę przez nawiasy i negacje — `!mayTouchShared(…)` to ta sama decyzja, odwrócona.
      let at: ts.Node = node
      while (
        at.parent &&
        (ts.isParenthesizedExpression(at.parent) ||
          (ts.isPrefixUnaryExpression(at.parent) &&
            at.parent.operator === ts.SyntaxKind.ExclamationToken))
      ) {
        at = at.parent
      }
      const parent: ts.Node | undefined = at.parent
      if (
        parent &&
        (ts.isIfStatement(parent) ||
          ts.isConditionalExpression(parent) ||
          ts.isBinaryExpression(parent) ||
          ts.isReturnStatement(parent) ||
          ts.isVariableDeclaration(parent) ||
          ts.isWhileStatement(parent))
      ) {
        decides = true
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return decides
}

const routes = readdirSync(API)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((name) => ({ name: name, source: parse(name) }))
  .filter((r) => [...importedModules(r.source)].some((m) => DISK_MODULES.has(m)))

describe("brama wspólnej półki na całej powierzchni HTTP", () => {
  it("w ogóle znajduje trasy sięgające po dysk", () => {
    // Bez tego cały plik mógłby być zielony dlatego, że nie sprawdził niczego.
    expect(routes.map((r) => r.name).sort()).toContain("file.ts")
    expect(routes.length).toBeGreaterThanOrEqual(4)
  })

  it.each(routes.map((r) => [r.name, r] as const))(
    "%s pyta bramę rozstrzygająco albo ma wpisany powód",
    (_n, route) => {
      const reason = EXEMPT[route.name]
      if (reason) {
        expect(reason.length, `powód zwolnienia ${route.name} jest pusty`).toBeGreaterThan(20)
        return
      }
      expect(
        gateDecides(route.source),
        `${route.name} sięga po dysk Biurka, ale brama wspólnej półki nic tam nie rozstrzyga. ` +
          "Wywołanie `mayTouchShared`, którego wynik nigdzie nie idzie, bramą nie jest. " +
          "Dołóż warunek przy ścieżce od użytkownika albo wpisz powód do EXEMPT.",
      ).toBe(true)
    },
  )

  it("nie zwalnia tras, których już nie ma", () => {
    // Zwolnienie, które przeżyło usunięcie trasy, jest zaproszeniem do pomyłki:
    // nowy plik o tej samej nazwie odziedziczyłby cudzy powód.
    const onDisk = new Set(readdirSync(API))
    for (const name of Object.keys(EXEMPT)) {
      expect(onDisk.has(name), `EXEMPT wymienia ${name}, którego nie ma w katalogu`).toBe(true)
    }
  })

  it("katalog tras nie urósł w głąb ani poza .ts", () => {
    // Skan jest płaski i obejmuje wyłącznie `.ts`. Gdy pojawi się podkatalog albo `.tsx`,
    // ta granica stanie się dziurą — i stanie się nią po cichu. Dlatego mówi o tym test,
    // a nie komentarz.
    const strays = readdirSync(API).filter(
      (entry) => statSync(path.join(API, entry)).isDirectory() || entry.endsWith(".tsx"),
    )
    expect(
      strays,
      "skan tras jest płaski i tylko dla .ts — rozszerz go, zanim dołożysz takie pliki",
    ).toEqual([])
  })
})
