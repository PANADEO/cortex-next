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
  it("renders copyright and the shell version stripped of leading 'v'", async () => {
    const { ShellFooter } = await import("./shell-footer")

    render(createElement(ShellFooter))

    expect(screen.getByText(/Cortex360 ©/).textContent ?? "").toMatch(/Cortex360 © \d{4}/)
    expect(screen.getByText(/Wersja:/).textContent ?? "").toBe("Wersja: 0.2.10")
  })

  it("renders live diagnostics after mount (time, resolution, language, online)", async () => {
    const { ShellFooter } = await import("./shell-footer")

    render(createElement(ShellFooter))

    expect((screen.getByText(/Czas:/).textContent ?? "").trim()).toMatch(/Czas: \d{2}:\d{2}/)
    expect((screen.getByText(/Rozdzielczość:/).textContent ?? "").trim()).toMatch(
      /Rozdzielczość: \d+x\d+/,
    )
    expect(screen.getByText("Polski")).not.toBeNull()
    expect((screen.getByText(/Online:/).textContent ?? "").trim()).toMatch(/Online: (Tak|Nie)/)
  })
})
