// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

interface MeMock {
  data?: { email: string; has_access: boolean } | undefined
  isPending: boolean
  isError: boolean
}

interface AuthorizedMock {
  allowed: boolean | null
  apps: string[]
  isLoading: boolean
  isError: boolean
}

let meMock: MeMock = { isPending: true, isError: false }
let authorizedMock: AuthorizedMock = { allowed: null, apps: [], isLoading: true, isError: false }

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", props),
}))

vi.mock("@cortex/api", () => ({
  useMe: () => meMock,
  useAuthorizedApps: () => authorizedMock,
}))

import { AppGate } from "./app-gate"

beforeEach(() => {
  meMock = { isPending: true, isError: false }
  authorizedMock = { allowed: null, apps: [], isLoading: true, isError: false }
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
})

const Child = () => createElement("div", { "data-testid": "child" }, "child-content")

describe("AppGate", () => {
  it("renders nothing while either signal is loading", () => {
    meMock = { isPending: true, isError: false }
    authorizedMock = { allowed: null, apps: [], isLoading: true, isError: false }

    const { container } = render(createElement(AppGate, null, createElement(Child)))

    expect(container.firstChild).toBeNull()
  })

  it("renders nothing while only authorizedApps is loading", () => {
    meMock = {
      isPending: false,
      isError: false,
      data: { email: "u@x.com", has_access: true },
    }
    authorizedMock = { allowed: null, apps: [], isLoading: true, isError: false }

    const { container } = render(createElement(AppGate, null, createElement(Child)))

    expect(container.firstChild).toBeNull()
  })

  it("renders error variant when useMe errors out", () => {
    meMock = { isPending: false, isError: true }
    authorizedMock = { allowed: true, apps: ["idp"], isLoading: false, isError: false }

    render(createElement(AppGate, null, createElement(Child)))

    expect(screen.getByRole("heading", { name: "Brak uprawnień" })).not.toBeNull()
    expect(screen.getByRole("button", { name: "Spróbuj ponownie" })).not.toBeNull()
  })

  it("renders denied variant when has_access is false", () => {
    meMock = {
      isPending: false,
      isError: false,
      data: { email: "no@x.com", has_access: false },
    }
    authorizedMock = { allowed: true, apps: ["idp"], isLoading: false, isError: false }

    render(createElement(AppGate, null, createElement(Child)))

    expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
    expect(screen.getByText("no@x.com")).not.toBeNull()
    expect(screen.getByRole("button", { name: "Wyloguj się" })).not.toBeNull()
  })

  it("renders denied variant when authorizedApps returns allowed:false (with email from useMe)", () => {
    meMock = {
      isPending: false,
      isError: false,
      data: { email: "u@x.com", has_access: true },
    }
    authorizedMock = { allowed: false, apps: [], isLoading: false, isError: false }

    render(createElement(AppGate, null, createElement(Child)))

    expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
    expect(screen.getByText("u@x.com")).not.toBeNull()
  })

  it("renders error variant when authorizedApps allowed is null after loading (fail-closed)", () => {
    meMock = {
      isPending: false,
      isError: false,
      data: { email: "u@x.com", has_access: true },
    }
    authorizedMock = { allowed: null, apps: [], isLoading: false, isError: true }

    render(createElement(AppGate, null, createElement(Child)))

    expect(screen.getByRole("button", { name: "Spróbuj ponownie" })).not.toBeNull()
  })

  it("renders children when both signals are positive", () => {
    meMock = {
      isPending: false,
      isError: false,
      data: { email: "u@x.com", has_access: true },
    }
    authorizedMock = { allowed: true, apps: ["idp"], isLoading: false, isError: false }

    render(createElement(AppGate, null, createElement(Child)))

    expect(screen.getByTestId("child").textContent).toBe("child-content")
  })

  it("blocks even when has_access:true if authorized:false (defence in depth)", () => {
    meMock = {
      isPending: false,
      isError: false,
      data: { email: "u@x.com", has_access: true },
    }
    authorizedMock = { allowed: false, apps: [], isLoading: false, isError: false }

    render(createElement(AppGate, null, createElement(Child)))

    expect(screen.queryByTestId("child")).toBeNull()
    expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
  })

  it("blocks even when authorized:true if has_access:false (defence in depth)", () => {
    meMock = {
      isPending: false,
      isError: false,
      data: { email: "u@x.com", has_access: false },
    }
    authorizedMock = { allowed: true, apps: ["idp"], isLoading: false, isError: false }

    render(createElement(AppGate, null, createElement(Child)))

    expect(screen.queryByTestId("child")).toBeNull()
    expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
  })

  describe("tileId (CTX-568 — tile-scoped access)", () => {
    it("skips the tile check when tileId is omitted (backward-compat)", () => {
      meMock = {
        isPending: false,
        isError: false,
        data: { email: "u@x.com", has_access: true },
      }
      authorizedMock = { allowed: true, apps: ["idp"], isLoading: false, isError: false }

      render(createElement(AppGate, null, createElement(Child)))

      expect(screen.getByTestId("child").textContent).toBe("child-content")
    })

    it("denies when tileId is null — unresolved path, fail-closed", () => {
      meMock = {
        isPending: false,
        isError: false,
        data: { email: "u@x.com", has_access: true },
      }
      authorizedMock = { allowed: true, apps: ["idp"], isLoading: false, isError: false }

      render(
        <AppGate tileId={null}>
          <Child />
        </AppGate>,
      )

      expect(screen.queryByTestId("child")).toBeNull()
      expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
    })

    it("denies access to a tile the user is not assigned to — the idp-basic/intrastat regression", () => {
      meMock = {
        isPending: false,
        isError: false,
        data: { email: "u@x.com", has_access: true },
      }
      authorizedMock = { allowed: true, apps: ["idp"], isLoading: false, isError: false }

      render(
        <AppGate tileId="intrastat">
          <Child />
        </AppGate>,
      )

      expect(screen.queryByTestId("child")).toBeNull()
      expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
    })

    it("allows a matching tile", () => {
      meMock = {
        isPending: false,
        isError: false,
        data: { email: "u@x.com", has_access: true },
      }
      authorizedMock = { allowed: true, apps: ["intrastat"], isLoading: false, isError: false }

      render(
        <AppGate tileId="intrastat">
          <Child />
        </AppGate>,
      )

      expect(screen.getByTestId("child").textContent).toBe("child-content")
    })

    it("allows an ai-tool via the blanket 'ai-tools' grant", () => {
      meMock = {
        isPending: false,
        isError: false,
        data: { email: "u@x.com", has_access: true },
      }
      authorizedMock = { allowed: true, apps: ["ai-tools"], isLoading: false, isError: false }

      render(
        <AppGate tileId="linkedin-generator">
          <Child />
        </AppGate>,
      )

      expect(screen.getByTestId("child").textContent).toBe("child-content")
    })

    it("denies an ai-tool when apps only grant a different tool", () => {
      meMock = {
        isPending: false,
        isError: false,
        data: { email: "u@x.com", has_access: true },
      }
      authorizedMock = { allowed: true, apps: ["text-analyzer"], isLoading: false, isError: false }

      render(
        <AppGate tileId="linkedin-generator">
          <Child />
        </AppGate>,
      )

      expect(screen.queryByTestId("child")).toBeNull()
      expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
    })

    it("still denies tileId='idp' on has_access:false (has_access is idp-specific, checked first)", () => {
      meMock = {
        isPending: false,
        isError: false,
        data: { email: "u@x.com", has_access: false },
      }
      authorizedMock = { allowed: true, apps: ["idp"], isLoading: false, isError: false }

      render(
        <AppGate tileId="idp">
          <Child />
        </AppGate>,
      )

      expect(screen.queryByTestId("child")).toBeNull()
      expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
    })

    it("does NOT deny idp-basic/intrastat access on has_access:false — has_access is idp-specific, irrelevant to other tiles", () => {
      meMock = {
        isPending: false,
        isError: false,
        data: { email: "u@x.com", has_access: false },
      }
      authorizedMock = { allowed: true, apps: ["intrastat"], isLoading: false, isError: false }

      render(
        <AppGate tileId="intrastat">
          <Child />
        </AppGate>,
      )

      expect(screen.getByTestId("child").textContent).toBe("child-content")
    })
  })
})
