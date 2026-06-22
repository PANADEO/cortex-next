// @vitest-environment jsdom
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

import { TileGrid } from "./tile-grid"

afterEach(() => {
  cleanup()
  authorizedMock = {
    allowed: true,
    apps: ["idp", "idp-basic"],
    email: "u@x.com",
    isLoading: false,
    isError: false,
  }
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
})
