// Strażnik kontraktu: przeglądarka i trasa muszą nazywać pola tak samo.
//
// DLACZEGO POWSTAŁ. Panel wyniku wysyłał do `/files` pole `z`, a trasa czytała `b.from` —
// po przemianowaniu na angielski jedna strona pojechała, druga nie. Skutkiem był czerwony
// komunikat „Nie udało się zapisać do Moich plików." przy każdym kliknięciu, a żaden z 107
// scenariuszy tego nie widział, bo wszystkie wołają API bezpośrednio, z własnym ciałem
// żądania. Ciało budowane przez KOMPONENT nie było sprawdzane nigdzie.
//
// `tsc` też tego nie łapie i nie ma jak: `await req.json()` jest `any`, więc `b.z` to
// poprawny odczyt nieistniejącego pola, a `JSON.stringify({ z })` — poprawny zapis.
//
// CZEGO NIE ŁAPIE: ciała zbudowanego w zmiennej i przekazanego przez granicę pliku albo
// przez drugą warstwę opakowania. Jeden poziom pośrednictwa (wrapper w tym samym pliku)
// jest rozwijany, bo to najczęstszy idiom w tych komponentach.

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")

/**
 * Trasa → moduł, który ją obsługuje. Jawnie, bo obie strony montażu (samodzielna
 * aplikacja i kafelek powłoki) tylko re-eksportują te moduły, więc to one są kontraktem.
 * `*` zastępuje wstawkę z szablonu, np. `api(`/case/${id}/turn`)`.
 */
const ROUTES: Record<string, string> = {
  "/files": "files.ts",
  "/files/upload": "files-upload.ts",
  "/file": "file.ts",
  "/mcp": "mcp.ts",
  "/procedures": "procedures.ts",
  "/procedures/supervision": "procedure-supervision.ts",
  "/request": "request.ts",
  "/team": "team.ts",
  "/memory": "memory.ts",
  "/persona": "persona.ts",
  "/case/new": "case-new.ts",
  "/case/*/turn": "case-turn.ts",
  "/case/*/talk": "case-talk.ts",
  "/case/*/stop": "case-stop.ts",
  "/case/*/events": "case-events.ts",
}

const API_DIR = "packages/@cortex/desk-app/src/api"
const CLIENT_ROOTS = ["packages/@cortex/desk-ui/src", "apps/desk/src"]

function parse(relative: string): ts.SourceFile {
  return ts.createSourceFile(
    relative,
    readFileSync(path.join(repoRoot, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
}

/** Pola, które trasa naprawdę odczytuje z ciała żądania. */
function fieldsReadByRoute(module: string): string[] {
  const source = parse(`${API_DIR}/${module}`)
  const bodies = new Set<string>()
  const fields = new Set<string>()

  // Dwie postaci odczytu ciała i obie są w użyciu: `const b = await req.json()`, po którym
  // pola czyta się przez `b.x`, oraz `const { id, decision } = await req.json()`, gdzie
  // pola stoją wprost we wzorcu. Trzeba obu — inaczej połowa tras wygląda na taką, która
  // nie czyta niczego, i strażnik zapala się na poprawnym kodzie.
  const findBodies = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isAwaitExpression(node.initializer) &&
      /\.json\(\)/.test(node.initializer.expression.getText(source))
    ) {
      if (ts.isIdentifier(node.name)) bodies.add(node.name.text)
      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const bound = element.propertyName ?? element.name
          if (ts.isIdentifier(bound)) fields.add(bound.text)
        }
      }
    }
    ts.forEachChild(node, findBodies)
  }
  findBodies(source)

  const findFields = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      bodies.has(node.expression.text)
    ) {
      fields.add(node.name.text)
    }
    ts.forEachChild(node, findFields)
  }
  findFields(source)
  return [...fields].sort()
}

/** Trasa z wywołania `api(...)`, ze wstawkami szablonu zwiniętymi do `*`. */
function routeOf(node: ts.Node, source: ts.SourceFile): string | null {
  if (!ts.isCallExpression(node) || node.expression.getText(source) !== "api") return null
  const arg = node.arguments[0]
  if (!arg) return null
  if (ts.isStringLiteralLike(arg)) return arg.text
  if (ts.isTemplateExpression(arg)) {
    return arg.head.text + arg.templateSpans.map((s) => `*${s.literal.text}`).join("")
  }
  return null
}

