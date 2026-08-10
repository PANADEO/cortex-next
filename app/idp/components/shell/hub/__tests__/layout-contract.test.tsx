// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MessagesSquare } from "lucide-react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PRESETS, type PresetVariants } from "@/lib/presets/registry"
import type { Tile } from "@/lib/tiles"
import { HUB_LAYOUTS } from "../registry"
import type { HubModel } from "../types"

// Bramka z §4 projektu presetów: "dopisujesz layout → albo przechodzi cały
// zestaw, albo nie wchodzi do HUB_LAYOUTS". Test jest sparametryzowany po
// rejestrze, więc trzeci layout obejmuje automatycznie — nie ma tu listy do
// zaktualizowania i nie da się dołożyć wpisu, który go omija.
//
// Layout dostaje `HubModel` PROPSEM, więc model jest tu zwykłym literałem, bez
// mockowania `@cortex/api`, Postgresa i store'ów. To nie jest wygoda testu:
// to obserwowalny skutek rozdzielenia warstw z D4 i jedyny powód, dla którego
// ten zestaw da się trzymać przy N layoutach.
//
// OD E4 BRAMKA JEST ILOCZYNEM: layout × wiązka wariantów. Wariant przychodzi z
// presetu, a nie z layoutu (patrz `HubLayoutProps`), więc każda para jest
// osiągalna — wystarczy preset, który je zestawi. Zestaw sprawdzający wyłącznie
// „parę naturalną" (`classic`+`card`, `masthead`+`chiclet`) przepuściłby
// wariant, który gubi gwiazdkę ulubionych albo licznik, dopóki nikt nie złożyłby
// tej kombinacji — czyli dokładnie wtedy, gdy D3 obiecuje, że warstwy są
// niezależne.

/** Wiązki obecne w rejestrze presetów, odsiane do UNIKALNYCH: `neutral` i
 *  `customs` mają tę samą, więc bez odsiania te same testy biegłyby dwa razy. */
const VARIANT_BUNDLES: ReadonlyArray<readonly [string, PresetVariants]> = [
  ...new Map(
    Object.values(PRESETS).map(
      (preset) => [`${preset.variants.tabs}+${preset.variants.tile}`, preset.variants] as const,
    ),
  ),
]

const CASES = Object.entries(HUB_LAYOUTS).flatMap(([id, Layout]) =>
  VARIANT_BUNDLES.map(([bundle, variants]) => [`${id} × ${bundle}`, Layout, variants] as const),
)

function tile(id: string, label: string): Tile {
  return {
    id,
    label,
    description: `Opis ${label}`,
    href: `/${id}`,
    icon: MessagesSquare,
    iconBg: "bg-violet-200",
    iconFg: "text-violet-700",
    categoryFunctional: "agents",
    categoryDepartment: ["it"],
    archetype: "task-chat",
  }
}

const TILES = [tile("alfa", "Alfa"), tile("beta", "Beta")]

interface Spies {
  onSelect: ReturnType<typeof vi.fn>
  toggleFavorite: ReturnType<typeof vi.fn>
  clearFilters: ReturnType<typeof vi.fn>
}

function makeModel(spies: Spies, overrides: Partial<HubModel> = {}): HubModel {
  return {
    tiles: TILES,
    categories: [
      { id: "agents", label: "Agenci", count: 1 },
      { id: "research", label: "Badania", count: 1 },
    ],
    favorites: ["alfa"],
    counts: { authorized: 5, matching: 2, categories: 2, favorites: 1 },
    search: { value: "", set: vi.fn() },
    view: { value: "functional", set: vi.fn() },
    activeCategory: { value: "all", set: spies.onSelect },
    categoryTagFor: () => "Agenci",
    toggleFavorite: spies.toggleFavorite,
    clearFilters: spies.clearFilters,
    state: "ready",
    ...overrides,
  }
}

afterEach(cleanup)

