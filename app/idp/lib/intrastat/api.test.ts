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

  it("sends additional AI context when reprocessing a batch", async () => {
    const fetchMock = mockJsonFetch({
      id: "batch-1",
      status: "queued",
      additional_ai_context: "Merge matching documents.",
    })
    const payload = { additional_ai_context: "Merge matching documents." }

    await intrastatApi.reprocessBatch("batch-1", payload)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/intrastat/api/batches/batch-1/reprocess")
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST")
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(payload))
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
      client_id: "client-1",
      path: "Jabil",
      limit: 10,
      offset: 20,
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/intrastat/api/filesystem/preview?client_id=client-1&path=Jabil&limit=10&offset=20",
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

    const download = await intrastatApi.downloadFilesystemFile({
      path: "Lipiec 2026/WDT/invoice.pdf",
      clientId: "client-1",
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/intrastat/api/filesystem/download?path=Lipiec+2026%2FWDT%2Finvoice.pdf&client_id=client-1",
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

  it("upserts CN resource rows and can confirm a conflicting replacement", async () => {
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

    await intrastatApi.upsertCnResourceRow(payload, true)

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/intrastat/api/resources/cn/rows/upsert?replace_conflict=true",
    )
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST")
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(payload))
  })

  it("deletes filesystem files", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(null, { status: 204 })
    })
    vi.stubGlobal("fetch", fetchMock)

    await intrastatApi.deleteFilesystemFile({
      path: "Lipiec 2026/WDT/invoice.pdf",
      clientId: "client-1",
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/intrastat/api/filesystem/file?path=Lipiec+2026%2FWDT%2Finvoice.pdf&client_id=client-1",
    )
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("DELETE")
  })

  it("creates, updates and deletes filesystem client mappings", async () => {
    const fetchMock = mockJsonFetch({
      id: "client-1",
      client_name: "Jabil",
      folder_name: "jabil-share",
      available: true,
    })
    const payload = { client_name: "Jabil", folder_name: "jabil-share" }

    await intrastatApi.createFilesystemClient(payload)
    await intrastatApi.updateFilesystemClient("client-1", payload)
    await intrastatApi.deleteFilesystemClient("client-1")

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/intrastat/api/filesystem/clients")
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST")
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(payload))
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe("/intrastat/api/filesystem/clients/client-1")
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("PUT")
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe("/intrastat/api/filesystem/clients/client-1")
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe("DELETE")
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

  it("creates a declaration line in the selected batch", async () => {
    const fetchMock = mockJsonFetch({ id: "line-2", alerts: [] })

    await intrastatApi.createLine("batch-1", {
      reference_line_id: "line-1",
      item_index: "NEW-100",
      cn_code: "85044095",
      description: "Power supply",
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/intrastat/api/batches/batch-1/lines")
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        reference_line_id: "line-1",
        item_index: "NEW-100",
        cn_code: "85044095",
        description: "Power supply",
      }),
    })
  })

  it("updates whether a declaration line is included in the XLSX export", async () => {
    const fetchMock = mockJsonFetch({ id: "line-1", alerts: [], is_excluded: true })

    await intrastatApi.patchLine("line-1", {
      is_excluded: true,
      exclusion_reason: "manual-exclusion",
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/intrastat/api/lines/line-1")
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({
        is_excluded: true,
        exclusion_reason: "manual-exclusion",
      }),
    })
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
