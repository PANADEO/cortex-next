import { afterEach, describe, expect, it, vi } from "vitest"
import { intrastatApi } from "./api"

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockJsonFetch(body: unknown) {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("intrastatApi", () => {
  it("sends client and month filters for batch list requests", async () => {
    const fetchMock = mockJsonFetch({ items: [], total: 0, limit: 20, offset: 0 })

    await intrastatApi.batches({
      limit: 20,
      offset: 0,
      status: "all",
      transaction_kind: "all",
      client_name: "Jabil",
      period_month: "Czerwiec 2026",
      search: "",
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/intrastat/api/batches?limit=20&offset=0&client_name=Jabil&period_month=Czerwiec+2026",
    )
  })

  it("omits all-valued client and month filters", async () => {
    const fetchMock = mockJsonFetch({ items: [], total: 0, limit: 20, offset: 0 })

    await intrastatApi.batches({
      limit: 20,
      offset: 0,
      client_name: "all",
      period_month: "all",
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/intrastat/api/batches?limit=20&offset=0",
    )
  })

  it("loads batch filter options", async () => {
    const fetchMock = mockJsonFetch({ clients: ["Jabil"], months: ["Czerwiec 2026"] })

    const options = await intrastatApi.batchFilterOptions()

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/intrastat/api/batches/filter-options")
    expect(options).toEqual({ clients: ["Jabil"], months: ["Czerwiec 2026"] })
  })
})
