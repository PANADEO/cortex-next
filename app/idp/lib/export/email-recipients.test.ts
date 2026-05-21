import { describe, expect, it } from "vitest"
import { addExportEmailRecipient, normalizeExportEmailRecipient } from "./email-recipients"

describe("export email recipients", () => {
  it("normalizes valid email addresses", () => {
    expect(normalizeExportEmailRecipient("  User@Example.COM ")).toBe("user@example.com")
  })

  it("rejects invalid email addresses", () => {
    expect(normalizeExportEmailRecipient("not-email")).toBeNull()
    expect(normalizeExportEmailRecipient("a@example.com\nbcc@example.com")).toBeNull()
  })

  it("adds the newest recipient first and deduplicates", () => {
    expect(
      addExportEmailRecipient(["old@example.com", "user@example.com"], "USER@example.com"),
    ).toEqual(["user@example.com", "old@example.com"])
  })

  it("keeps at most ten recipients", () => {
    const existing = Array.from({ length: 10 }, (_, index) => `user${index}@example.com`)

    expect(addExportEmailRecipient(existing, "new@example.com")).toEqual([
      "new@example.com",
      ...existing.slice(0, 9),
    ])
  })
})
