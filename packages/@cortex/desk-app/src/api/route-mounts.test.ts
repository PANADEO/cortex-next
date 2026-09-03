// PUNKTY MONTOWANIA ZOSTAJĄ PUNKTAMI MONTOWANIA.
//
// DLACZEGO POWSTAŁ. Wszystko, co pilnuje tras Biurka — zakaz zdania wpisanego na sztywno
// w polu `error`, zakaz porównywania się z wartością ze słownika, zakaz sięgania po dysk
// z pominięciem bramy — skanuje KATALOG `packages/@cortex/desk-app/src/api`. Tymczasem
// trasami, które Next naprawdę montuje, są `apps/desk/src/app/api/**/route.ts`. Dziś
// wszystkie są trzylinijkowymi reeksportami i dlatego tamte strażniki wystarczają.
//
// Nic tego nie wymuszało. Wystarczyłaby jedna trasa z logiką wpisaną wprost w `route.ts`,
// żeby ominąć wszystkie trzy naraz — i to nie przez złą wolę, tylko dlatego, że tak jest
// szybciej i tak wygląda każdy przykład z dokumentacji Next. Ten plik zamienia „tak się
// składa, że są cienkie" w regułę.
//
// CZEGO NIE PILNUJE: co robi kod PO drugiej stronie reeksportu. Od tego są tamte trzy.

import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const here = path.dirname(fileURLToPath(import.meta.url))
const MOUNTS = path.resolve(here, "../../../../..", "apps/desk/src/app/api")

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return routeFiles(full)
    return name === "route.ts" ? [full] : []
  })
}

describe("trasy Next są wyłącznie punktami montowania", () => {
  const files = routeFiles(MOUNTS)

  it("w ogóle je widzi", () => {
    // Bez tego cały plik byłby zielony dlatego, że przeszukał pusty katalog — a katalog
    // łatwo przestaje istnieć, gdy ktoś przeniesie aplikację.
    expect(files.length, `nie znalazłem żadnej trasy w ${MOUNTS}`).toBeGreaterThan(10)
  })

  it.each(files.map((f) => [path.relative(MOUNTS, f), f] as const))(
    "%s nie ma własnej treści",
    (relative, full) => {
      const source = ts.createSourceFile(
        relative,
        readFileSync(full, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      )
      // Wolno WYŁĄCZNIE reeksport z modułu. Każda inna instrukcja na najwyższym poziomie
      // — funkcja, stała, `import` z czegokolwiek — znaczy, że trasa zaczęła coś robić
      // sama, poza zasięgiem strażników z `desk-app`.
      const ownStatements = source.statements.filter(
        (statement) =>
          !(ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined),
      )
      expect(
        ownStatements.map((one) => one.getText().split("\n")[0]?.slice(0, 70) ?? ""),
        `${relative} przestała być punktem montowania. Treść ma mieszkać w ` +
          "`@cortex/desk-app/api/*`, bo tylko tam sięgają strażniki tras — inaczej ta " +
          "trasa omija naraz zakaz zdań na sztywno, zakaz porównań ze słownikiem i bramę dysku.",
      ).toEqual([])
    },
  )
})
