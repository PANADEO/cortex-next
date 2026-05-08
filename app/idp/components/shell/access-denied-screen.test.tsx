// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", props),
}))

import { AccessDeniedScreen } from "./access-denied-screen"

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
})

describe("AccessDeniedScreen", () => {
  it("renders denied variant with email and Wyloguj się button", () => {
    render(createElement(AccessDeniedScreen, { reason: "denied", email: "u@x.com" }))

    expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
    expect(screen.getByText("u@x.com")).not.toBeNull()
    expect(screen.getByRole("button", { name: "Wyloguj się" })).not.toBeNull()
  })

  it("denied variant without email still renders fallback copy", () => {
    render(createElement(AccessDeniedScreen, { reason: "denied" }))

    expect(screen.getByRole("heading", { name: "Brak dostępu" })).not.toBeNull()
    expect(screen.getByRole("button", { name: "Wyloguj się" })).not.toBeNull()
  })

  it("error variant renders Spróbuj ponownie button (not Wyloguj się)", () => {
    render(createElement(AccessDeniedScreen, { reason: "error" }))

    expect(screen.getByRole("button", { name: "Spróbuj ponownie" })).not.toBeNull()
    expect(screen.queryByRole("button", { name: "Wyloguj się" })).toBeNull()
  })

  it("logout button calls window.location.assign('/logout')", () => {
    const assignSpy = vi.fn()
    vi.stubGlobal("location", { assign: assignSpy, reload: vi.fn() })

    render(createElement(AccessDeniedScreen, { reason: "denied", email: "u@x.com" }))

    fireEvent.click(screen.getByRole("button", { name: "Wyloguj się" }))
    expect(assignSpy).toHaveBeenCalledWith("/logout")
  })

  it("retry button calls window.location.reload()", () => {
    const reloadSpy = vi.fn()
    vi.stubGlobal("location", { assign: vi.fn(), reload: reloadSpy })

    render(createElement(AccessDeniedScreen, { reason: "error" }))

    fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }))
    expect(reloadSpy).toHaveBeenCalled()
  })
})
