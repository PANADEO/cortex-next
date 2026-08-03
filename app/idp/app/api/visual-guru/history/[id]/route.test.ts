// Testy kontraktu GET/DELETE /api/visual-guru/history/:id — bramka pokryta
// osobno (guard-coverage.test.ts). Tu: cross-user isolation (404, NIGDY 403 —
// code-service/SKILL.md "Rekordy per-user" pkt 2), kształt odpowiedzi
// (warianty jako data URI), i że DELETE faktycznie mapuje `false` na 404.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const EMAIL = "uzytkownik@firma.pl"
const GENERATION_ID = "11111111-1111-1111-1111-111111111111"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["visual-guru"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

function buildGeneration(
  overrides: Partial<CortexService.GenerationWithVariants> = {},
): CortexService.GenerationWithVariants {
  return {
    id: GENERATION_ID,
    userEmail: EMAIL,
    prompt: "kot na parapecie",
    additionalContext: "styl akwareli",
    hadReferenceImage: true,
    referenceImageFileName: "referencja.png",
    model: "google/gemini-3.1-flash-lite-image",
    variantCount: 2,
    createdAt: new Date("2026-08-03T10:00:00Z"),
    variants: [
      {
        id: "v0",
        generationId: GENERATION_ID,
        variantIndex: 0,
        image: Buffer.from("aaa"),
        contentType: "image/png",
      },
      {
        id: "v1",
        generationId: GENERATION_ID,
        variantIndex: 1,
        image: Buffer.from("bbb"),
        contentType: "image/png",
      },
    ],
    ...overrides,
  }
}

const service = vi.hoisted(() => ({
  getMyGeneration: vi.fn<
    (userEmail: string, id: string) => Promise<CortexService.GenerationWithVariants | undefined>
  >(),
  deleteGeneration: vi.fn<(userEmail: string, id: string) => Promise<boolean>>(),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { DELETE, GET } = await import("./route")

function request(method: string, email: string | null = EMAIL): Request {
  const headers = new Headers()
  if (email !== null) headers.set("x-auth-request-email", email)
  return new Request(`http://localhost/api/visual-guru/history/${GENERATION_ID}`, { method, headers })
}

const context = { params: Promise.resolve({ id: GENERATION_ID }) }

beforeEach(() => {
  clearTileAccessCache()
  service.getMyGeneration.mockReset()
  service.deleteGeneration.mockReset()
})

describe("GET /api/visual-guru/history/[id]", () => {
  it("404 gdy generacja nie istnieje ani nie należy do usera (getMyGeneration zwraca undefined dla obu)", async () => {
    service.getMyGeneration.mockResolvedValueOnce(undefined)

    const response = await GET(request("GET") as never, context)

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toEqual({ error: "not-found" })
  })

  it("nigdy nie zwraca 403 dla cudzego rekordu — tylko 404 (nie zdradza istnienia)", async () => {
    service.getMyGeneration.mockResolvedValueOnce(undefined)

    const response = await GET(request("GET") as never, context)

    expect(response.status).not.toBe(403)
    expect(response.status).toBe(404)
  })

  it("200: zwraca ślad obrazu referencyjnego (nazwa pliku), NIGDY sam obraz", async () => {
    service.getMyGeneration.mockResolvedValueOnce(buildGeneration())

    const response = await GET(request("GET") as never, context)
    const body = (await response.json()) as {
      referenceImageFileName: string | null
      hadReferenceImage: boolean
    }

    expect(response.status).toBe(200)
    expect(body.referenceImageFileName).toBe("referencja.png")
    expect(body.hadReferenceImage).toBe(true)
    // D5: żadne pole odpowiedzi nie niesie bajtów obrazu referencyjnego —
    // jedyne "image"-podobne dane w kontrakcie to warianty WYNIKOWE (osobno,
    // niżej), nie referencja.
    expect(JSON.stringify(body)).not.toContain("referenceImage\":\"data:")
  })

  it("200: warianty jako gotowe data URI, w kolejności variantIndex", async () => {
    service.getMyGeneration.mockResolvedValueOnce(buildGeneration())

    const response = await GET(request("GET") as never, context)
    const body = (await response.json()) as { variants: { variantIndex: number; dataUrl: string }[] }

    expect(body.variants).toHaveLength(2)
    expect(body.variants[0]).toMatchObject({ variantIndex: 0 })
    expect(body.variants[0]!.dataUrl).toBe(`data:image/png;base64,${Buffer.from("aaa").toString("base64")}`)
  })

  it("woła getMyGeneration z access.email z bramki, NIE z żądania", async () => {
    service.getMyGeneration.mockResolvedValueOnce(buildGeneration())

    await GET(request("GET") as never, context)

    expect(service.getMyGeneration).toHaveBeenCalledWith(EMAIL, GENERATION_ID)
  })
})

describe("DELETE /api/visual-guru/history/[id]", () => {
  it("404 gdy deleteGeneration zwraca false (nie istnieje ani nie należy do usera)", async () => {
    service.deleteGeneration.mockResolvedValueOnce(false)

    const response = await DELETE(request("DELETE") as never, context)

    expect(response.status).toBe(404)
    expect(response.status).not.toBe(403)
  })

  it("200 {deleted: true} gdy deleteGeneration zwraca true", async () => {
    service.deleteGeneration.mockResolvedValueOnce(true)

    const response = await DELETE(request("DELETE") as never, context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ deleted: true })
  })

  it("woła deleteGeneration z access.email z bramki, NIE z żądania", async () => {
    service.deleteGeneration.mockResolvedValueOnce(true)

    await DELETE(request("DELETE") as never, context)

    expect(service.deleteGeneration).toHaveBeenCalledWith(EMAIL, GENERATION_ID)
  })
})
