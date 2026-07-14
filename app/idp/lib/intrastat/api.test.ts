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

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/intrastat/api/batches?limit=20&offset=0")
  })

  it("loads batch filter options", async () => {
    const fetchMock = mockJsonFetch({ clients: ["Jabil"], months: ["Czerwiec 2026"] })

    const options = await intrastatApi.batchFilterOptions()

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/intrastat/api/batches/filter-options")
    expect(options).toEqual({ clients: ["Jabil"], months: ["Czerwiec 2026"] })
  })

  it("loads filesystem preview", async () => {
    const fetchMock = mockJsonFetch({
      configured: true,
      root: "/app/incoming",
      current_path: "Jabil",
      parent_path: "",
      entries: [],
      total: 0,
      limit: 10,
      offset: 20,
      truncated: false,
    })

    const preview = await intrastatApi.filesystemPreview({
      path: "Jabil",
      limit: 10,
      offset: 20,
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/intrastat/api/filesystem/preview?path=Jabil&limit=10&offset=20",
    )
    expect(preview.configured).toBe(true)
    expect(preview.current_path).toBe("Jabil")
  })

  it("downloads filesystem files", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(new Blob(["pdf"]), {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="invoice.pdf"' },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const download = await intrastatApi.downloadFilesystemFile("Jabil/Lipiec 2026/WDT/invoice.pdf")

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/intrastat/api/filesystem/download?path=Jabil%2FLipiec+2026%2FWDT%2Finvoice.pdf",
    )
    expect(download.filename).toBe("invoice.pdf")
  })

  it("downloads the active CN resource", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(new Blob(["xlsx"]), {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="cn-resource-20260714.xlsx"' },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const download = await intrastatApi.downloadCnResource()

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/intrastat/api/resources/cn/download")
    expect(download.filename).toBe("cn-resource-20260714.xlsx")
  })

  it("loads paginated CN resource rows", async () => {
    const fetchMock = mockJsonFetch({ items: [], total: 0, limit: 50, offset: 50 })

    await intrastatApi.cnResourceRows({ search: "cable", limit: 50, offset: 50 })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/intrastat/api/resources/cn/rows?search=cable&limit=50&offset=50",
    )
  })

  it("creates CN resource rows through the editor endpoint", async () => {
    const fetchMock = mockJsonFetch({
      id: "row-1",
      index_value: "NEW-100",
      cn8: "85044095",
      cn: "85044095",
      description: "Power supplies",
    })
    const payload = {
      index_value: "NEW-100",
      cn8: "85044095",
      cn: "85044095",
      description: "Power supplies",
    }

    await intrastatApi.createCnResourceRow(payload)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/intrastat/api/resources/cn/rows")
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST")
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(payload))
  })

  it("deletes filesystem files", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(null, { status: 204 })
    })
    vi.stubGlobal("fetch", fetchMock)

    await intrastatApi.deleteFilesystemFile("Jabil/Lipiec 2026/WDT/invoice.pdf")

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/intrastat/api/filesystem/file?path=Jabil%2FLipiec+2026%2FWDT%2Finvoice.pdf",
    )
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("DELETE")
  })

  it("sends filesystem metadata for filesystem ZIP uploads", async () => {
    const fetchMock = mockJsonFetch({
      id: "batch-1",
      transaction_kind: "WDT",
      status: "queued",
      document_count: 1,
    })

    await intrastatApi.uploadBatch(new File(["zip"], "batch.zip"), "WDT", {
      uploadToFilesystem: true,
      clientName: "Jabil",
      periodMonth: "Lipiec 2026",
    })

    const body = fetchMock.mock.calls[0]?.[1]?.body
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/intrastat/api/batches/upload")
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get("transaction_kind")).toBe("WDT")
    expect((body as FormData).get("upload_to_filesystem")).toBe("true")
    expect((body as FormData).get("client_name")).toBe("Jabil")
    expect((body as FormData).get("period_month")).toBe("Lipiec 2026")
  })

  it("translates persisted Polish alerts when loading declaration lines", async () => {
    mockJsonFetch({
      items: [
        {
          alerts: [
            "Brak kodu CN do eksportu Intrastat.",
            "Niejednoznaczne dopasowanie CN: 85322400, 85423269.",
            "Suma wartości pozycji (2000.00 EUR) nie zgadza się z kwotą netto faktury (2300.00 EUR).",
          ],
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    })

    const response = await intrastatApi.lines("batch-1", { limit: 20, offset: 0 })

    expect(response.items[0]?.alerts).toEqual([
      "Missing CN code for Intrastat export.",
      "Ambiguous CN match: 85322400, 85423269.",
      "Sum of line values (2000.00 EUR) does not match the invoice net total (2300.00 EUR).",
    ])
  })

  it("hides missing-field alerts when the declaration line has a final value", async () => {
    mockJsonFetch({
      items: [
        {
          cn_code: "85322200",
          net_weight: 2,
          origin_country: "PL",
          delivery_terms: null,
          alerts: [
            "delivery_terms not found for line item 10.",
            "net_weight not found for line item 10.",
            "origin_country not found for line item 10.",
            "cn_code not found for line item 10.",
            "Low extraction confidence.",
          ],
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    })

    const response = await intrastatApi.lines("batch-1", { limit: 20, offset: 0 })

    expect(response.items[0]?.alerts).toEqual([
      "delivery_terms not found for line item 10.",
      "Low extraction confidence.",
    ])
  })
})
