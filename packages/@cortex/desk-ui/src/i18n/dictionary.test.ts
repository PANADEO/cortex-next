// Słownik Biurka: oba języki mają te same klucze, a każdy klucz z kodu istnieje.
//
// DLACZEGO POWSTAŁ. Brak klucza nie wywraca ekranu — `makeDeskT` oddaje wtedy sam klucz,
// więc na ekranie stoi `case.stop` zamiast „Stop". To jest awaria widoczna wyłącznie
// dla kogoś, kto akurat na ten ekran patrzy, i to w tym jednym języku. Dwa języki
// utrzymywane ręcznie rozjeżdżają się przy pierwszym pośpiechu.
//
// CZEGO NIE ŁAPIE: klucza sklejanego w całości ze zmiennej. Klucz z literalnym
// przedrostkiem (`case.status.${x}`) sprawdzamy po przedrostku — musi istnieć
// przynajmniej jedno rozwinięcie, więc literówka w przedrostku dalej jest czerwona.

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import en from "./en.json"
import { DESK_LOCALES, makeDeskT } from "./locale"
import pl from "./pl.json"

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, "../../../../..")
const ROOTS = ["packages/@cortex/desk-ui/src", "packages/@cortex/desk-app/src"]

/** Ścieżki do liści. Liść mnogi liczy się jako JEDEN klucz, bo formy różnią się językiem. */
function keysOf(node: unknown, prefix = ""): string[] {
  if (typeof node !== "object" || node === null) return [prefix]
  const entries = Object.entries(node as Record<string, unknown>)
  // Liść mnogi: same nazwy form CLDR w środku, żadnego zagnieżdżenia.
  const forms = new Set(["zero", "one", "two", "few", "many", "other"])
  if (entries.length > 0 && entries.every(([k, v]) => forms.has(k) && typeof v === "string")) {
    return [prefix]
  }
  return entries.flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k))
}

const plKeys = keysOf(pl).sort()
const enKeys = keysOf(en).sort()

/** Klucze, po które kod naprawdę sięga — z wywołań `translate("…")`. */
function usedKeys(): { exact: string[]; prefixes: string[] } {
  const exact = new Set<string>()
  const prefixes = new Set<string>()
  for (const root of ROOTS) {
    const files = readdirSync(path.join(repoRoot, root), { recursive: true, encoding: "utf8" })
      .map((entry) => `${root}/${entry.split(path.sep).join("/")}`)
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    for (const relative of files) {
      const source = ts.createSourceFile(
        relative,
        readFileSync(path.join(repoRoot, relative), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "translate" &&
          node.arguments[0]
        ) {
          const arg = node.arguments[0]
          if (ts.isStringLiteralLike(arg)) exact.add(arg.text)
          else if (ts.isTemplateExpression(arg) && arg.head.text) prefixes.add(arg.head.text)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  return { exact: [...exact].sort(), prefixes: [...prefixes].sort() }
}

describe("słownik Biurka", () => {
  it("ma oba języki i niepusty zestaw kluczy", () => {
    expect(DESK_LOCALES).toEqual(["pl", "en"])
    expect(plKeys.length).toBeGreaterThan(20)
  })

  it("oba języki mają dokładnie te same klucze", () => {
    expect({
      brakujeWEn: plKeys.filter((k) => !enKeys.includes(k)),
      nadmiarWEn: enKeys.filter((k) => !plKeys.includes(k)),
    }).toEqual({ brakujeWEn: [], nadmiarWEn: [] })
  })

  it("każdy klucz użyty w kodzie istnieje w słowniku", () => {
    const { exact, prefixes } = usedKeys()
    expect(exact.length).toBeGreaterThan(20)
    expect({
      nieznane: exact.filter((k) => !plKeys.includes(k)),
      puste: prefixes.filter((p) => !plKeys.some((k) => k.startsWith(p))),
    }).toEqual({ nieznane: [], puste: [] })
  })

  it("podstawia zmienne i wybiera formę liczby mnogiej", () => {
    const t = makeDeskT("pl")
    expect(t("case.seconds", { count: 5 })).toBe("5 s")
    expect(t("shell.allCases", { count: 12 })).toBe("Wszystkie sprawy (12)")
    const e = makeDeskT("en")
    expect(e("shell.skills", { granted: 1, count: 1 })).toBe("I can do 1 of 1 thing")
    expect(e("shell.skills", { granted: 2, count: 9 })).toBe("I can do 2 of 9 things")
  })

  it("brak klucza oddaje sam klucz, a nie pustkę", () => {
    // Pusty napis znika z ekranu bez śladu i wygląda jak układ bez treści.
    expect(makeDeskT("pl")("nie.ma.takiego")).toBe("nie.ma.takiego")
  })
})
