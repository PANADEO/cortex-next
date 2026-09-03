// Strażnik czystości klienta: komponent przeglądarki nie może sięgnąć po `node:` ani po bazę.
//
// DLACZEGO POWSTAŁ. Stała z nazwą katalogu („Moje pliki") wyjechała do `desk-storage.ts`,
// żeby stać w jednym miejscu — a trzy komponenty klienckie ją stamtąd zaimportowały.
// `desk-storage` zaczyna się od `import { promises as fs } from "node:fs"`, więc webpack
// dostał `node:fs` do bundla przeglądarki i przewrócił się na `UnhandledSchemeError`.
// Skutek: PIĘĆ ekranów Biurka po 500, a `tsc` czysty — bo z punktu widzenia typów nie
// wydarzyło się nic złego. `folder.ts` miał nawet komentarz „ten moduł musi zostać CZYSTY";
// komentarz nie jest bramką.
//
// Reguła idzie PRZECHODNIO: liczy się nie to, co importuje sam komponent, tylko dokąd
// prowadzi łańcuch importów. Właśnie tak ten błąd powstał — nikt nie napisał `node:fs`
// w komponencie.

import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")

/** Kod, który trafia do przeglądarki. */
const CLIENT_ROOTS = ["packages/@cortex/desk-ui/src", "packages/@cortex/desk-app/src"]

/** Moduły, których obecność w bundlu przeglądarki jest błędem, a nie stylem. */
const SERVER_ONLY = [/^node:/, /^pg$/, /^server-only$/, /^next\/headers$/, /^fs$/, /^path$/]

/** Skąd `@cortex/desk-core/x` bierze plik. Alias jest w `tsconfig`, ale tu wystarczy mapa. */
function resolveImport(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith(".")) base = path.join(path.dirname(from), spec)
  else if (spec.startsWith("@cortex/desk-core/"))
    base = path.join("packages/@cortex/desk-core/src", spec.slice("@cortex/desk-core/".length))
  else if (spec.startsWith("@cortex/desk-ui/"))
    base = path.join("packages/@cortex/desk-ui/src", spec.slice("@cortex/desk-ui/".length))
  else return null
  for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx", ""]) {
    const candidate = `${base}${suffix}`
    if (existsSync(path.join(repoRoot, candidate)) && /\.tsx?$/.test(candidate)) return candidate
  }
  return null
}

/** Specyfikatory importów pliku. `import type` pomijamy — typ nie trafia do bundla. */
function importsOf(relative: string): string[] {
  const source = ts.createSourceFile(
    relative,
    readFileSync(path.join(repoRoot, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const found: string[] = []
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (statement.importClause?.isTypeOnly) continue
    if (ts.isStringLiteral(statement.moduleSpecifier)) found.push(statement.moduleSpecifier.text)
  }
  return found
}

const isClientFile = (relative: string) =>
  /^\s*("use client"|'use client')/.test(readFileSync(path.join(repoRoot, relative), "utf8"))

const clientFiles = CLIENT_ROOTS.flatMap((root) =>
  readdirSync(path.join(repoRoot, root), { recursive: true, encoding: "utf8" })
    .map((entry) => `${root}/${entry.split(path.sep).join("/")}`)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .filter(isClientFile),
)

/** Droga od komponentu do modułu serwerowego, albo `null`, gdy takiej nie ma. */
function pathToServerModule(entry: string): string | null {
  const seen = new Set<string>()
  const queue: { file: string; trail: string[] }[] = [{ file: entry, trail: [entry] }]
  while (queue.length) {
    const { file, trail } = queue.shift()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const spec of importsOf(file)) {
      if (SERVER_ONLY.some((rule) => rule.test(spec))) return [...trail, spec].join(" → ")
      const next = resolveImport(file, spec)
      if (next) queue.push({ file: next, trail: [...trail, next] })
    }
  }
  return null
}

describe("komponent przeglądarki nie wciąga kodu serwera", () => {
  it("skan obejmuje realny zbiór komponentów klienckich", () => {
    expect(clientFiles.length).toBeGreaterThan(15)
  })

  it("żaden łańcuch importów nie prowadzi z klienta do modułu serwerowego", () => {
    const offenders: Record<string, string> = {}
    for (const file of clientFiles) {
      const trail = pathToServerModule(file)
      if (trail) offenders[file] = trail
    }
    expect(offenders).toEqual({})
  })

  it("strażnik naprawdę widzi drogę POŚREDNIĄ, nie tylko bezpośrednią", () => {
    // Wstrzyknięcie zamiast wiary. Reguła patrząca wyłącznie na importy samego komponentu
    // przepuściłaby dokładnie ten błąd, który ją zrodził: `node:fs` był o jeden plik dalej.
    // `files.ts` nie jest komponentem klienckim, więc w skanie nie bierze udziału — ale
    // jako wejście pokazuje, że łańcuch jest przechodzony do końca.
    const trail = pathToServerModule("packages/@cortex/desk-app/src/api/files.ts")
    expect(trail, "łańcuch z trasy BFF do modułu serwerowego nie został znaleziony").not.toBeNull()
    const hops = trail!.split(" → ")
    // WŁASNOŚĆ, nie konkretna trasa. Pierwotnie stało tu żądanie dokładnie trzech
    // przystanków przez `desk-storage.ts` — i test padł w dniu, w którym `files.ts`
    // dostał kolejny import, bo walker znalazł KRÓTSZĄ drogę do innego modułu
    // serwerowego. Strażnik działał; przespecyfikowana była asercja. Pilnujemy więc
    // tego, co ma być prawdą: droga jest POŚREDNIA (więcej niż jeden przystanek)
    // i kończy się na module wbudowanym Node.
    expect(hops.length, `oczekiwano drogi pośredniej, dostano: ${trail}`).toBeGreaterThan(2)
    expect(hops.at(-1)).toMatch(/^node:/)
  })

  it("czysty moduł przechodzi", () => {
    // `folder.ts` jest świadomie wolny od `node:` — trzyma nazwę katalogu właśnie dlatego,
    // że sięgają po nią komponenty przeglądarki.
    expect(pathToServerModule("packages/@cortex/desk-core/src/folder.ts")).toBeNull()
  })
})
