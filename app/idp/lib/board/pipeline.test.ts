import type { PackageReadModel } from "@cortex/types"
import { describe, expect, it } from "vitest"
import { toCleanCard } from "./pipeline"

function packageModel(overrides: Partial<PackageReadModel> = {}): PackageReadModel {
  return {
    id: "pkg-1",
    file_name: "raw-import.zip",
    package_name: null,
    file_hash: "hash",
    created_date: "2026-05-19T10:00:00Z",
    processing_state: "ready",
    verification_state: "not_started",
    assignee: null,
    uploaded_by: "user@example.com",
    custom_status: null,
    user_notes: null,
    ...overrides,
  }
}

describe("toCleanCard", () => {
  it("uses package_name as the card title and keeps file_name searchable", () => {
    const card = toCleanCard(
      packageModel({
        package_name: "May customs batch",
        assignee: "owner@example.com",
      }),
    )

    expect(card.title).toBe("May customs batch")
    expect(card.fileName).toBe("raw-import.zip")
    expect(card.searchText).toContain("raw-import.zip")
    expect(card.searchText).toContain("owner@example.com")
  })

  it("falls back to file_name when package_name is missing", () => {
    const card = toCleanCard(packageModel())

    expect(card.title).toBe("raw-import.zip")
    // Nazwa pliku JEST już tytułem, więc podpis jej nie powtarza.
    expect(card.fileName).toBeNull()
    expect(card.assignee).toBeNull()
    expect(card.searchText).toBe("raw-import.zip")
  })

  it("leaves no user-facing text in the card — the subtitle is composed in the component", () => {
    const card = toCleanCard(packageModel({ package_name: "May customs batch" }))

    expect(Object.values(card)).not.toContain("Unassigned")
  })
})
