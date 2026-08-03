// Test funkcjonalny POST /api/content-guru/templates/:id/duplicate — bramka
// jest osobno w ../../../guard-coverage.test.ts.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => ["content-guru:manage-templates"]),
}))

const service = vi.hoisted(() => ({
  duplicateTemplate: vi.fn(async (id: string, createdBy: string) =>
    id === "missing"
      ? undefined
      : { id: "template-2", name: "Post (kopia)", category: "Główne", content: "Treść", createdBy },
  ),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { POST } = await import("./route")

const EMAIL = "manager@firma.pl"

function makeRequest(): Request {
  return new Request("http://localhost/api/content-guru/templates/1/duplicate", {
    method: "POST",
    headers: { "x-auth-request-email": EMAIL },
  })
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  clearTileAccessCache()
  service.duplicateTemplate.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("POST /api/content-guru/templates/:id/duplicate", () => {
  it("201 happy path: kopiuje pod nazwą z '(kopia)', createdBy = wołający", async () => {
    const response = await POST(makeRequest() as never, ctx("1"))
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(service.duplicateTemplate).toHaveBeenCalledWith("1", EMAIL)
    expect(json.name).toBe("Post (kopia)")
  })

  it("404 dla nieistniejącego źródłowego id", async () => {
    const response = await POST(makeRequest() as never, ctx("missing"))
    expect(response.status).toBe(404)
  })

  it("409 gdy kopia koliduje z istniejącą nazwą (duplikacja drugi raz)", async () => {
    service.duplicateTemplate.mockRejectedValueOnce(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    )
    const response = await POST(makeRequest() as never, ctx("1"))
    expect(response.status).toBe(409)
  })
})
