// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import type { HubTile } from "@cortex/api"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

interface AuthorizedMock {
  allowed: boolean | null
  apps: string[]
  email: string | null
  isLoading: boolean
  isError: boolean
}

let authorizedMock: AuthorizedMock = {
  allowed: true,
  apps: ["idp", "idp-basic"],
  email: "u@x.com",
  isLoading: false,
  isError: false,
}

interface HubTilesMock {
  tiles: HubTile[]
  isLoading: boolean
  isError: boolean
}

/** Kształt jednego wiersza tak, jak GET /api/hub/tiles go dziś zwraca —
 *  fixture, nie static TILES: Krok 3 przełączył hub na useHubTiles(). */
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

// Katalog huba nie zwraca wiersze grant-only (ai-tools, cortex-cowork,
// intrastat-*-editor — show_on_hub=false) — fixture pomija je celowo, jak
// robi to prawdziwy listHubApplications().
const HUB_TILES_FIXTURE = [
  hubRow({
    code: "idp",
    name: "IDP",
    route: "/idp/dashboard",
    description: "Procesowanie i ekstrakcja danych z dokumentów handlowych",
  }),
  hubRow({ code: "idp-basic", name: "IDP Basic", route: "/idp-basic/dashboard" }),
  hubRow({ code: "intrastat", name: "Intrastat", route: "/intrastat/dashboard" }),
  hubRow({ code: "text-highlighter", name: "Podświetlacz tekstu", route: "/ai-tools/text-highlighter" }),
  hubRow({ code: "text-transformer", name: "Transformator tekstu", route: "/ai-tools/text-transformer" }),
  hubRow({ code: "fakturomat", name: "Analizator faktur", route: "/ai-tools/fakturomat" }),
]

let hubTilesMock: HubTilesMock = {
  tiles: HUB_TILES_FIXTURE,
  isLoading: false,
  isError: false,
}

vi.mock("@cortex/api", () => ({
  useAuthorizedApps: () => authorizedMock,
  useHubTiles: () => hubTilesMock,
}))

// Hub dokłada kafelki task-chat z governance store przez osobny hook; testy
// niżej pokrywają logikę AUTORYZACJI huba, więc hook jest zaślepiony.
// Hook zwraca to, co governance store uznał za widoczne dla tego usera — czyli
// filtr PER PROJEKT jest już zrobiony i celowo tu nie testujemy go ponownie.
let coworkTilesMock: { tiles: Tile[]; projects: unknown[]; isLoading: boolean } = {
  tiles: [],
  projects: [],
  isLoading: false,
}

vi.mock("@/features/cortex-cowork", () => ({
  useCoworkProjectTiles: () => coworkTilesMock,
}))

// Chrome powłoki (logo, menu użytkownika, zegar w stopce, tło) jest tu
// zaślepiony CELOWO: te testy sprawdzają hub, a nie powłokę, a bez zaślepki
// ciągnęłyby useMe(), next/image i setInterval z żywym zegarem. Nie zaślepiamy
// za to bramki ładowanie/błąd — od podziału warstw (D4) siedzi ona właśnie w
// AuthedHome i to jest jedyne miejsce, gdzie da się ją przetestować.
vi.mock("./dot-grid", () => ({ DotGrid: () => null }))
vi.mock("./shell-header", () => ({ ShellHeader: () => null }))
vi.mock("./shell-footer", () => ({ ShellFooter: () => null }))

import type { Tile } from "@/lib/tiles"
import { MessagesSquare } from "lucide-react"
import { AuthedHome } from "./authed-home"

/** Kafelek task-chat w kształcie, w jakim useCoworkProjectTiles zwraca projekt. */
function coworkProjectTile(name = "Cortex Cowork", id = "cortex-cowork"): Tile {
  return {
    id,
    label: name,
    description: "Projekt z governance store",
    href: `/cortex-cowork/chat?project=${id}`,
    icon: MessagesSquare,
    iconBg: "bg-violet-200",
    iconFg: "text-violet-700",
    categoryFunctional: "agents",
    categoryDepartment: ["it"],
    archetype: "task-chat",
  }
}

