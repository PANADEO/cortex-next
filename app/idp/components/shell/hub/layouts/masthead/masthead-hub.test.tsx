// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import type { HubTile } from "@cortex/api"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// Layout `masthead` jest od E4 osiągalny z przełącznika (preset `domino`), ale
// NIE jest domyślny, więc `authed-home.test.tsx` go nie dotyka. Test montuje go
// bezpośrednio na prawdziwym `useHubModel()`, bo pilnowane niżej liczniki są
// własnością pary model+layout, nie samego markupu.

let authorizedMock = {
  allowed: true,
  apps: ["ai-tools"] as string[],
  email: "u@x.com",
  isLoading: false,
  isError: false,
}

function hubRow(partial: { code: string; name: string } & Partial<HubTile>) {
  return {
    id: partial.code,
    description: null,
    icon: null,
    kind: "native" as const,
    route: `/${partial.code}`,
    url: null,
    target: null,
    isActive: true,
    sortOrder: 0,
    showOnHub: true,
    color: null,
    categoryFunctional: null,
    categoryDepartment: null,
    activatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  }
}

const HUB_TILES_FIXTURE = [
  hubRow({ code: "text-highlighter", name: "Podświetlacz tekstu", route: "/ai-tools/text-highlighter" }),
  hubRow({ code: "text-transformer", name: "Transformator tekstu", route: "/ai-tools/text-transformer" }),
  hubRow({ code: "fakturomat", name: "Analizator faktur", route: "/ai-tools/fakturomat" }),
]

let hubTilesMock = { tiles: HUB_TILES_FIXTURE as HubTile[], isLoading: false, isError: false }

vi.mock("@cortex/api", () => ({
  useAuthorizedApps: () => authorizedMock,
  useHubTiles: () => hubTilesMock,
}))

vi.mock("@/features/cortex-cowork", () => ({
  useCoworkProjectTiles: () => ({ tiles: [], projects: [], isLoading: false }),
}))

import { DEFAULT_PRESET, PRESETS } from "@/lib/presets/registry"
import { HUB_LAYOUTS } from "../../registry"
import { useHubModel } from "../../use-hub-model"
import { MastheadHub } from "./index"

/** Layout na żywym modelu — bez `AuthedHome`, który renderuje layout presetu
 *  domyślnego, czyli `classic`. Warianty brane z presetu `domino`, a nie
 *  wpisane tu literałem: to jest jedyna wiązka, z jaką ten layout realnie się
 *  spotyka, i gdyby ktoś ją w rejestrze zmienił, test ma mierzyć zmianę, a nie
 *  własną kopię sprzed niej. */
function Harness() {
  return <MastheadHub model={useHubModel()} variants={PRESETS.domino.variants} />
}

afterEach(() => {
  cleanup()
  authorizedMock = {
    allowed: true,
    apps: ["ai-tools"],
    email: "u@x.com",
    isLoading: false,
    isError: false,
  }
  hubTilesMock = { tiles: HUB_TILES_FIXTURE as HubTile[], isLoading: false, isError: false }
})

