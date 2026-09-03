// SZAFKA I DROGA DO USTAWIEŃ — dwie rzeczy, które cofną się po cichu, jeśli ich nie pilnować.
//
// Oba strażniki są STRUKTURALNE, nie wizualne, i to jest świadomy wybór. Nie pilnują
// wyglądu — od tego są scenariusze e2e. Pilnują dwóch warunków, których złamanie NIC NIE
// PSUJE: nic nie pęka, żaden ekran nie wygląda źle, po prostu produkt cicho wraca do stanu
// sprzed 03.09.2026 i nikt się o tym nie dowiada.

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const here = __dirname
const UI = path.resolve(here, "..")
const APP = path.resolve(here, "../../../desk-app/src")

const parse = (file: string) =>
  ts.createSourceFile(
    path.basename(file),
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

describe("most języka wisi na powłoce, nie na menu osoby", () => {
  /**
   * DLACZEGO. `useShellLocaleBridge()` synchronizuje język Biurka z powłoką. Do 03.09.2026
   * miał w całym repo JEDNO wywołanie i siedział w `persona-switcher.tsx` — czyli
   * w komponencie, który AKURAT stał na każdym ekranie. To był zbieg okoliczności,
   * nie decyzja, i przy przebudowie paska most zniknąłby ze wszystkich ekranów poza „Ja".
   *
   * Zniknąłby bezgłośnie: nic by nie pękło, powłoka po prostu zostałaby w poprzednim
   * języku. Stąd ten strażnik — hak ma mieć własne, jedno miejsce zamieszkania.
   */
  it("hak ma dokładnie jedno wywołanie i jest nim `locale-bridge.tsx`", () => {
    const callers: string[] = []
    const walk = (dir: string): void => {
      for (const entry of listing(dir)) {
        if (entry.isDirectory) walk(entry.full)
        else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
          const text = readFileSync(entry.full, "utf8")
          // Definicja haka NIE jest jego wywołaniem — szukamy nawiasu.
          if (/useShellLocaleBridge\(\)/.test(text) && !/export function useShellLocaleBridge/.test(text))
            callers.push(path.relative(UI, entry.full))
        }
      }
    }
    walk(UI)
    expect(callers).toEqual(["components/locale-bridge.tsx"])
  })

  it("powłoka naprawdę go montuje", () => {
    // Drugi bok tej samej reguły: własne miejsce zamieszkania nic nie daje, jeśli nikt
    // tam nie zagląda. Bez tego wiersza pierwszy test byłby zielony także wtedy, gdyby
    // most nie był renderowany nigdzie.
    expect(readFileSync(path.join(UI, "components/shell.tsx"), "utf8")).toContain("<LocaleBridge />")
  })
})

describe("droga do ustawień nie zależy od trybu pokazu", () => {
  /**
   * NAJWAŻNIEJSZY STRAŻNIK Z TEJ PRZEBUDOWY, bo pilnuje błędu, który przez cały czas
   * istnienia produktu nie dał ANI JEDNEGO zgłoszenia — nie ma jak zgłosić czegoś,
   * czego się nie znalazło.
   *
   *     szerokość ≥768 px            telefon <768 px
   *     pasek boczny: jest           pasek boczny: SCHOWANY (`md:flex`)
   *       └ język ✔                    └ język niedostępny
   *     ekran „Ja": —                ekran „Ja": jest
   *       └ ustawienia POD `switchable`, a `identity()` zwraca tam FAŁSZ wszędzie,
   *         gdzie tożsamość ustala brama logowania — czyli u KAŻDEGO klienta
   *
   * Wychodziło z tego, że pracownica z telefonem nie mogła zmienić języka w ogóle.
   * `switchable` rządzi wyłącznie przełączaniem osób, które jest funkcją POKAZU.
   * Ustawienia nie są funkcją pokazu.
   */
  it("okno ustawień na ekranie „Ja” nie stoi pod żadnym warunkiem", () => {
    const source = parse(path.join(APP, "pages/me.tsx"))
    const offenders: string[] = []
    const visit = (node: ts.Node, guards: string[]): void => {
      // Wyrażenie `warunek && <coś/>` — dokładnie ta forma, w której siedział błąd.
      const next =
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
          ? [...guards, node.left.getText()]
          : guards
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        if (node.tagName.getText() === "SettingsDialog" && next.length > 0) {
          offenders.push(next.join(" && "))
        }
      }
      ts.forEachChild(node, (child) => visit(child, next))
    }
    visit(source, [])
    expect(
      offenders,
      "ustawienia znów są warunkowe — a to jedyna droga do języka na telefonie",
    ).toEqual([])
  })

  it("i naprawdę tam są", () => {
    // Kontrola dodatnia: test wyżej jest zielony także wtedy, gdy okna nie ma wcale.
    expect(readFileSync(path.join(APP, "pages/me.tsx"), "utf8")).toContain("<SettingsDialog")
  })
})

/** Płaskie listowanie katalogu, z rozróżnieniem plik/katalog. */
function listing(dir: string) {
  return readdirSync(dir, { withFileTypes: true }).map((one) => ({
    name: one.name,
    full: path.join(dir, one.name),
    isDirectory: one.isDirectory(),
  }))
}