afterEach(() => {
  cleanup()
  authorizedMock = {
    allowed: true,
    apps: ["idp", "idp-basic"],
    email: "u@x.com",
    isLoading: false,
    isError: false,
  }
  hubTilesMock = { tiles: HUB_TILES_FIXTURE, isLoading: false, isError: false }
  coworkTilesMock = { tiles: [], projects: [], isLoading: false }
})

describe("AuthedHome — hub", () => {
  it("renders only tiles present in authorized apps", () => {
    authorizedMock = {
      allowed: true,
      apps: ["idp-basic"],
      email: "u@x.com",
      isLoading: false,
      isError: false,
    }

    render(<AuthedHome />)

    expect(screen.getByText("IDP Basic")).not.toBeNull()
    expect(screen.queryByText("IDP")).toBeNull()
  })

  it("renders the Intrastat tile when authorized", () => {
    authorizedMock = {
      allowed: true,
      apps: ["intrastat"],
      email: "u@x.com",
      isLoading: false,
      isError: false,
    }

    render(<AuthedHome />)

    expect(screen.getByText("Intrastat")).not.toBeNull()
    expect(screen.queryByText("IDP Basic")).toBeNull()
  })

  it("renders an individual AI app tile when only that app is authorized", () => {
    authorizedMock = {
      allowed: true,
      apps: ["text-highlighter"],
      email: "u@x.com",
      isLoading: false,
      isError: false,
    }

    render(<AuthedHome />)

    expect(screen.getByText("Podświetlacz tekstu")).not.toBeNull()
    expect(screen.queryByText("Transformator tekstu")).toBeNull()
    expect(screen.queryByText("AI Tools")).toBeNull()
  })

  it("renders all AI app tiles when the parent AI Tools app is authorized", () => {
    authorizedMock = {
      allowed: true,
      apps: ["ai-tools"],
      email: "u@x.com",
      isLoading: false,
      isError: false,
    }

    render(<AuthedHome />)

    expect(screen.getByText("Podświetlacz tekstu")).not.toBeNull()
    expect(screen.getByText("Transformator tekstu")).not.toBeNull()
    expect(screen.getByText("Analizator faktur")).not.toBeNull()
    expect(screen.queryByText("AI Tools")).toBeNull()
  })

  it("renders the empty state when no authorized app tile is available", () => {
    authorizedMock = {
      allowed: false,
      apps: [],
      email: "u@x.com",
      isLoading: false,
      isError: false,
    }

    render(<AuthedHome />)

    expect(screen.getByText("Nie znaleziono aplikacji")).not.toBeNull()
  })

  // Krok 3: katalog jeszcze w locie (GET /api/hub/tiles) nie może przez moment
  // wyglądać jak "brak wyników" — HubGate już przepuścił tego usera, to tylko
  // opóźnienie sieci.
  it("pokazuje stan ładowania zamiast pustego stanu, dopóki katalog huba się nie wczyta", () => {
    hubTilesMock = { tiles: [], isLoading: true, isError: false }

    render(<AuthedHome />)

    expect(screen.getByText("Wczytywanie aplikacji…")).not.toBeNull()
    expect(screen.queryByText("Nie znaleziono aplikacji")).toBeNull()
  })

  it("pokazuje osobny komunikat błędu, gdy katalog huba nie wczytał się wcale", () => {
    hubTilesMock = { tiles: [], isLoading: false, isError: true }

    render(<AuthedHome />)

    expect(screen.getByText("Nie udało się wczytać aplikacji")).not.toBeNull()
  })

  // Regresja: governance store nie zna grantów z system_config, więc bez bramki
  // w gridzie kafelki task-chat widział KAŻDY uwierzytelniony user — klikał i
  // dostawał AccessDeniedScreen z trasy /cortex-cowork.
  it("ukrywa kafelki task-chat, gdy user nie ma grantu cortex-cowork", () => {
    authorizedMock = {
      allowed: true,
      apps: ["intrastat"],
      email: "u@x.com",
      isLoading: false,
      isError: false,
    }
    coworkTilesMock = { tiles: [coworkProjectTile()], projects: [], isLoading: false }

    render(<AuthedHome />)

    // Własny kafelek widoczny — dowód, że grid się wyrenderował i asercja niżej
    // nie przechodzi tylko dlatego, że nie ma na ekranie niczego.
    expect(screen.getByText("Intrastat")).not.toBeNull()
    expect(screen.queryByText("Cortex Cowork")).toBeNull()
  })

  it("pokazuje kafelki task-chat, gdy user ma grant cortex-cowork", () => {
    authorizedMock = {
      allowed: true,
      apps: ["cortex-cowork"],
      email: "u@x.com",
      isLoading: false,
      isError: false,
    }
    coworkTilesMock = {
      tiles: [coworkProjectTile(), coworkProjectTile("Projekt Beta", "projekt-beta")],
      projects: [],
      isLoading: false,
    }

    render(<AuthedHome />)

    expect(screen.getByText("Cortex Cowork")).not.toBeNull()
    expect(screen.getByText("Projekt Beta")).not.toBeNull()
  })

  it("applies tile href overrides", () => {
    render(<AuthedHome tileHrefOverrides={{ idp: "/idp/packages" }} />)

    expect(screen.getByRole("link", { name: /IDP Procesowanie/i })).toHaveAttribute(
      "href",
      "/idp/packages",
    )
  })

  // Licznik zakładki liczy wynik szukania, nie cały katalog z grantem — to są
  // dwie różne liczby (HubCounts.matching vs HubCounts.authorized) i zgadzają
  // się tylko przy pustej szukajce, więc scenariusz MUSI mieć zapytanie
  // zawężające. Drugą z nich renderuje wyłącznie `masthead`, i tam też siedzi
  // test, który pilnuje, że layout nie poda ich sobie zamienionych miejscami.
  it("zakładka Wszystkie liczy wynik szukania, nie cały katalog z grantem", async () => {
    authorizedMock = {
      allowed: true,
      apps: ["ai-tools"],
      email: "u@x.com",
      isLoading: false,
      isError: false,
    }

    render(<AuthedHome />)
    fireEvent.change(screen.getByLabelText("Szukaj aplikacji"), {
      target: { value: "Analizator" },
    })

    // 3 kafelki ai-tools w katalogu, 1 pasuje do zapytania.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Wszystkie aplikacje" }).textContent).toBe(
        "Wszystkie 1",
      )
    })
  })

  // Strażnik defektu E0: cherry-pick `19e1dd2` PODMIENIŁ markup huba zamiast
  // dołożyć drugi layout, więc `classic` przez jeden etap renderował DOM
  // Domino. Po E4 pytanie brzmi inaczej i szerzej, bo wygląd nie jest już
  // przypięty do layoutu: instancja bez wybranego presetu ma dostać hub
  // sprzed redesignu W CAŁOŚCI — ten layout ORAZ te warianty.
  it("bez wybranego presetu hub jest ten sprzed redesignu — layout i warianty", () => {
    const { container } = render(<AuthedHome />)

    // Licznik „Narzędzia: N" renderuje wyłącznie `masthead` — to jest
    // rozstrzygnięcie o layoucie (warstwa 3).
    expect(screen.queryByText(/^Narzędzia: /)).toBeNull()

    // A to o wariancie (warstwa 2): kafelek karty ma wysokość wpisaną wprost,
    // chiclet bierze ją z tokena. Bez tej asercji preset ze zmienionym samym
    // wariantem przeszedłby test „domyślny layout" bez mrugnięcia.
    expect(container.querySelector(".min-h-\\[184px\\]")).not.toBeNull()
    expect(container.querySelector(".min-h-tile")).toBeNull()
  })
})