type Body = { file: string; route: string; keys: string[] }

/** Ciała żądań budowane w komponentach — z jednym poziomem rozwijania opakowań. */
function bodiesSentBy(relative: string): Body[] {
  const source = parse(relative)
  const found: Body[] = []

  const keysOf = (node: ts.Node): string[] | null =>
    ts.isObjectLiteralExpression(node)
      ? node.properties.flatMap((p) =>
          p.name && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name))
            ? [p.name.text]
            : [],
        )
      : null

  /** Nazwa funkcji, w której stoi węzeł, i nazwa jej parametru na danej pozycji. */
  const enclosing = (node: ts.Node): { name: string; params: string[] } | null => {
    for (let cur: ts.Node | undefined = node; cur; cur = cur.parent) {
      if (ts.isFunctionDeclaration(cur) && cur.name) {
        return {
          name: cur.name.text,
          params: cur.parameters.map((p) => p.name.getText(source)),
        }
      }
    }
    return null
  }

  /** Argumenty przekazane do funkcji `name` w tym samym pliku, na pozycji `index`. */
  const argumentsAt = (name: string, index: number): ts.Node[] => {
    const args: ts.Node[] = []
    const walk = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === name &&
        node.arguments[index]
      ) {
        args.push(node.arguments[index]!)
      }
      ts.forEachChild(node, walk)
    }
    ts.forEachChild(source, walk)
    return args
  }

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "fetch") {
      const route = node.arguments[0] ? routeOf(node.arguments[0], source) : null
      const init = node.arguments[1]
      if (route && init && ts.isObjectLiteralExpression(init)) {
        for (const p of init.properties) {
          if (!ts.isPropertyAssignment(p) || p.name.getText(source) !== "body") continue
          const call = p.initializer
          if (!ts.isCallExpression(call) || call.expression.getText(source) !== "JSON.stringify")
            continue
          const payload = call.arguments[0]
          if (!payload) continue

          const direct = keysOf(payload)
          if (direct) {
            found.push({ file: relative, route, keys: direct })
            continue
          }
          // `JSON.stringify(data)`, gdzie `data` to parametr opakowania — schodzimy
          // do miejsc, z których to opakowanie jest wołane.
          if (!ts.isIdentifier(payload)) continue
          const owner = enclosing(call)
          const index = owner?.params.indexOf(payload.text) ?? -1
          if (!owner || index < 0) continue
          for (const arg of argumentsAt(owner.name, index)) {
            const keys = keysOf(arg)
            if (keys) found.push({ file: relative, route, keys })
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

const clientFiles = CLIENT_ROOTS.flatMap((root) =>
  readdirSync(path.join(repoRoot, root), { recursive: true, encoding: "utf8" })
    .map((entry) => `${root}/${entry.split(path.sep).join("/")}`)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file)),
)

describe("przeglądarka i trasa nazywają pola tak samo", () => {
  it("skan obejmuje realne ciała żądań, a nie zero", () => {
    const bodies = clientFiles.flatMap(bodiesSentBy)
    expect(bodies.length).toBeGreaterThan(8)
  })

  it("każda trasa, do której ktoś pisze, jest w mapie", () => {
    const unknown = clientFiles
      .flatMap(bodiesSentBy)
      .filter((b) => !ROUTES[b.route])
      .map((b) => `${b.file}: ${b.route}`)
    expect([...new Set(unknown)]).toEqual([])
  })

  it("żadne pole wysłane przez komponent nie jest przez trasę ignorowane", () => {
    const read = new Map<string, string[]>()
    const offenders: Record<string, string[]> = {}
    for (const b of clientFiles.flatMap(bodiesSentBy)) {
      const module = ROUTES[b.route]
      if (!module) continue
      if (!read.has(module)) read.set(module, fieldsReadByRoute(module))
      const known = read.get(module)!
      const orphans = b.keys.filter((k) => !known.includes(k))
      if (orphans.length) {
        offenders[b.file] ??= []
        offenders[b.file]!.push(...orphans.map((k) => `${b.route} nie czyta pola „${k}”`))
      }
    }
    expect(offenders).toEqual({})
  })

  it("odczyt pól trasy naprawdę coś znajduje", () => {
    // Gdyby wzorzec na `await req.json()` przestał pasować, zbiór znanych pól byłby
    // pusty — i test wyżej zapaliłby się na wszystkim albo na niczym, zależnie od
    // kierunku porównania. Ta asercja pilnuje, żeby nie było „na niczym".
    expect(fieldsReadByRoute("files.ts")).toEqual(
      expect.arrayContaining(["action", "from", "to", "path"]),
    )
  })

  it("strażnik naprawdę odrzuca rozjechane pole", () => {
    const probe = ts.createSourceFile(
      "probe.tsx",
      `async function go() {
         await fetch(api("/files"), { method: "POST", body: JSON.stringify({ z: p.path }) })
       }`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const keys: string[] = []
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(probe) === "JSON.stringify") {
        const arg = node.arguments[0]
        if (arg && ts.isObjectLiteralExpression(arg))
          keys.push(...arg.properties.map((p) => p.name!.getText(probe)))
      }
      ts.forEachChild(node, visit)
    }
    visit(probe)
    expect(keys.filter((k) => !fieldsReadByRoute("files.ts").includes(k))).toEqual(["z"])
  })
})

/**
 * Druga strona tej samej granicy: dziennik.
 *
 * `audit.write(kto, typ, szczegoly)` przyjmuje `Record<string, unknown>`, a `describeEntry`
 * czyta z niego pola po nazwie. Żadna z tych stron nie wie o drugiej, więc przemianowanie
 * `z` → `from` zabrało opisom plików nazwę pliku: „przeniosła plik " i puste miejsce, na
 * ekranie audytora, bez błędu. Dziennik jest w tym produkcie dowodem — wpis, który nie mówi
 * CZEGO dotyczył, nie jest dowodem.
 */
const AUDIT_WRITERS = ["packages/@cortex/desk-app/src/api", "packages/@cortex/desk-core/src"]

/**
 * `files.ts` loguje CAŁE ciało żądania — trzecim argumentem `audit.write` jest tam samo `b`,
 * więc jego klucze to klucze tej trasy — jedyne miejsce, gdzie zapisane pola nie stoją
 * w literale. Świadomie wymienione, a nie zgadywane z gwiazdki.
 */
const WHOLE_BODY_WRITERS = ["files.ts"]

function auditKeysWritten(): string[] {
  const keys = new Set<string>()
  for (const root of AUDIT_WRITERS) {
    const files = readdirSync(path.join(repoRoot, root), { recursive: true, encoding: "utf8" })
      .map((entry) => `${root}/${entry.split(path.sep).join("/")}`)
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    for (const relative of files) {
      const source = parse(relative)
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          /^(audit|dziennik)\.write$/.test(node.expression.getText(source)) &&
          node.arguments[2] &&
          ts.isObjectLiteralExpression(node.arguments[2])
        ) {
          for (const prop of node.arguments[2].properties) {
            if (prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name)))
              keys.add(prop.name.text)
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  for (const module of WHOLE_BODY_WRITERS) for (const k of fieldsReadByRoute(module)) keys.add(k)
  return [...keys].sort()
}

/** Pola, które opis dziennika odczytuje ze `szczegolow`. */
function auditKeysRead(): string[] {
  const relative = "packages/@cortex/desk-core/src/audit-log-text.ts"
  const source = parse(relative)
  const keys = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "s"
    ) {
      keys.add(node.name.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return [...keys].sort()
}

describe("dziennik zapisuje te pola, które opis odczytuje", () => {
  it("obie strony naprawdę coś zwracają", () => {
    expect(auditKeysWritten().length).toBeGreaterThan(10)
    expect(auditKeysRead().length).toBeGreaterThan(8)
  })

  it("opis nie sięga po pole, którego nikt nie zapisuje", () => {
    const written = auditKeysWritten()
    expect(auditKeysRead().filter((k) => !written.includes(k))).toEqual([])
  })

  it("strażnik naprawdę odrzuca pole spoza zapisu", () => {
    expect(auditKeysWritten()).not.toContain("z")
  })
})
