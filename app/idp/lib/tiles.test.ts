import { describe, expect, it } from "vitest"
import { canAccessTile, resolveRequiredTileId, TILES } from "./tiles"

describe("resolveRequiredTileId", () => {
  it("resolves a single-segment tile root", () => {
    expect(resolveRequiredTileId("/idp/dashboard")).toBe("idp")
  })

  it("resolves idp-basic regardless of the sub-route", () => {
    expect(resolveRequiredTileId("/idp-basic/settings")).toBe("idp-basic")
  })

  it("resolves intrastat regardless of the sub-route", () => {
    expect(resolveRequiredTileId("/intrastat/batches")).toBe("intrastat")
  })

  it("resolves idp for fullscreen workspace pages outside (main)", () => {
    expect(resolveRequiredTileId("/idp/verify/123")).toBe("idp")
    expect(resolveRequiredTileId("/idp/classification/456")).toBe("idp")
  })

  it("resolves a specific ai-tool id from the second segment", () => {
    expect(resolveRequiredTileId("/ai-tools/linkedin-generator")).toBe("linkedin-generator")
  })

  it("returns null for the bare ai-tools listing (no tool segment)", () => {
    expect(resolveRequiredTileId("/ai-tools")).toBeNull()
  })

  it("returns null for an unrecognized tool slug", () => {
    expect(resolveRequiredTileId("/ai-tools/does-not-exist")).toBeNull()
  })

  it("returns null for a completely unknown path — deny, never a silent fallback", () => {
    expect(resolveRequiredTileId("/whatever/123")).toBeNull()
  })

  it("ignores segments beyond the first two (bounded lookup, no deep collisions)", () => {
    expect(resolveRequiredTileId("/idp/packages/some-uuid/intrastat")).toBe("idp")
  })

  it("stays in sync with the TILES registry for every registered tile", () => {
    for (const tile of TILES) {
      expect(resolveRequiredTileId(tile.href)).toBe(tile.id)
    }
  })
})

describe("canAccessTile", () => {
  it("allows a direct match on a non-ai-tools tile", () => {
    expect(canAccessTile(["intrastat"], "intrastat")).toBe(true)
  })

  it("denies when the specific tile is missing from apps", () => {
    expect(canAccessTile(["idp"], "intrastat")).toBe(false)
  })

  it("allows an ai-tool via the blanket 'ai-tools' grant", () => {
    expect(canAccessTile(["ai-tools"], "linkedin-generator")).toBe(true)
  })

  it("allows an ai-tool via its own specific code", () => {
    expect(canAccessTile(["linkedin-generator"], "linkedin-generator")).toBe(true)
  })

  it("denies an ai-tool when apps only grant a different tool", () => {
    expect(canAccessTile(["text-analyzer"], "linkedin-generator")).toBe(false)
  })

  it("denies when apps is empty", () => {
    expect(canAccessTile([], "idp")).toBe(false)
    expect(canAccessTile([], "linkedin-generator")).toBe(false)
  })
})
