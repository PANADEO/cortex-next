// Trasa, która decyduje o dostępie, NIE MOŻE mieć ekranu przejściowego.
//
// DLACZEGO. `loading.tsx` strumieniuje się, zanim komponent serwerowy zdąży odmówić —
// status odpowiedzi jest przesądzony na 200, zanim padnie decyzja o roli. Zmierzone:
// po dodaniu `loading.tsx` do `/supervision` ekran przełożonego zaczął zwracać pracownicy
// **200 zamiast 404**. Treści dalej nie było, ale kod odpowiedzi kłamał — a to jest
// dokładnie ta informacja, na której opiera się i test, i każdy audyt.
//
// Ten strażnik pilnuje TRASY, a nie komponentu, bo błąd polega na dołożeniu pliku obok,
// nie na zmianie kodu ekranu. Zwykły test tego nie zobaczy.
//
// I pilnuje KATALOGÓW NADRZĘDNYCH, bo to była druga połowa pomyłki: `loading.tsx`
// w korzeniu tras obejmuje wszystko poniżej. Usunięcie go z samego `/supervision`
// NIE przywróciło 404 — dopóki plik stał w korzeniu, granica strumieniowania i tak
// obejmowała ekran przełożonego.

import { readdirSync, readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO = path.resolve(__dirname, "../../../../..")

/** Oba montowania Biurka: samodzielne i jako kafelek powłoki. */
const ROUTE_ROOTS = [
  path.join(REPO, "apps/desk/src/app"),
  path.join(REPO, "app/idp/app/(desk)/desk"),
]

/** Ekrany, których treść zależy od roli albo od własności sprawy. */
const GATES = /notFound\(\)|redirect\(/

function pageSources(): { page: string; dir: string }[] {
  const out: { page: string; dir: string }[] = []
  const walk = (dir: string) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === "page.tsx") out.push({ page: full, dir })
    }
  }
  for (const root of ROUTE_ROOTS) walk(root)
  return out
}

/** Strona kafelka jest cienka i deleguje do `desk-app/src/pages` — czytamy jedno i drugie. */
function guardedSource(page: string): string {
  const own = readFileSync(page, "utf8")
  const delegated = own.match(/from "@cortex\/desk-app\/pages\/([\w-]+)"/)
  if (!delegated) return own
  const target = path.join(REPO, "packages/@cortex/desk-app/src/pages", `${delegated[1]}.tsx`)
  return existsSync(target) ? own + readFileSync(target, "utf8") : own
}

describe("ekran przejściowy a decyzja o dostępie", () => {
  const pages = pageSources()

  it("w ogóle znajduje trasy Biurka", () => {
    // Bez tego cały plik mógłby być zielony dlatego, że nic nie sprawdził.
    expect(pages.length).toBeGreaterThan(8)
  })

  it.each(pages.map((p) => [path.relative(REPO, p.page), p]))(
    "%s: gdy decyduje o dostępie, nie ma loading.tsx",
    (_name, { dir, page }) => {
      if (!GATES.test(guardedSource(page))) return
      const root = ROUTE_ROOTS.find((r) => dir.startsWith(r))!
      // Od katalogu trasy w górę, aż do korzenia tras włącznie.
      for (let at = dir; ; at = path.dirname(at)) {
        const loading = path.join(at, "loading.tsx")
        expect(
          existsSync(loading),
          `${path.relative(REPO, loading)} istnieje i obejmuje trasę decydującą o dostępie — ` +
            "ekran przejściowy przesądzi status na 200, zanim padnie odmowa",
        ).toBe(false)
        if (at === root) break
      }
    },
  )
})
