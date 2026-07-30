// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
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

vi.mock("@cortex/api", () => ({
  useAuthorizedApps: () => authorizedMock,
}))

// TileGrid merges in governed task-chat project tiles from a query hook; the
// grid's own authorization logic is what these tests cover, so stub the hook.
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

import type { Tile } from "@/lib/tiles"
import { MessagesSquare } from "lucide-react"
import { TileGrid } from "./tile-grid"

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
  coworkTilesMock = { tiles: [], projects: [], isLoading: false }
})

describe("TileGrid", () => {
  it("renders only tiles present in authorized apps", () => {
    authorizedMock = {
      allowed: true,
      apps: ["idp-basic"],
      email: "u@x.com",
      isLoading: false,
      isError: false,
    }

    render(<TileGrid />)

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

    render(<TileGrid />)

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

    render(<TileGrid />)

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

    render(<TileGrid />)

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

    render(<TileGrid />)

    expect(screen.getByText("Nie znaleziono aplikacji")).not.toBeNull()
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

    render(<TileGrid />)

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

    render(<TileGrid />)

    expect(screen.getByText("Cortex Cowork")).not.toBeNull()
    expect(screen.getByText("Projekt Beta")).not.toBeNull()
  })

  it("applies tile href overrides", () => {
    render(<TileGrid tileHrefOverrides={{ idp: "/idp/packages" }} />)

    expect(screen.getByRole("link", { name: /IDP Procesowanie/i })).toHaveAttribute(
      "href",
      "/idp/packages",
    )
  })
})
