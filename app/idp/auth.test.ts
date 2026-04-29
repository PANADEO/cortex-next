import { describe, expect, it } from "vitest"
// Helpers live in ./lib/auth-identity but are re-exported from ./auth (see auth.ts).
// Importing directly from the source file avoids pulling next-auth's server-only
// modules into the Vitest module graph (which fails to resolve `next/server`).
import { resolveDisplayName, resolveUserId } from "./lib/auth-identity"

describe("resolveDisplayName", () => {
  it("falls back to formatName(email) when preferredUsername is null", () => {
    expect(resolveDisplayName(null, "hciebiada@itsg.com.pl")).toBe("Hciebiada")
  })

  it("falls back to formatName(email) when preferredUsername is empty string", () => {
    expect(resolveDisplayName("", "hciebiada@itsg.com.pl")).toBe("Hciebiada")
  })

  it("falls back to formatName(email) when preferredUsername is whitespace only", () => {
    expect(resolveDisplayName("   ", "hciebiada@itsg.com.pl")).toBe("Hciebiada")
  })

  it("falls back to formatName(email) when preferredUsername looks like an Auth0 sub", () => {
    expect(resolveDisplayName("auth0|69bbe9a830f8759c", "hciebiada@itsg.com.pl")).toBe("Hciebiada")
  })

  it("falls back to formatName(email) when preferredUsername looks like a Google OAuth sub", () => {
    expect(resolveDisplayName("google-oauth2|123456789", "john.doe@x.pl")).toBe("John Doe")
  })

  it("returns user-readable preferredUsername unchanged", () => {
    expect(resolveDisplayName("Hubert Ciebiada", "hciebiada@itsg.com.pl")).toBe("Hubert Ciebiada")
  })

  it("returns lower-case username unchanged (IdP value wins)", () => {
    expect(resolveDisplayName("hciebiada", "hciebiada@itsg.com.pl")).toBe("hciebiada")
  })
})

describe("resolveUserId", () => {
  it("falls back to email when authRequestUser is null", () => {
    expect(resolveUserId(null, "hubert@cortex.local")).toBe("hubert@cortex.local")
  })

  it("falls back to email when authRequestUser is empty string", () => {
    expect(resolveUserId("", "hubert@cortex.local")).toBe("hubert@cortex.local")
  })

  it("preserves the full Auth0 sub", () => {
    expect(resolveUserId("auth0|69bbe9a830f8759c", "hciebiada@itsg.com.pl")).toBe(
      "auth0|69bbe9a830f8759c",
    )
  })

  it("trims surrounding whitespace from authRequestUser", () => {
    expect(resolveUserId("  auth0|abc  ", "x@y.pl")).toBe("auth0|abc")
  })
})
