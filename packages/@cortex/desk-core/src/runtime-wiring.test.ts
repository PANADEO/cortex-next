// DANE ODDANE W PRÓŻNIĘ I KARTA WSKAZUJĄCA NA NIC — dwie połowy tej samej usterki.
//
// Obie mają wspólną cechę, przez którą są groźne: NIC SIĘ NIE PSUJE. Nie ma wyjątku,
// nie ma czerwonego testu, nie ma nawet ostrzeżenia kompilatora. Jest tylko cicha dziura
// w dowodzie — w jedynym miejscu, na którym stoi cały ten produkt.
//
// PIERWSZA POŁOWA. W `run_computation` stała linia:
//
//     ...(made.length > 0 ? { produced: made } : {}),
//
// `produced` nie jest polem `StepResult`. TypeScript sprawdza nadmiarowe pola WYŁĄCZNIE
// w literale przypisywanym wprost do typu; wartość wniesiona rozsypaniem (`...`) jest z tego
// zwolniona z rozmysłu, bo rozsypanie zwykle niesie obiekt szerszy niż cel. Kompilator
// milczał, `step()` przepisał do zdarzenia tylko pola, które zna, i nazwy wytworzonych
// plików nie doszły nigdzie poza tekst dla modelu.
//
// DRUGA POŁOWA — i tę wykryła dopiero recenzja pierwszej wersji tego pliku. Karta czynności
// wskazuje argument po NAZWIE:
//
//     runtime.ts     discovered: { made: [...] }
//                                  ▲  ta nazwa nie była sprawdzana NIGDZIE
//     tool-cards.ts  outputs: { arg: "made", ... }
//
// Zmierzone: podmiana `made` na `wytworzone` w `runtime.ts` zostawiała WSZYSTKO zielone,
// a funkcja wracała do stanu sprzed naprawy. Strażnik pilnujący samych kluczy najwyższego
// poziomu chronił więc przed jedną literą tekstu, nie przed klasą błędu — i mówił o sobie
// nieprawdę w komentarzu. Stąd drugi test niżej.
//
// CZEGO TEN PLIK NIE WIDZI, świadomie i wprost, żeby nikt nie wziął jego zieleni za więcej,
// niż znaczy: kluczy wnoszonych przez rozsypanie ZMIENNEJ (`...extra`), przez `Object.assign`,
// przez klucz obliczany (`["x"]: v`) i wywołań `step` pod aliasem. Wszystkie cztery są dziś
// w `runtime.ts` nieobecne i żaden nie jest kształtem, po który sięga się naturalnie.

import { readFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import { TOOL_CARDS } from "./tool-cards"

const RUNTIME = path.join(__dirname, "runtime.ts")
const runtimeText = readFileSync(RUNTIME, "utf8")

const parse = (text: string, file = "runtime.ts") =>
  ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

/** Pola zadeklarowane w `type StepResult = { … }`. */
function stepResultFields(text: string): string[] {
  const source = parse(text)
  let found: string[] | undefined
  const visit = (node: ts.Node): void => {
    if (
      ts.isTypeAliasDeclaration(node) &&
      node.name.text === "StepResult" &&
      ts.isTypeLiteralNode(node.type)
    ) {
      found = node.type.members
        .filter(ts.isPropertySignature)
        .map((one) => one.name.getText().replace(/^["']|["']$/g, ""))
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!found) throw new Error("nie znalazłem typu StepResult")
  return found
}

/**
 * Klucze wnoszone do wyniku czynności — ze wszystkich literałów, którymi kończy się
 * `step(...)`. Obsłużone kształty (każdy udowodniony testem na sztucznym źródle niżej):
 * `return { … }`, skrócone ciało strzałki `() => ({ … })`, warunek w zwrocie,
 * rozsypanie warunku `...(w ? { … } : {})` oraz zwrot zmiennej lokalnej `const x = { … }`.
 */
function keysReturnedInSteps(text: string): { key: string; line: number }[] {
  const source = parse(text)
  const out: { key: string; line: number }[] = []
  const at = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart()).line + 1

  const harvest = (literal: ts.ObjectLiteralExpression): void => {
    for (const prop of literal.properties) {
      if (ts.isSpreadAssignment(prop)) {
        literalsIn(prop.expression, undefined).forEach(harvest)
        continue
      }
      const name = prop.name
      if (name && (ts.isIdentifier(name) || ts.isStringLiteral(name))) {
        out.push({ key: name.text, line: at(prop) })
      }
    }
  }

  /**
   * Literały obiektu, do których dane wyrażenie może się rozwinąć. `scope` to ciało kroku —
   * służy do odnalezienia `const x = { … }`, gdy zwracana jest zmienna. Bez tego naturalny
   * kształt „zbuduj obiekt, potem go zwróć" omijał strażnika w całości.
   */
  function literalsIn(node: ts.Node, scope: ts.Node | undefined): ts.ObjectLiteralExpression[] {
    let value: ts.Node = node
    while (ts.isParenthesizedExpression(value) || ts.isAsExpression(value)) value = value.expression
    if (ts.isObjectLiteralExpression(value)) return [value]
    if (ts.isConditionalExpression(value)) {
      return [...literalsIn(value.whenTrue, scope), ...literalsIn(value.whenFalse, scope)]
    }
    if (ts.isIdentifier(value) && scope) {
      const wanted = value.text
      const found: ts.ObjectLiteralExpression[] = []
      const look = (n: ts.Node): void => {
        if (
          ts.isVariableDeclaration(n) &&
          ts.isIdentifier(n.name) &&
          n.name.text === wanted &&
          n.initializer
        ) {
          found.push(...literalsIn(n.initializer, undefined))
        }
        ts.forEachChild(n, look)
      }
      look(scope)
      return found
    }
    return []
  }

  const returnsUnder = (body: ts.Node): void => {
    // Skrócone ciało strzałki: `async () => ({ … })` — nie ma tu żadnego `return`.
    if (ts.isArrowFunction(body) && !ts.isBlock(body.body)) {
      literalsIn(body.body, body).forEach(harvest)
      return
    }
    /**
     * W ZAGNIEŻDŻONE FUNKCJE NIE WCHODZIMY, i to nie jest oszczędność.
     *
     * Pierwsza wersja zbierała każdy `return` i każdą krótką strzałkę w poddrzewie kroku,
     * więc `mounts: files.map((f) => ({ fromDesk: f, as: …, write: false }))` wracało jako
     * trzy klucze spoza `StepResult`. To nie były usterki — to są argumenty CZEGO INNEGO,
     * a strażnik wskazujący palcem na zdrowy kod uczy ludzi go wyłączać.
     *
     * Wynikiem kroku jest to, co zwraca JEGO WŁASNE ciało; obiekt zwrócony przez funkcję
     * w środku należy do tamtej funkcji.
     */
    const walk = (node: ts.Node): void => {
      if (
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isFunctionDeclaration(node)
      ) {
        return
      }
      if (ts.isReturnStatement(node) && node.expression) {
        literalsIn(node.expression, body).forEach(harvest)
      }
      ts.forEachChild(node, walk)
    }
    if (ts.isArrowFunction(body) || ts.isFunctionExpression(body)) ts.forEachChild(body, walk)
    else walk(body)
  }

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "step"
    ) {
      const body = node.arguments[node.arguments.length - 1]
      if (body) returnsUnder(body)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return out
}

/**
 * Dla każdej czynności: nazwy, pod którymi jej zdarzenie NAPRAWDĘ niesie wartości —
 * czyli pola schematu wejściowego (`inputSchema: z.object({ … })`) plus klucze wnoszone
 * po fakcie przez `discovered: { … }`. To jest zbiór, z którego karta ma prawo wybierać.
 */
function argNamesPerTool(text: string): Map<string, Set<string>> {
  const source = parse(text)
  const byTool = new Map<string, Set<string>>()

  const keysOf = (literal: ts.ObjectLiteralExpression) =>
    literal.properties
      .map((p) => p.name)
      .filter((n): n is ts.Identifier | ts.StringLiteral =>
        Boolean(n && (ts.isIdentifier(n) || ts.isStringLiteral(n))),
      )
      .map((n) => n.text)

  const collectInto = (set: Set<string>, subtree: ts.Node): void => {
    const walk = (node: ts.Node): void => {
      // `inputSchema: z.object({ … })`
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText() === "inputSchema" &&
        ts.isCallExpression(node.initializer) &&
        node.initializer.arguments[0] &&
        ts.isObjectLiteralExpression(node.initializer.arguments[0])
      ) {
        keysOf(node.initializer.arguments[0] as ts.ObjectLiteralExpression).forEach((k) =>
          set.add(k),
        )
      }
      // `discovered: { … }` — argumenty poznane dopiero w trakcie pracy.
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText() === "discovered" &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        keysOf(node.initializer).forEach((k) => set.add(k))
      }
      ts.forEachChild(node, walk)
    }
    walk(subtree)
  }

  const visit = (node: ts.Node): void => {
    // `t.<nazwa> = tool({ … })`
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      ts.isIdentifier(node.left.expression) &&
      node.left.expression.text === "t"
    ) {
      const name = node.left.name.text
      const set = byTool.get(name) ?? new Set<string>()
      collectInto(set, node.right)
      byTool.set(name, set)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return byTool
}

describe("czynność nie oddaje danych w próżnię", () => {
  it("każdy klucz zwracany z `step(...)` jest polem `StepResult`", () => {
    const known = new Set(stepResultFields(runtimeText))
    const strays = keysReturnedInSteps(runtimeText)
      .filter((one) => !known.has(one.key))
      .map((one) => `runtime.ts:${one.line} — \`${one.key}\``)
    expect(
      strays,
      "klucz spoza `StepResult` nigdzie nie dojdzie: `tsc` go przepuści (rozsypanie omija " +
        "sprawdzanie nadmiarowych pól), a `step()` przepisuje do zdarzenia wyłącznie pola, " +
        "które zna. Albo dopisz pole do typu i obsłuż je w `step()`, albo usuń klucz.",
    ).toEqual([])
  })

  /**
   * KONTROLA DODATNIA NA MECHANIZMIE, nie na tym, że plik się sparsował.
   *
   * Pierwsza wersja tego pliku sprawdzała „pól typu jest kilka, kluczy jest ponad dwadzieścia".
   * Recenzja zmierzyła, ile ochrony da się przy tym wyrzucić: wycięcie CAŁEJ obsługi rozsypania
   * — jedynego powodu, dla którego ten plik istnieje — nie ruszało ani jednego testu, bo przez
   * rozsypanie wchodzą w `runtime.ts` tylko dwie nazwy i obie występują też gdzie indziej jako
   * zwykłe właściwości. Dlatego dowód idzie teraz przez SZTUCZNE ŹRÓDŁO: każdy kształt, który
   * strażnik obiecuje widzieć, ma tu własny przypadek z podłożonym kluczem spoza typu.
   */
  it.each([
    ["zwykły zwrot", `return { summary: "s", answer: "a", produced: made }`],
    [
      "rozsypanie warunku",
      `return { summary: "s", answer: "a", ...(x ? { produced: made } : {}) }`,
    ],
    ["warunek w zwrocie", `return x ? { summary: "s", produced: made } : { summary: "s" }`],
    ["zmienna lokalna", `const out = { summary: "s", produced: made }; return out`],
  ])("widzi klucz spoza typu w kształcie: %s", (_what, body) => {
    const fake = `
      type StepResult = { ok?: boolean; summary: string; answer: string }
      const x = true
      const made: string[] = []
      step("t", "l", {}, async () => { ${body} })
    `
    const known = new Set(stepResultFields(fake))
    expect(
      keysReturnedInSteps(fake)
        .filter((one) => !known.has(one.key))
        .map((o) => o.key),
    ).toEqual(["produced"])
  })

  it("widzi klucz w skróconym ciele strzałki", () => {
    const fake = `
      type StepResult = { summary: string; answer: string }
      step("t", "l", {}, async () => ({ summary: "s", answer: "a", produced: [] }))
    `
    const known = new Set(stepResultFields(fake))
    expect(
      keysReturnedInSteps(fake)
        .filter((one) => !known.has(one.key))
        .map((o) => o.key),
    ).toEqual(["produced"])
  })

  it("milczy na kodzie bez usterki", () => {
    // Kontrola ujemna: strażnik, który zapala się zawsze, jest tak samo bezużyteczny
    // jak ten, który nie zapala się nigdy.
    const fake = `
      type StepResult = { ok?: boolean; summary: string; answer: string; discovered?: object }
      step("t", "l", {}, async () => ({ ok: true, summary: "s", answer: "a" }))
    `
    const known = new Set(stepResultFields(fake))
    expect(keysReturnedInSteps(fake).filter((one) => !known.has(one.key))).toEqual([])
  })
})

describe("karta czynności nie wskazuje na argument, którego nie ma", () => {
  /**
   * DLACZEGO. `evidence.ts` czyta argument PO NAZWIE (`a[c.inputs.arg]`, `a[c.outputs.arg]`,
   * `a[c.argName]`). Nazwa, która nie występuje w zdarzeniu, nie daje błędu — daje pusty
   * wiersz albo brak wiersza. Zmierzone na żywo: podmiana `made` na `wytworzone` w jednym
   * miejscu `runtime.ts` zostawiała cały pakiet testów zielony, a „Co powstało" wracało do
   * liczby bez nazw.
   */
  const perTool = argNamesPerTool(runtimeText)

  it("zna czynności z `runtime.ts`, a nie pustą mapę", () => {
    // Kontrola dodatnia: bez niej test niżej jest zielony także wtedy, gdy parser przestał
    // trafiać w `t.<nazwa> = tool({...})` i nie znalazł ANI JEDNEJ czynności.
    expect(perTool.size).toBeGreaterThan(8)
    expect([...(perTool.get("run_computation") ?? [])].sort()).toEqual(
      ["code", "description", "files", "made"].sort(),
    )
    expect(perTool.get("find_in_files")).toContain("matched")
  })

  it("każde `argName`, `inputs.arg` i `outputs.arg` istnieje w zdarzeniu tej czynności", () => {
    const strays: string[] = []
    for (const [name, card] of Object.entries(TOOL_CARDS)) {
      // Karty czynności spoza tego pliku (serwery MCP) nie mają jak być tu sprawdzone —
      // ich argumenty przychodzą ze schematu obcego serwera.
      const known = perTool.get(name)
      if (!known) continue
      for (const [where, arg] of [
        ["argName", card.argName],
        ["inputs.arg", card.inputs?.arg],
        ["outputs.arg", card.outputs?.arg],
      ] as const) {
        if (arg && !known.has(arg)) strays.push(`${name}.${where} = "${arg}"`)
      }
    }
    expect(
      strays,
      "karta wskazuje argument, którego zdarzenie tej czynności nie niesie — ani ze schematu " +
        "wejściowego, ani przez `discovered`. `evidence.ts` czyta go po nazwie, więc skutkiem " +
        "nie jest błąd, tylko cichy brak wiersza w dowodzie.",
    ).toEqual([])
  })
})
