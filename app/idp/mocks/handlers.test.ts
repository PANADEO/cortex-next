import { afterEach, describe, expect, it, vi } from "vitest"
import { mockScopesFromEnv } from "./handlers"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("mockScopesFromEnv", () => {
  it("parses NEXT_PUBLIC_DEV_USER_SCOPES-compatible scope lists", () => {
    expect(mockScopesFromEnv("package_unlock, admin,")).toEqual(["package_unlock", "admin"])
  })

  it("reads package unlock scope from env by default", () => {
    vi.stubEnv("NEXT_PUBLIC_DEV_USER_SCOPES", "package_unlock")

    expect(mockScopesFromEnv()).toEqual(["package_unlock"])
  })
})
