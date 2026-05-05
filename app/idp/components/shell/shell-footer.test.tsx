// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SHELL_VERSION", "v0.2.10")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("ShellFooter", () => {
  it("renders FE version stripped of leading 'v' and Forsped suffix", async () => {
    const { ShellFooter } = await import("./shell-footer")

    render(createElement(ShellFooter))

    const node = screen.getByText(/FE v/)
    expect(node.textContent ?? "").toBe("FE v0.2.10 · Forsped Sp. z o.o.")
  })

  it("renders Pomoc and Polityka prywatności links", async () => {
    const { ShellFooter } = await import("./shell-footer")

    render(createElement(ShellFooter))

    expect(screen.getByRole("link", { name: "Pomoc" })).not.toBeNull()
    expect(screen.getByRole("link", { name: "Polityka prywatności" })).not.toBeNull()
  })
})
