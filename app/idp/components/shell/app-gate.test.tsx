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
  isLoading: boolean
  isError: boolean
}

let meMock: MeMock = { isPending: true, isError: false }
let authorizedMock: AuthorizedMock = { allowed: null, isLoading: true, isError: false }

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
  authorizedMock = { allowed: null, isLoading: true, isError: false }
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
})

const Child = () => createElement("div", { "data-testid": "child" }, "child-content")

describe("AppGate", () => {
  it("renders nothing while either signal is loading", () => {
    meMock = { isPending: true, isError: false }
    authorizedMock = { allowed: null, isLoading: true, isError: false }

    const { container } = render(createElement(AppGate, null, createElement(Child)))

    expect(container.firstChild).toBeNull()
  })

  it("renders nothing while only authorizedApps is loading", () => {
    meMock = {
      isPending: false,
      isError: false,
      data: { email: "u@x.com", has_access: true },
    }
    authorizedMock = { allowed: null, isLoading: true, isError: false }

    const { container } = render(createElement(AppGate, null, createElement(Child)))

    expect(container.firstChild).toBeNull()
  })

  it("renders error variant when useMe errors out", () => {
    meMock = { isPending: false, isError: true }
    authorizedMock = { allowed: true, isLoading: false, isError: false }

    render(createElement(AppGate, null, createElement(Child)))

    expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
    expect(screen.getByRole("button", { name: "Spróbuj ponownie" })).not.toBeNull()
  })

  it("renders denied variant when has_access is false", () => {
    meMock = {
      isPending: false,
      isError: false,
      data: { email: "no@x.com", has_access: false },
    }
    authorizedMock = { allowed: true, isLoading: false, isError: false }

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
    authorizedMock = { allowed: false, isLoading: false, isError: false }

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
    authorizedMock = { allowed: null, isLoading: false, isError: true }

    render(createElement(AppGate, null, createElement(Child)))

    expect(screen.getByRole("button", { name: "Spróbuj ponownie" })).not.toBeNull()
  })

  it("renders children when both signals are positive", () => {
    meMock = {
      isPending: false,
      isError: false,
      data: { email: "u@x.com", has_access: true },
    }
    authorizedMock = { allowed: true, isLoading: false, isError: false }

    render(createElement(AppGate, null, createElement(Child)))

    expect(screen.getByTestId("child").textContent).toBe("child-content")
  })

  it("blocks even when has_access:true if authorized:false (defence in depth)", () => {
    meMock = {
      isPending: false,
      isError: false,
      data: { email: "u@x.com", has_access: true },
    }
    authorizedMock = { allowed: false, isLoading: false, isError: false }

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
    authorizedMock = { allowed: true, isLoading: false, isError: false }

    render(createElement(AppGate, null, createElement(Child)))

    expect(screen.queryByTestId("child")).toBeNull()
    expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
  })
})
