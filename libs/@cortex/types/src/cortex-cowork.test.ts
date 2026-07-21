import { describe, expect, it } from "vitest"
import { composeAgentsPrompt, departmentChain } from "./cortex-cowork"

describe("departmentChain", () => {
  it("expands a nested path root-first", () => {
    expect(departmentChain("finanse/kontroling/podatki")).toEqual([
      "finanse",
      "finanse/kontroling",
      "finanse/kontroling/podatki",
    ])
  })

  it("handles a single-segment path", () => {
    expect(departmentChain("marketing")).toEqual(["marketing"])
  })
})

describe("composeAgentsPrompt", () => {
  const instructions = {
    global: "Odpowiadaj po polsku.",
    departments: {
      finanse: "Kwoty w PLN.",
      "finanse/kontroling": "Zaokrąglaj do pełnych złotych.",
      marketing: "Trzymaj brand voice.",
    },
  }

  it("composes layers most-general-first for a nested department", () => {
    const prompt = composeAgentsPrompt({
      instructions,
      projectDepartment: "finanse/kontroling",
      projectPrompt: "Raporty wg szablonu działu.",
      userPrompt: "Mów mi Cezary.",
    })
    expect(prompt).toBe(
      [
        "## Zasady organizacji (AGENTS.md)\n\nOdpowiadaj po polsku.",
        "## Zasady działu: finanse\n\nKwoty w PLN.",
        "## Zasady działu: finanse/kontroling\n\nZaokrąglaj do pełnych złotych.",
        "## Instrukcje kafelka\n\nRaporty wg szablonu działu.",
        "## Preferencje użytkownika\n\nMów mi Cezary.",
      ].join("\n\n"),
    )
  })

  it("skips departments outside the tile's chain and empty layers", () => {
    const prompt = composeAgentsPrompt({
      instructions,
      projectDepartment: "marketing",
    })
    expect(prompt).toContain("Trzymaj brand voice.")
    expect(prompt).not.toContain("Kwoty w PLN.")
    expect(prompt).not.toContain("Instrukcje kafelka")
  })

  it("returns undefined when every layer is empty", () => {
    expect(composeAgentsPrompt({})).toBeUndefined()
    expect(composeAgentsPrompt({ projectPrompt: "   " })).toBeUndefined()
  })

  it("works without admin instructions (project + user only)", () => {
    const prompt = composeAgentsPrompt({ projectPrompt: "A", userPrompt: "B" })
    expect(prompt).toBe("## Instrukcje kafelka\n\nA\n\n## Preferencje użytkownika\n\nB")
  })
})
