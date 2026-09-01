// Strażnik montażu Biurka: ani jeden adres wewnętrzny nie może być wpisany na sztywno.
//
// DLACZEGO POWSTAŁ. Biurko stoi w DWÓCH miejscach naraz: jako aplikacja
// samodzielna (`apps/desk`, adresy od korzenia) i jako kafelek powłoki
// (`/desk/*`). Różnicę zna wyłącznie `@cortex/desk-ui/routes` — `t()` dla stron
// i `api()` dla tras. Adres wpisany wprost działa w aplikacji samodzielnej,
// więc przechodzi każdy test i każde kliknięcie u dewelopera, a pod powłoką
// daje 404. Tak było z nawigacją po katalogach (`/files?k=…`), z paskiem dolnym
// (trzy zakładki) i z przekierowaniem po założeniu sprawy — wszystkie trzy
// wyszły dopiero z ręcznego klikania po powłoce, nie ze 107 scenariuszy.
//
// CZEGO TEN STRAŻNIK NIE ŁAPIE: adresu zbudowanego w zmiennej i dopiero potem
// przekazanego do `push()`. Łapie postać dosłowną, bo to ona jest odruchem.

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")

/** Kod Biurka, który renderuje się pod OBOMA montażami. */
const ROOTS = ["packages/@cortex/desk-ui/src", "packages/@cortex/desk-app/src", "apps/desk/src"]

/**
 * Adresy, które NIE są trasą Next.js tej aplikacji, więc prefiks ich nie dotyczy.
 * Lista jest jawna, bo każdy wpis to zgoda na wyjątek, a nie wzorzec.
 */
/**
 * Adresy, które NIE są trasą Next.js tej aplikacji, więc prefiks ich nie dotyczy.
 * Lista jest PUSTA i to jest wynik, nie zaniedbanie.
 *
 * Stał tu wcześniej jeden wpis — sam korzeń `"/"`, wpuszczony jako „bywa poprawny
 * w linku zewnętrznym". Kiedy do strażnika doszło `history.replaceState`, okazało się,
 * że ten wyjątek osłaniał w całym repozytorium dokładnie jedno miejsce: przepisanie
 * paska adresu na `"/"` w polu zlecenia, które pod powłoką wyprowadzało z Biurka.
 * Wyjście do katalogu aplikacji idzie stałą `HUB`, a nie literałem, więc wyjątku
 * nie potrzebuje nikt.
 */
const NOT_A_ROUTE: string[] = []

const listFiles = (root: string): string[] => {
  const abs = path.join(repoRoot, root)
  return readdirSync(abs, { recursive: true, encoding: "utf8" })
    .map((entry) => `${root}/${entry.split(path.sep).join("/")}`)
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"))
}

const files = ROOTS.flatMap(listFiles)

/** Wywołania, które SAME dokładają prefiks — wewnątrz nich literał jest w porządku. */
const PREFIXING_CALLS = new Set(["t", "api"])

type Offence = { where: string; value: string }

function offences(relative: string): Offence[] {
  const source = ts.createSourceFile(
    relative,
    readFileSync(path.join(repoRoot, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const found: Offence[] = []

  /** Czy węzeł stoi wewnątrz `t(...)` albo `api(...)`. */
  const insidePrefixingCall = (node: ts.Node): boolean => {
    for (let cur = node.parent; cur; cur = cur.parent) {
      if (ts.isCallExpression(cur) && ts.isIdentifier(cur.expression)) {
        if (PREFIXING_CALLS.has(cur.expression.text)) return true
      }
    }
    return false
  }

  /** Adres wewnętrzny w postaci dosłownej: `"/coś"` albo `` `/coś${x}` ``. */
  const literalPath = (node: ts.Node): string | null => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return node.text.startsWith("/") ? node.text : null
    }
    if (ts.isTemplateExpression(node)) {
      const head = node.head.text
      return head.startsWith("/") ? `${head}\${…}` : null
    }
    return null
  }

  const check = (node: ts.Node, where: string) => {
    const value = literalPath(node)
    if (value === null || NOT_A_ROUTE.includes(value)) return
    if (insidePrefixingCall(node)) return
    found.push({ where, value })
  }

  const visit = (node: ts.Node) => {
    // `router.push("/files")`, `router.replace(...)`
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["push", "replace"].includes(node.expression.name.text) &&
      node.arguments[0]
    ) {
      check(node.arguments[0], `${node.expression.name.text}()`)
    }
    // `window.history.replaceState(null, "", "/")` — adres siedzi w TRZECIM argumencie.
    // Ta postać przepisuje pasek adresu z pominięciem routera, więc pod powłoką
    // podmieniała adres Biurka na korzeń powłoki. Wychodziło to dopiero przy
    // odświeżeniu strony, czyli nigdy w czasie klikania.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["pushState", "replaceState"].includes(node.expression.name.text) &&
      node.arguments[2]
    ) {
      check(node.arguments[2], `${node.expression.name.text}()`)
    }
    // `<Link href="/files">`, `<a href={`/case/${id}`}>`
    if (ts.isJsxAttribute(node) && node.name.getText(source) === "href" && node.initializer) {
      const value = ts.isJsxExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer
      if (value) check(value, "href")
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe("Biurko działa pod oboma montażami", () => {
  it("skan obejmuje realny zbiór plików, a nie pusty", () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it("lista wyjątków jest pusta — przypięte, żeby nie odrosła po cichu", () => {
    expect(NOT_A_ROUTE).toEqual([])
  })

  it("żaden adres wewnętrzny nie jest wpisany z pominięciem prefiksu", () => {
    const offenders: Record<string, string[]> = {}
    for (const file of files) {
      const found = offences(file)
      if (found.length) offenders[file] = found.map((o) => `${o.where}: ${o.value}`)
    }
    expect(offenders).toEqual({})
  })

  it("strażnik naprawdę odrzuca adres bez prefiksu", () => {
    // Wstrzyknięcie zamiast wiary: gdyby reguła patrzyła na złe węzły, test
    // wyżej byłby zielony zawsze i nie powiedziałby o tym ani słowa.
    const probe = ts.createSourceFile(
      "probe.tsx",
      `const a = <Link href="/files" />
       const b = <Link href={t("/files")} />
       router.push("/case/1")
       router.push(t("/case/1"))
       window.history.replaceState(null, "", "/files")
       window.history.replaceState(null, "", t("/files"))`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const found: string[] = []
    const insidePrefixing = (node: ts.Node): boolean => {
      for (let cur = node.parent; cur; cur = cur.parent) {
        if (ts.isCallExpression(cur) && ts.isIdentifier(cur.expression)) {
          if (PREFIXING_CALLS.has(cur.expression.text)) return true
        }
      }
      return false
    }
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "push" &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0]) &&
        !insidePrefixing(node.arguments[0])
      ) {
        found.push(`push(): ${(node.arguments[0] as ts.StringLiteral).text}`)
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "replaceState" &&
        node.arguments[2] &&
        ts.isStringLiteral(node.arguments[2]) &&
        !insidePrefixing(node.arguments[2])
      ) {
        found.push(`replaceState(): ${(node.arguments[2] as ts.StringLiteral).text}`)
      }
      if (ts.isJsxAttribute(node) && node.name.getText(probe) === "href" && node.initializer) {
        const value = ts.isJsxExpression(node.initializer)
          ? node.initializer.expression
          : node.initializer
        if (value && ts.isStringLiteral(value) && !insidePrefixing(value)) {
          found.push(`href: ${value.text}`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(probe)
    expect(found).toEqual(["href: /files", "push(): /case/1", "replaceState(): /files"])
  })
})
