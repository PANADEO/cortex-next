/* @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest"
import {
  addExportEmailRecipient,
  loadExportEmailRecipients,
  normalizeExportEmailRecipient,
  rememberExportEmailRecipient,
} from "./email-recipients"

function installLocalStorage(): void {
  const storage = new Map<string, string>()
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
  })
}

describe("export email recipients", () => {
  beforeEach(() => {
    installLocalStorage()
  })

  it("normalizes valid email addresses", () => {
    expect(normalizeExportEmailRecipient("  User@Example.COM ")).toBe("user@example.com")
  })

  it("rejects invalid email addresses", () => {
    expect(normalizeExportEmailRecipient("not-email")).toBeNull()
    expect(normalizeExportEmailRecipient("user@.gmail.com")).toBeNull()
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

  it("stores recipients separately per user email", () => {
    rememberExportEmailRecipient("ops@example.com", "user@example.com")
    rememberExportEmailRecipient("sales@example.com", "other@example.com")

    expect(loadExportEmailRecipients("user@example.com")).toEqual(["ops@example.com"])
    expect(loadExportEmailRecipients("other@example.com")).toEqual(["sales@example.com"])
  })
})
