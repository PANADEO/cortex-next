// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Markdown } from "./markdown"

describe("Markdown", () => {
  it("renders bold, inline code and lists", () => {
    render(<Markdown content={"Plik **cortex-hero.png** oraz `input/`\n\n- jeden\n- dwa"} />)
    const bold = screen.getByText("cortex-hero.png")
    expect(bold.tagName).toBe("STRONG")
    expect(screen.getByText("input/").tagName).toBe("CODE")
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })

  it("renders GFM tables", () => {
    render(<Markdown content={"| Kto | Co |\n| --- | --- |\n| Marek | sędzia |"} />)
    expect(screen.getByRole("table")).toBeTruthy()
    expect(screen.getByText("Marek").tagName).toBe("TD")
  })

  it("opens links in a new tab", () => {
    render(<Markdown content={"[źródło](https://example.com)"} />)
    const link = screen.getByRole("link", { name: "źródło" })
    expect(link.getAttribute("href")).toBe("https://example.com")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noreferrer")
  })
})