describe("layout huba: masthead", () => {
  // Bez `toEqual` na tablicy kluczy: to przypinałoby KOLEJNOŚĆ wstawiania, a
  // trzeci layout w E3/E5 albo posortowanie rejestru wywaliłyby test, który o
  // kolejności nie ma nic do powiedzenia. Pytanie brzmi "czy masthead jest
  // zarejestrowany i czy nadal nie jest domyślny", i tylko to jest tu badane.
  it("jest w rejestrze i wskazuje go Domino, ale domyślnym layoutem zostaje `classic`", () => {
    expect(new Set(Object.keys(HUB_LAYOUTS))).toContain("masthead")
    expect(PRESETS.domino.hubLayout).toBe("masthead")
    // E4 wypuszcza przełącznik, ale NIE zmienia wartości domyślnej: instancja,
    // która niczego nie wybrała, ma po wdrożeniu wyglądać tak samo jak przed.
    // Zmiana tej linii to decyzja właściciela instancji (E5), nie skutek
    // uboczny dołożenia wyglądu.
    expect(PRESETS[DEFAULT_PRESET].hubLayout).toBe("classic")
  })

  // Hub pokazuje DWIE różne liczby kafelków naraz: masthead liczy cały katalog,
  // do którego user ma grant, a zakładka "Wszystkie" — to, co przeszło przez
  // szukajkę (HubCounts.authorized vs HubCounts.matching, hub/types.ts).
  //
  // Scenariusz MUSI mieć niepustą szukajkę zawężającą wynik. Przy pustej obie
  // liczby są z definicji równe, więc test bez wpisanego zapytania przechodzi
  // także wtedy, gdy layout poda je sobie nawzajem zamienione miejscami —
  // czyli nie pilnuje niczego. Zamiana `counts.authorized` z `counts.matching`
  // w layoucie ma ten test wywalić i to jest jego jedyne zadanie.
  it("masthead liczy katalog z grantem, a zakładka wynik szukania — to dwie różne liczby", async () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText("Szukaj aplikacji"), {
      target: { value: "Analizator" },
    })

    // 3 kafelki ai-tools w katalogu, 1 pasuje do zapytania.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Wszystkie aplikacje" }).textContent).toBe(
        "Wszystkie 1",
      )
    })
    expect(meterText()).toBe("Narzędzia: 3 · Kategorie: 0")
  })

  // Cztery rzeczy, które `classic` pod wariantem `card` renderuje inaczej albo
  // wcale, a które składają się na chiclet: akcent z hasha kategorii, kaskada
  // wejścia, mikroetykieta i krawędź panelu, w którą wtapiają się zakładki.
  //
  // Kafelki fixture'u mają `categoryFunctional: null` i to jest tu WARUNEK
  // TESTU, nie skutek uboczny: dokładnie tak wygląda `document-parser` i
  // `visual-guru` na standardowej instancji (§5b), a wersja `accentFor`
  // z `main` wołała `.length` na tej wartości. Akcent 1 znaczy więc „przeszło
  // przez ścieżkę pustej kategorii", a nie „hash przypadkiem trafił w 1".
  it("renderuje chiclet — akcent, kaskada, mikroetykieta, krawędź panelu", () => {
    const { container } = render(<Harness />)

    const chiclets = screen.getAllByRole("link")
    expect(chiclets[0]).toHaveClass("min-h-tile", "animate-tile-in")
    expect(container.querySelector(".bg-chart-1")).not.toBeNull()

    // Kaskada: 28 ms na pozycję. Drugi kafelek dowodzi, że opóźnienie zależy od
    // indeksu — samo zero na pierwszym przeszłoby też przy braku kaskady.
    expect(chiclets[0]?.getAttribute("style")).toContain("animation-delay: 0ms")
    expect(chiclets[1]?.getAttribute("style")).toContain("animation-delay: 28ms")

    // `prefers-reduced-motion` obsługuje wariant Tailwinda na tym samym
    // elemencie, nie osobna reguła w arkuszu — bez nazwy animacji opóźnienie
    // inline nie ma czego opóźniać.
    expect(chiclets[0]).toHaveClass("motion-reduce:animate-none")

    // Mikroetykieta kategorii jest pusta dla kafelka bez kategorii, więc badany
    // jest WĘZEŁ, nie tekst — obecność samego tekstu nie odróżniłaby chicletu
    // od karty.
    expect(container.querySelector(".tracking-label")).not.toBeNull()
    expect(container.querySelector("section.border-t-token")).not.toBeNull()
  })

  // Design Cezarego jechał na ~60 regułach `.ch-*` zakresowanych `.cortex-home`.
  // E4 rozłożył je na tokeny i warianty CVA — a to znaczy, że ani jedna z tych
  // nazw nie ma prawa zostać. Klasa `ch-*`, która przetrwała, jest martwa:
  // arkusz nie ma dla niej reguły i nigdy nie będzie miał.
  it("nie zostaje ani jedna klasa `ch-*` — nie ma dla nich reguł w arkuszu", () => {
    const { container } = render(<Harness />)

    const leftovers = [...container.querySelectorAll("[class]")].filter((el) =>
      [...el.classList].some((token) => token.startsWith("ch-")),
    )

    expect(leftovers.map((el) => el.className)).toEqual([])
  })
})

/** Tekst licznika w mastheadzie. Zakotwiczony regex, bo `getByText` dopasowuje
 *  po `textContent` — bez kotwic trafiałby też w każdego przodka tego spana. */
function meterText(): string {
  const meter = screen.getByText((_content, element) =>
    /^Narzędzia: \d+ · Kategorie: \d+$/.test(element?.textContent ?? ""),
  )
  return meter.textContent ?? ""
}
