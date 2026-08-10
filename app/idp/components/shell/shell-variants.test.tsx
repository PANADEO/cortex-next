// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { AppShell, TileMenu } from "@cortex/ui"
import { cleanup, render } from "@testing-library/react"
import { LayoutDashboard } from "lucide-react"
import { afterEach, describe, expect, it } from "vitest"
import { PRESETS } from "@/lib/presets/registry"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")

/**
 * Strażnik warstwy 2 dla POWŁOKI (sidebar/topbar/stopka).
 *
 * DLACZEGO ISTNIEJE. Przy hubie ten sam krok wyprodukował defekt, którego nie
 * złapał ŻADEN z dwóch przeglądów: E1 przeniósł DOM Cezarego do layoutu
 * `classic`, przez co wygląd sprzed redesignu przestał istnieć w repo — bo
 * nikt nie porównał wyniku z wersją SPRZED zmiany. Asercje dla wariantu
 * `plain` są tu spisane z kodu SPRZED wprowadzenia wariantów i mają przeżyć
 * refaktor bez jednej poprawki; ich zielony stan JEST dowodem braku regresji
 * Neutrala, a nie ozdobą.
 *
 * Drugi strażnik (`nie wprowadza twardych klas palety`) pilnuje maszynowo
 * reguły, przez którą poprzednie podejście trafiło do rewertu: `ef85991`
 * wymieniał klasy tokenowe na ręczny CSS `ch-*`, kodujący JEDEN wygląd i
 * blokujący istnienie drugiego presetu obok.
 */

const SECTIONS = [
  {
    id: "praca",
    label: "Praca",
    items: [
      { id: "start", label: "Start", icon: LayoutDashboard, href: "/start" },
      { id: "inne", label: "Inne", icon: LayoutDashboard, href: "/inne", badge: 3 },
    ],
  },
]

/**
 * Kolor wpisany na sztywno zamiast tokena — czyli taki, którego skin nie
 * przemaluje.
 *
 * Zakres świadomie szerszy, niż podpowiada pierwszy odruch, bo każde
 * z poniższych przepuściła pierwsza wersja tego wzorca: `bg-white` i
 * `text-black` (nie mają sufiksu liczbowego, a są najbardziej nieprzemalowalne
 * ze wszystkich), oraz rodziny `from-`/`via-`/`to-`/`outline-`/`divide-`/
 * `stroke-`/`accent-`/`decoration-`, których w ogóle nie wymieniała.
 */
const HARDCODED_PALETTE = new RegExp(
  String.raw`\b(?:bg|text|border|fill|ring|shadow|from|via|to|outline|divide|stroke|accent|decoration|caret)-` +
    String.raw`(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|` +
    String.raw`emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)` +
    String.raw`(?:-\d{2,3})?\b`,
)

/**
 * Cztery pliki, które składają się na powłokę. Skan ŹRÓDŁA, nie renderu, bo
 * render pokrywa wyłącznie to, co harness zamontuje — a `topbar.tsx`
 * i `version-label.tsx` wymagałyby dostawców i sieci, więc w teście
 * renderującym powłokę stoją jako atrapy. Review wykazał mutacją, że przez tę
 * dziurę `bg-amber-500` w polu szukania i `text-amber-600` w etykiecie wersji
 * przechodziły na zielono.
 */
const SHELL_SOURCES = [
  "packages/@cortex/ui/src/components/app-shell.tsx",
  "packages/@cortex/ui/src/components/tile-menu.tsx",
  "app/idp/components/topbar.tsx",
  "app/idp/components/shell/version-label.tsx",
]

afterEach(cleanup)

function renderShell(variant: "plain" | "ruled", collapsed = false) {
  return render(
    <AppShell
      variant={variant}
      sidebarCollapsed={collapsed}
      sidebar={
        <TileMenu
          variant={variant}
          sections={SECTIONS}
          activeItemId="start"
          collapsed={collapsed}
          footerSlot={<span>stopka</span>}
        />
      }
      topbar={<span>topbar</span>}
    >
      <div>treść</div>
    </AppShell>,
  )
}

/** Pozycja NIEAKTYWNA — czyli stan, w którym jest większość pozycji menu.
 *  Pierwsza wersja tego pliku pytała wyłącznie o `[aria-current="page"]`,
 *  więc wyzerowanie tej gałęzi (razem z kolorem tekstu i całym hoverem)
 *  przechodziło na zielono. */
function inactiveLink(container: HTMLElement): Element | null {
  return container.querySelector('nav a:not([aria-current="page"])')
}

/** Zbiór klas elementu, posortowany. Porównujemy ZBIORY, nie napisy: CVA
 *  dokleja klasy wariantu na końcu, więc kolejność w atrybucie się zmienia,
 *  choć wynik wizualny jest identyczny (o pierwszeństwie decyduje kolejność
 *  reguł w arkuszu, nie w `class`). Asercja na podciąg wywracałaby się na
 *  przestawieniu bez znaczenia — i wywróciła się, zanim to poprawiłem. */