describe.each(CASES)("kontrakt layoutu huba: %s", (_name, Layout, variants) => {
  const spies = (): Spies => ({
    onSelect: vi.fn(),
    toggleFavorite: vi.fn(),
    clearFilters: vi.fn(),
  })

  it("renderuje wyłącznie kafelki z modelu", () => {
    const s = spies()
    render(<Layout model={makeModel(s)} variants={variants} />)

    const links = screen.getAllByRole("link")
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/alfa", "/beta"])
    // Layout nie ma prawa dołożyć kafelka spoza modelu ani żadnego pominąć —
    // filtrowanie jest w całości robotą warstwy 0.
    expect(links).toHaveLength(TILES.length)
  })

  it("pokazuje stan pusty z akcją czyszczenia filtrów", async () => {
    const s = spies()
    render(<Layout model={makeModel(s, { tiles: [] })} variants={variants} />)

    expect(screen.getByText("Nie znaleziono aplikacji")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Wyczyść filtry" }))
    expect(s.clearFilters).toHaveBeenCalledTimes(1)
  })

  it("każdy tab kategorii jest osiągalny z klawiatury i woła onSelect", async () => {
    const s = spies()
    render(<Layout model={makeModel(s)} variants={variants} />)

    // Enter na sfokusowanym przycisku, nie `click()` — tab zrobiony na <div>
    // z `onClick` przeszedłby test klikany i wywalił się dopiero u użytkownika
    // klawiatury.
    for (const [i, label] of ["Agenci", "Badania"].entries()) {
      const tab = screen.getByRole("button", { name: new RegExp(`^${label}`) })
      tab.focus()
      expect(tab).toHaveFocus()
      await userEvent.keyboard("{Enter}")
      expect(s.onSelect).toHaveBeenNthCalledWith(i + 1, ["agents", "research"][i])
    }
  })

  it("gwiazdka ulubionych ma aria-pressed i nie nawiguje", async () => {
    const s = spies()
    render(<Layout model={makeModel(s)} variants={variants} />)

    const star = screen.getByRole("button", { name: "Usuń Alfa z ulubionych" })
    expect(star).toHaveAttribute("aria-pressed", "true")
    // Druga gwiazdka to kafelek spoza ulubionych — dowód, że `aria-pressed`
    // odzwierciedla stan, a nie jest wpisane na sztywno.
    expect(screen.getByRole("button", { name: "Dodaj Beta do ulubionych" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )

    // Gwiazdka siedzi WEWNĄTRZ <a> kafelka, więc bez zabezpieczenia klik w nią
    // nawigowałby zamiast przełączać ulubione. Sprawdzane na zdarzeniu, bo
    // jsdom nawigacji i tak nie wykona — sam brak błędu niczego nie dowodzi.
    //
    // Natywne zdarzenie łapane na <a>, ale odczytywane DOPIERO PO kliknięciu.
    // React montuje swoje listenery na korzeniu, więc handler gwiazdki biegnie
    // PÓŹNIEJ niż listener na kafelku — sprawdzanie `defaultPrevented` w środku
    // listenera odczytałoby stan sprzed `preventDefault()` i test byłby czerwony
    // na działającym kodzie. `stopPropagation()` z handlera też tu nie pomaga:
    // zatrzymuje propagację syntetyczną, a natywna i tak dochodzi — i to
    // natywne domyślne działanie <a> jest tym, co realnie nawiguje.
    let clicked: MouseEvent | null = null
    const anchor = screen.getAllByRole("link")[0]!
    anchor.addEventListener("click", (e) => {
      clicked = e as MouseEvent
    })
    await userEvent.click(star)

    expect(s.toggleFavorite).toHaveBeenCalledWith("alfa")
    expect(clicked, "klik nie dotarł do kafelka — test nie bada tego, co miał").not.toBeNull()
    expect(clicked!.defaultPrevented).toBe(true)
  })
})
