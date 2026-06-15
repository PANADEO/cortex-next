// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LandingHero } from "./landing-hero"

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => createElement("img", props),
}))

vi.mock("./dot-grid", () => ({
  DotGrid: () => createElement("div", { "data-testid": "dot-grid" }),
}))

vi.mock("./shell-footer", () => ({
  ShellFooter: () => createElement("footer"),
}))

vi.mock("./split-text", () => ({
  SplitText: ({ children }: { children: ReactNode }) => createElement("span", null, children),
}))

afterEach(() => {
  cleanup()
})

describe("LandingHero", () => {
  it("renders an auth error message when login returns one", () => {
    render(
      createElement(LandingHero, {
        authErrorMessage: "Najpierw potwierdź adres e-mail, aby uzyskać dostęp.",
      }),
    )

    expect(screen.getByRole("alert")).not.toBeNull()
    expect(screen.getByText("Logowanie przerwane")).not.toBeNull()
    expect(screen.getByText("Najpierw potwierdź adres e-mail, aby uzyskać dostęp.")).not.toBeNull()
  })
})
