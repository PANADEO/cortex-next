import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import { SOURCE_LOCALE } from "./config"

/**
 * WŁASNOŚĆ ODWROTNA DO POZOSTAŁYCH STRAŻNIKÓW.
 *
 * `no-plain-text` pilnuje, żeby napis nie stał w kodzie. `locales-parity`
 * pilnuje, żeby plik tłumaczeń był kompletny. Żaden z nich nie zauważy
 * LITERÓWKI W KLUCZU — a ta jest gorsza niż plain text, bo nie krzyczy:
 * i18next zwraca wtedy sam klucz albo cicho spada na komunikat ogólny, więc
 * na ekranie pojawia się `errors.uplodFailed` zamiast zdania, i to wyłącznie
 * w tej jednej gałęzi, do której nikt nie zajrzał.
 *
 * ZASIĘG MA ZNACZENIE. Jeden plik potrafi trzymać dwa komponenty z DWOMA
 * różnymi przestrzeniami (`config-screen.tsx` ma `cortex-config` i `common`).
 * Wersja czytająca plik płasko bierze ostatnie wiązanie i zgłasza fałszywe
 * braki — dlatego `t` jest wiązane per funkcja, nie per plik.
 *
 * Sprawdzane są WYŁĄCZNIE klucze podane literałem. Klucz sklejany w runtime
 * jest poza zasięgiem analizy statycznej i pozostaje odpowiedzialnością
 * wołającego.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const localesDir = path.join(repoRoot, "app/idp/locales")

/** Przyrostki liczby mnogiej — `t("x.count")` rozwija się na `x.count_few`. */
const PLURAL_SUFFIXES = ["", "_one", "_few", "_many", "_other"]

const SKIP = ["node_modules", ".next", "mocks"]

function loadBundle(): Record<string, unknown> {
  const bundle: Record<string, unknown> = {}
  for (const file of readdirSync(path.join(localesDir, SOURCE_LOCALE))) {
    bundle[file.replace(/\.json$/, "")] = JSON.parse(
      readFileSync(path.join(localesDir, SOURCE_LOCALE, file), "utf8"),
    )
  }
  // `tiles` istnieje TYLKO w `en` — w języku źródłowym wygrywa baza.
  bundle.tiles = JSON.parse(readFileSync(path.join(localesDir, "en/tiles.json"), "utf8"))
  return bundle
}

const bundle = loadBundle()

