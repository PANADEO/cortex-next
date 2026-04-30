import type { PackageReadModel, PaginatedPackageResponse } from "@cortex/types"
import { beforeEach, describe, expect, it, vi } from "vitest"

const listMock = vi.fn<(query: unknown) => Promise<PaginatedPackageResponse>>()

vi.mock("@cortex/api", () => ({
  endpoints: {
    packages: {
      list: (query: unknown) => listMock(query),
    },
  },
}))

const { resolveImportedPackageId } = await import("./resolve-imported-package-id")

function pkg(overrides: Partial<PackageReadModel>): PackageReadModel {
  return {
    id: "pkg-1",
    file_name: "test.zip",
    file_hash: "hash",
    created_date: "2026-04-30T10:00:00.000Z",
    processing_state: "imported",
    verification_state: "not_started",
    assignee: null,
    uploaded_by: null,
    custom_status: null,
    user_notes: null,
    ...overrides,
  }
}

function paginated(items: PackageReadModel[]): PaginatedPackageResponse {
  return { items, total: items.length, limit: items.length, offset: 0 }
}

function makeFile(name: string): File {
  return new File(["x"], name, { type: "application/zip" })
}

describe("resolveImportedPackageId", () => {
  beforeEach(() => {
    listMock.mockReset()
  })

  it("returns id for zip kind when filename matches exactly within tolerance", async () => {
    const submittedAt = "2026-04-30T10:00:00.000Z"
    listMock.mockResolvedValueOnce(
      paginated([
        pkg({
          id: "pkg-zip-1",
          file_name: "shipment-2026-04.zip",
          created_date: "2026-04-30T10:00:02.000Z",
        }),
      ]),
    )

    const result = await resolveImportedPackageId(
      [makeFile("shipment-2026-04.zip")],
      submittedAt,
    )

    expect(result).toBe("pkg-zip-1")
    expect(listMock).toHaveBeenCalledWith({
      search: "shipment-2026-04.zip",
      sort_by: "created_date",
      sort_order: "desc",
      limit: 5,
    })
  })

  it("returns id for loose kind when filename matches regex within tolerance", async () => {
    const submittedAt = "2026-04-30T10:00:00.000Z"
    listMock.mockResolvedValueOnce(
      paginated([
        pkg({
          id: "pkg-loose-1",
          file_name: "import_20260430_100003.zip",
          created_date: "2026-04-30T10:00:03.000Z",
        }),
      ]),
    )

    const result = await resolveImportedPackageId(
      [makeFile("invoice.pdf"), makeFile("packing.pdf")],
      submittedAt,
    )

    expect(result).toBe("pkg-loose-1")
    expect(listMock).toHaveBeenCalledWith({
      search: "import_",
      sort_by: "created_date",
      sort_order: "desc",
      limit: 10,
    })
  })

  it("rejects packages whose created_date is older than tolerance window", async () => {
    const submittedAt = "2026-04-30T10:00:00.000Z"
    // Tolerance is 5s, so anything created before 2026-04-30T09:59:55.000Z is rejected.
    listMock.mockResolvedValueOnce(
      paginated([
        pkg({
          id: "stale-pkg",
          file_name: "shipment.zip",
          created_date: "2026-04-30T09:59:00.000Z",
        }),
      ]),
    )

    const result = await resolveImportedPackageId([makeFile("shipment.zip")], submittedAt)

    expect(result).toBeUndefined()
  })

  it("returns undefined when endpoints.packages.list rejects (does not throw)", async () => {
    const submittedAt = "2026-04-30T10:00:00.000Z"
    listMock.mockRejectedValueOnce(new Error("network down"))

    const result = await resolveImportedPackageId([makeFile("shipment.zip")], submittedAt)

    expect(result).toBeUndefined()
  })

  it("excludes claimed ids in loose-files branch (concurrent multi-slot import)", async () => {
    // Simulates two folder slots imported via "Import all". Backend has created
    // pkg-loose-A and pkg-loose-B, both matching the regex and tolerance. The
    // first slot resolves to pkg-loose-A; the second slot must skip it via
    // claimedIds and pick pkg-loose-B even though A is more recent.
    const submittedAt = "2026-04-30T10:00:00.000Z"
    const items = [
      pkg({
        id: "pkg-loose-A",
        file_name: "import_20260430_100004.zip",
        created_date: "2026-04-30T10:00:04.000Z",
      }),
      pkg({
        id: "pkg-loose-B",
        file_name: "import_20260430_100003.zip",
        created_date: "2026-04-30T10:00:03.000Z",
      }),
    ]
    listMock.mockResolvedValue(paginated(items))

    const claimed = new Set<string>()
    const firstResult = await resolveImportedPackageId(
      [makeFile("a.pdf"), makeFile("b.pdf")],
      submittedAt,
      claimed,
    )
    expect(firstResult).toBe("pkg-loose-A")
    claimed.add(firstResult!)

    const secondResult = await resolveImportedPackageId(
      [makeFile("c.pdf"), makeFile("d.pdf")],
      submittedAt,
      claimed,
    )
    expect(secondResult).toBe("pkg-loose-B")
  })

  it("excludes claimed ids in zip branch", async () => {
    const submittedAt = "2026-04-30T10:00:00.000Z"
    listMock.mockResolvedValueOnce(
      paginated([
        pkg({
          id: "pkg-already-claimed",
          file_name: "shipment.zip",
          created_date: "2026-04-30T10:00:02.000Z",
        }),
      ]),
    )

    const result = await resolveImportedPackageId(
      [makeFile("shipment.zip")],
      submittedAt,
      new Set(["pkg-already-claimed"]),
    )

    expect(result).toBeUndefined()
  })
})