function classSet(el: Element | null | undefined): string[] {
  return (el?.className ?? "").split(/\s+/).filter(Boolean).sort()
}

describe("powłoka — wariant plain nie rusza wyglądu sprzed zmiany", () => {
  // Każda z tych list to KOMPLET klas elementu, przepisany z wersji sprzed
  // wprowadzenia wariantów. Porównanie jest na równość, nie na zawieranie:
  // klasa dołożona przypadkiem jest tu tak samo błędem jak zgubiona.
  //
  // JEDYNE ODSTĘPSTWO od wersji sprzed zmiany: `motion-reduce:transition-none`.
  // Dołożone ŚWIADOMIE i celowo także do Neutrala — to ustawienie dostępności
  // użytkownika, nie cecha wyglądu, więc obowiązuje wszystkie presety. Ten test
  // wyłapał tę zmianę na czerwono i o to w nim chodzi: każde inne odstępstwo
  // ma być tak samo widoczne, a nie przemycone.
  it("aside i nagłówek mają dokładnie ten sam komplet klas", () => {
    const { container } = renderShell("plain")

    expect(classSet(container.querySelector("aside"))).toEqual(
      [
        "hidden", "shrink-0", "border-r", "border-sidebar-border", "bg-sidebar",
        "text-sidebar-foreground", "transition-[width]", "duration-200", "motion-reduce:transition-none",
        "md:flex", "md:flex-col", "w-sidebar",
      ].sort(),
    )

    expect(classSet(container.querySelector("header"))).toEqual(
      [
        "flex", "h-header", "shrink-0", "items-center", "gap-3",
        "border-b", "border-border", "bg-background", "px-4",
      ].sort(),
    )
  })

  it("pozycja aktywna, etykieta sekcji i stopka mają dokładnie ten sam komplet klas", () => {
    const { container } = renderShell("plain")

    expect(classSet(container.querySelector('[aria-current="page"]'))).toEqual(
      [
        "group", "flex", "h-8", "items-center", "rounded-md", "text-sm",
        "transition-colors", "motion-reduce:transition-none", "gap-2.5", "px-2",
        "bg-sidebar-accent", "text-sidebar-accent-foreground", "font-medium",
      ].sort(),
    )

    expect(classSet(container.querySelector("nav p"))).toEqual(
      [
        "mb-2", "px-2", "text-[10px]", "font-semibold", "uppercase",
        "tracking-wider", "text-muted-foreground",
      ].sort(),
    )

    // Stopka menu — jedyny element z separatorem `border-t` w tym drzewie.
    expect(classSet(container.querySelector(".border-t"))).toEqual(
      ["border-t", "border-sidebar-border", "p-3"].sort(),
    )
  })

  /**
   * Stan spoczynkowy to nie cały wygląd. Przy E1b aparatura raportowała
   * „24/24 identyczne" dla drzewa z WYCIĘTYMI regułami `hover`/`focus`, bo
   * mierzyła wyłącznie stan spoczynkowy — i projekt tej zmiany wymienia to
   * wprost jako ryzyko. Klasy `hover:` żyją w atrybucie `class`, więc
   * porównanie kompletu obejmuje je bez symulowania wskaźnika.
   */
  it("pozycja nieaktywna zachowuje kolor tekstu i komplet reguł hover", () => {
    const { container } = renderShell("plain")

    expect(classSet(inactiveLink(container))).toEqual(
      [
        "group", "flex", "h-8", "items-center", "rounded-md", "text-sm",
        "transition-colors", "motion-reduce:transition-none", "gap-2.5", "px-2",
        "text-sidebar-foreground/80",
        "hover:bg-sidebar-accent", "hover:text-sidebar-accent-foreground",
      ].sort(),
    )
  })

  // Tryb zwinięty nie miał w repo ŻADNEGO pokrycia — ani tu, ani nigdzie
  // indziej, a to jedyny test renderujący te dwa komponenty. Refaktor na CVA
  // mógł zgubić klasy tej gałęzi bez jednego czerwonego testu.
  it("tryb zwinięty zachowuje dokładnie ten sam komplet klas", () => {
    const { container } = renderShell("plain", true)

    expect(classSet(container.querySelector("aside"))).toEqual(
      [
        "hidden", "shrink-0", "border-r", "border-sidebar-border", "bg-sidebar",
        "text-sidebar-foreground", "transition-[width]", "duration-200", "motion-reduce:transition-none",
        "md:flex", "md:flex-col", "w-sidebar-icon",
      ].sort(),
    )

    expect(classSet(container.querySelector('[aria-current="page"]'))).toEqual(
      [
        "group", "flex", "h-8", "items-center", "rounded-md", "text-sm",
        "transition-colors", "motion-reduce:transition-none", "justify-center", "px-0",
        "bg-sidebar-accent", "text-sidebar-accent-foreground", "font-medium",
      ].sort(),
    )
  })
})

