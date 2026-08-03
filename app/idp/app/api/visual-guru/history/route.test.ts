// Testy kontraktu GET /api/visual-guru/history — bramka pokryta osobno
// (guard-coverage.test.ts). Tu: kształt odpowiedzi (data URI miniatury
// pierwszego wariantu, brak variantu = null) i że userEmail przekazywany do
// warstwy serwisowej pochodzi WYŁĄCZNIE z access.email uwierzytelnionego
// przez requireTileAccess() (code-service/SKILL.md "Rekordy per-user" pkt 3).

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const EMAIL = "uzytkownik@firma.pl"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["visual-guru"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const service = vi.hoisted(() => ({
  listMyGenerationsWithFirstVariant: vi.fn<
    (userEmail: string) => Promise<CortexService.GenerationListItem[]>
  >(async () => []),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { GET } = await import("./route")

function request(email: string | null = EMAIL): Request {
  const headers = new Headers()
  if (email !== null) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/visual-guru/history", { headers })
}

function row(overrides: Partial<CortexService.GenerationListItem> = {}): CortexService.GenerationListItem {
  return {
    id: "gen-1",
    userEmail: EMAIL,
    prompt: "kot na parapecie",
    additionalContext: null,
    hadReferenceImage: false,
    referenceImageFileName: null,
    model: "google/gemini-3.1-flash-lite-image",
    variantCount: 2,
    createdAt: new Date("2026-08-03T10:00:00Z"),
    firstVariantImage: Buffer.from("aaa"),
    firstVariantContentType: "image/png",
    ...overrides,
  }
}

beforeEach(() => {
  clearTileAccessCache()
  service.listMyGenerationsWithFirstVariant.mockClear()
  service.listMyGenerationsWithFirstVariant.mockResolvedValue([])
})

describe("GET /api/visual-guru/history", () => {
  it("woła warstwę serwisową z access.email z bramki, NIE z żądania", async () => {
    const response = await GET(request() as never)

    expect(response.status).toBe(200)
    expect(service.listMyGenerationsWithFirstVariant).toHaveBeenCalledWith(EMAIL)
  })

  it("miniatura pierwszego wariantu: data URI zbudowane z bytea + contentType", async () => {
    service.listMyGenerationsWithFirstVariant.mockResolvedValueOnce([row()])

    const response = await GET(request() as never)
    const body = (await response.json()) as { firstVariantDataUrl: string | null }[]

    expect(body[0]!.firstVariantDataUrl).toBe(`data:image/png;base64,${Buffer.from("aaa").toString("base64")}`)
  })

  it("generacja bez zapisanego wariantu: firstVariantDataUrl null, nie rzuca", async () => {
    service.listMyGenerationsWithFirstVariant.mockResolvedValueOnce([
      row({ firstVariantImage: null, firstVariantContentType: null }),
    ])

    const response = await GET(request() as never)
    const body = (await response.json()) as { firstVariantDataUrl: string | null }[]

    expect(response.status).toBe(200)
    expect(body[0]!.firstVariantDataUrl).toBeNull()
  })

  it("zwraca pustą tablicę, gdy user nie ma żadnej generacji", async () => {
    const response = await GET(request() as never)
    await expect(response.json()).resolves.toEqual([])
  })
})
