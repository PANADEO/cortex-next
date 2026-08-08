// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import type { HubTile } from "@cortex/api"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// Layout `masthead` jest do E3 nieosiągalny w aplikacji (`DEFAULT_HUB_LAYOUT`
// wskazuje `classic`), więc bez tego pliku jego DOM nie byłby renderowany
// NIGDZIE — a zaparkowany kod, którego nic nie uruchamia, gnije po cichu.
// Test montuje go bezpośrednio na prawdziwym `useHubModel()`, bo pilnowane
// niżej liczniki są własnością pary model+layout, nie samego markupu.

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

import { DEFAULT_HUB_LAYOUT, HUB_LAYOUTS } from "../../registry"
import { useHubModel } from "../../use-hub-model"
import { MastheadHub } from "./index"

/** Layout na żywym modelu — bez `AuthedHome`, który do E3 zna tylko `classic`. */
function Harness() {
  return <MastheadHub model={useHubModel()} />
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
  it("jest w rejestrze, ale nieosiągalny — domyślnym layoutem zostaje `classic`", () => {
    expect(new Set(Object.keys(HUB_LAYOUTS))).toContain("masthead")
    expect(DEFAULT_HUB_LAYOUT).toBe("classic")
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

  // Strażnik wierności parkowania: to są cztery rzeczy, których `classic` nie
  // ma i mieć nie będzie, a które E4 ma zastać, nie odtwarzać z `git show`.
  //
  // `--ch-delay` jest tu asertowany ŚWIADOMIE jako martwy token: jego jedyna
  // reguła (`19e1dd2:…globals.css:1035`) nie została przeniesiona, jak reszta
  // ~60 reguł Domino. Test pilnuje, że zaparkowane zostaje zaparkowane —
  // gdyby ktoś usunął go jako "nieużywany", E4 straciłby informację, że
  // kafelki wchodzą kaskadą.
  it("renderuje chiclet Cezarego — akcent z kategorii, opóźnienie stagger i mono-tag", () => {
    const { container } = render(<Harness />)

    const chiclet = screen.getAllByRole("link")[0]
    expect(chiclet).toHaveClass("ch-tile", "ch-acc-amber")
    expect(chiclet?.getAttribute("style")).toContain("--ch-delay: 0ms")
    expect(container.querySelector(".ch-tile-tag")).not.toBeNull()
    expect(container.querySelector(".ch-panel")).not.toBeNull()
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
