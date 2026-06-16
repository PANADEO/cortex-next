import { describe, expect, it } from "vitest"
import { filterNavSections, IDP_NAV, parseHiddenMenuItems } from "./nav"

function itemIds(sections: ReturnType<typeof filterNavSections>): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.id))
}

describe("filterNavSections", () => {
  it("hides Export, Rule editor, and empty Settings from a comma-separated backend list", () => {
    const sections = filterNavSections(IDP_NAV, parseHiddenMenuItems("export,rules"))

    expect(itemIds(sections)).not.toContain("export")
    expect(itemIds(sections)).not.toContain("rules")
    expect(sections.some((section) => section.id === "settings")).toBe(false)
  })

  it("shows Export and Rule editor when the backend list is empty", () => {
    const sections = filterNavSections(IDP_NAV, parseHiddenMenuItems(undefined))

    expect(itemIds(sections)).toContain("export")
    expect(itemIds(sections)).toContain("rules")
    expect(itemIds(sections)).not.toContain("configuration")
    expect(sections.some((section) => section.id === "settings")).toBe(true)
  })

  it("shows Configuration only for admin navigation", () => {
    const sections = filterNavSections(IDP_NAV, parseHiddenMenuItems(undefined), {
      showAdminItems: true,
    })

    expect(itemIds(sections)).toContain("configuration")
  })

  it("accepts labels with spaces and mixed case", () => {
    const sections = filterNavSections(IDP_NAV, parseHiddenMenuItems(" Rule Editor "))

    expect(itemIds(sections)).not.toContain("rules")
    expect(sections.some((section) => section.id === "settings")).toBe(false)
  })

  it("accepts an array from backend config", () => {
    const sections = filterNavSections(IDP_NAV, parseHiddenMenuItems(["export", "Rule editor"]))

    expect(itemIds(sections)).not.toContain("export")
    expect(itemIds(sections)).not.toContain("rules")
    expect(sections.some((section) => section.id === "settings")).toBe(false)
  })
})