describe("powłoka — wariant ruled", () => {
  it("krawędzie są grubsze i rysowane atramentem sidebara", () => {
    const { container } = renderShell("ruled")

    const aside = container.querySelector("aside")
    expect(aside?.className).toContain("border-r-2")
    expect(aside?.className).toContain("border-sidebar-border")

    const header = container.querySelector("header")
    expect(header?.className).toContain("border-b-2")
  })

  it("pozycja aktywna to wypełnienie akcentem obwiedzione atramentem", () => {
    const { container } = renderShell("ruled")

    const active = container.querySelector('[aria-current="page"]')
    expect(active?.className).toContain("bg-chart-1")
    expect(active?.className).toContain("text-chart-1-foreground")
    expect(active?.className).toContain("border-sidebar-border")
  })

  /**
   * Promień MUSI zostać w warstwie 1 i to jest asercja o architekturze, nie o
   * wyglądzie. `rounded-md` rozwija się przez `--radius-md`, a `.skin-domino`
   * ustawia ten token na 2px — twarda krawędź przychodzi więc z palety, nie z
   * wariantu. Pierwsza wersja tego testu wymagała USUNIĘCIA `rounded-md` w
   * `ruled`; byłoby to przeniesienie decyzji o kształcie krawędzi na warstwę 2
   * i rozdwojenie źródła promienia — dokładnie ten rozjazd, którego cały ten
   * podział ma nie dopuszczać.
   */
  it("promień pozostaje sterowany tokenem, nie wariantem", () => {
    const plain = renderShell("plain").container.querySelector('[aria-current="page"]')
    cleanup()
    const ruled = renderShell("ruled").container.querySelector('[aria-current="page"]')

    expect(plain?.className).toContain("rounded-md")
    expect(ruled?.className).toContain("rounded-md")
  })

  it("etykieta sekcji jest monospace'owa i w kolorze akcentu paska", () => {
    const { container } = renderShell("ruled")

    const label = container.querySelector("nav p")
    expect(label?.className).toContain("font-mono")
    expect(label?.className).toContain("text-sidebar-primary")
    expect(label?.className).toContain("uppercase")
  })
})

describe("powłoka — reguła warstw", () => {
  // Parametryzacja po REJESTRZE, nie po ręcznej liście wariantów: preset
  // dopisany bez wariantu powłoki wywali się tutaj, a nie u użytkownika.
  it.each(Object.values(PRESETS).map((preset) => [preset.id, preset.variants.shell] as const))(
    "preset %s renderuje powłokę bez ani jednej twardej klasy palety",
    (_id, shell) => {
      const { container } = renderShell(shell)
      const found = container.innerHTML.match(HARDCODED_PALETTE)
      expect(found, `powłoka wypisała klasę z palety: ${found?.[0]}`).toBeNull()
    },
  )

  /**
   * Ustawienie systemowe „ogranicz ruch" ma być respektowane przez OBA
   * warianty — to dostępność użytkownika, nie cecha wyglądu. Stąd asercja
   * parametryzowana po presetach, a nie jednorazowa.
   *
   * Oryginał Cezarego niósł to jako osobny blok `@media (prefers-reduced-motion)`
   * wyłączający przejścia linku menu i pola szukania. Tu ta sama reguła
   * wyrażona narzędziem Tailwinda, w BAZIE tabel — plus animacja szerokości
   * sidebara, której tamten blok nie obejmował (bo tamta wersja usuwała ją
   * całkowicie). Ona jest z tych trzech najbardziej dotkliwa: rusza szerokością,
   * więc przesuwa całą treść obok.
   */
  it.each(Object.values(PRESETS).map((preset) => [preset.id, preset.variants.shell] as const))(
    "preset %s wyłącza przejścia przy prefers-reduced-motion",
    (_id, shell) => {
      const { container } = renderShell(shell)

      expect(classSet(container.querySelector("aside"))).toContain("motion-reduce:transition-none")
      expect(classSet(inactiveLink(container))).toContain("motion-reduce:transition-none")
    },
  )

  // Drugi strażnik tej samej reguły, obejmujący pliki, których render powyżej
  // nie montuje. Skan pomija komentarze — te niosą realną treść i wymieniają
  // nazwy klas z premedytacją (np. uzasadnienie odrzucenia `ch-*`).
  it.each(SHELL_SOURCES)("źródło %s nie zawiera twardej klasy palety", (relative) => {
    const source = readFileSync(path.join(repoRoot, relative), "utf8")
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")

    const found = withoutComments.match(HARDCODED_PALETTE)
    expect(found, `${relative} niesie klasę z palety: ${found?.[0]}`).toBeNull()
  })
})
