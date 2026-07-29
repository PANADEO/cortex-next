// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { UserMenu } from "../user-menu"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("UserMenu", () => {
  it("shows IDP admin badge for package unlock scope", async () => {
    render(
      <UserMenu
        user={{
          email: "admin@cortex.local",
          scopes: ["package_unlock"],
        }}
      />,
    )

    await userEvent.click(screen.getByRole("button"))

    expect(screen.getByText("IDP admin")).toBeInTheDocument()
  })

  it("does not show IDP admin badge without package unlock scope", async () => {
    render(
      <UserMenu
        user={{
          email: "user@cortex.local",
          scopes: [],
        }}
      />,
    )

    await userEvent.click(screen.getByRole("button"))

    expect(screen.queryByText("IDP admin")).not.toBeInTheDocument()
  })
})