function resolve(namespace: string, key: string): unknown {
  let node: unknown = bundle[namespace]
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

function exists(namespace: string, key: string): boolean {
  return PLURAL_SUFFIXES.some((suffix) => {
    const parts = key.split(".")
    parts[parts.length - 1] += suffix
    return typeof resolve(namespace, parts.join(".")) === "string"
  })
}

function listSources(root: string): string[] {
  return readdirSync(path.join(repoRoot, root), { recursive: true, encoding: "utf8" })
    .map((entry) => `${root}/${entry.split(path.sep).join("/")}`)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
    .filter((file) => !/\.(test|stories)\.tsx?$/.test(file))
    .filter((file) => !SKIP.some((part) => file.includes(`/${part}/`)))
}

interface Usage {
  file: string
  line: number
  namespace: string
  key: string
}

const isScope = (node: ts.Node): boolean =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isSourceFile(node)

function collectUsages(relative: string): Usage[] {
  const source = readFileSync(path.join(repoRoot, relative), "utf8")
  if (!/useTranslation|getFixedT/.test(source)) return []
  const sourceFile = ts.createSourceFile(
    relative,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const usages: Usage[] = []

  const namespacesOf = (call: ts.CallExpression): string[] => {
    const callee = call.expression.getText(sourceFile)
    const arg = callee === "useTranslation" ? call.arguments[0] : call.arguments[1]
    if (arg && ts.isStringLiteral(arg)) return [arg.text]
    if (arg && ts.isArrayLiteralExpression(arg)) {
      return arg.elements.filter(ts.isStringLiteral).map((element) => element.text)
    }
    return []
  }

  const walk = (node: ts.Node, outer: Map<string, string[]>): void => {
    const scope = isScope(node) ? new Map(outer) : outer

    if (isScope(node)) {
      const bind = (child: ts.Node): void => {
        if (isScope(child) && child !== node) return
        if (ts.isVariableDeclaration(child) && child.initializer) {
          const init = child.initializer
          if (ts.isCallExpression(init)) {
            const callee = init.expression.getText(sourceFile)
            if (callee === "useTranslation" || callee.endsWith("getFixedT")) {
              const namespaces = namespacesOf(init)
              if (ts.isIdentifier(child.name)) scope.set(child.name.text, namespaces)
              else if (ts.isObjectBindingPattern(child.name)) {
                for (const element of child.name.elements) {
                  const property = element.propertyName?.getText(sourceFile)
                  const name = element.name.getText(sourceFile)
                  if ((property ?? name) === "t") scope.set(name, namespaces)
                }
              }
            }
          }
        }
        ts.forEachChild(child, bind)
      }
      ts.forEachChild(node, bind)
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const namespaces = scope.get(node.expression.text)
      const first = node.arguments[0]
      if (namespaces && first && ts.isStringLiteral(first)) {
        const [explicit, rest] = first.text.includes(":")
          ? (first.text.split(":", 2) as [string, string])
          : [undefined, first.text]
        const candidates = explicit ? [explicit] : namespaces
        const key = rest
        if (candidates.length > 0 && !candidates.some((ns) => exists(ns, key))) {
          usages.push({
            file: relative,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
            namespace: candidates.join("|"),
            key,
          })
        }
      }
    }

    ts.forEachChild(node, (child) => walk(child, scope))
  }

  walk(sourceFile, new Map())
  return usages
}

const files = [...listSources("app"), ...listSources("packages")]

/** Wszystkie klucze liście przestrzeni, bez sekcji `_ctx`. */
function leafKeys(node: unknown, prefix = ""): string[] {
  if (node == null || typeof node !== "object") return []
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    key === "_ctx"
      ? []
      : value && typeof value === "object"
        ? leafKeys(value, `${prefix}${key}.`)
        : [`${prefix}${key}`],
  )
}

/**
 * Klucz sklejany w runtime (`t(\`board.columns.\${id}.label\`)`) nie da się
 * dopasować dosłownie, więc zbieramy PRZEDROSTEK z głowy szablonu i uznajemy
 * za żywe wszystko, co się nim zaczyna. Świadomie zgrubne: lepiej przepuścić
 * klucz naprawdę martwy niż zgłaszać codziennie ten sam fałszywy alarm.
 */
function referenced(): { exact: Set<string>; prefixes: string[] } {
  const exact = new Set<string>()
  const prefixes = new Set<string>()
  for (const relative of files) {
    const source = readFileSync(path.join(repoRoot, relative), "utf8")
    const sourceFile = ts.createSourceFile(
      relative,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const value = node.text
        if (/^[a-zA-Z][\w-]*(\.[\w-]+)+$/.test(value)) exact.add(value)
        if (value.includes(":")) exact.add(value.split(":", 2)[1] ?? "")
      }
      if (ts.isTemplateExpression(node) && /^[a-zA-Z][\w-]*\./.test(node.head.text)) {
        prefixes.add(node.head.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return { exact, prefixes: [...prefixes] }
}

describe("klucze wołane w kodzie istnieją w tłumaczeniach", () => {
  it("skan obejmuje realny zbiór plików, a nie pusty", () => {
    expect(
      files.filter((file) => /useTranslation/.test(readFileSync(path.join(repoRoot, file), "utf8")))
        .length,
    ).toBeGreaterThan(20)
  })

  it("żaden klucz w plikach tłumaczeń nie jest martwy", () => {
    // Własność odwrotna do poniższej. Martwy klucz nie psuje ekranu, ale
    // kosztuje przy KAŻDEJ kolejnej partii tłumaczeń — tłumacz dostaje wpis,
    // którego nie da się obejrzeć w interfejsie, więc jego `_ctx` nikt nigdy
    // nie zweryfikuje.
    const { exact, prefixes } = referenced()
    const isLive = (key: string): boolean => {
      const base = key.replace(/_(one|few|many|other)$/, "")
      return [key, base].some(
        (candidate) => exact.has(candidate) || prefixes.some((p) => candidate.startsWith(p)),
      )
    }

    const dead = Object.keys(bundle)
      .filter((namespace) => namespace !== "tiles")
      .flatMap((namespace) =>
        leafKeys(bundle[namespace])
          .filter((key) => !isLive(key))
          .map((key) => `${namespace}:${key}`),
      )

    expect({ martweKlucze: dead }).toEqual({ martweKlucze: [] })
  })

  it("żaden klucz podany literałem nie wskazuje w pustkę", () => {
    const missing = files
      .flatMap(collectUsages)
      .map((usage) => `${usage.file}:${usage.line} → ${usage.namespace}:${usage.key}`)

    expect({ brakujaceKlucze: missing }).toEqual({ brakujaceKlucze: [] })
  })
})
