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

  it("resolves the bare ai-tools hub to the collective 'ai-tools' code", () => {
    // Wcześniej null, czyli TWARDA ODMOWA: pozycja "Dashboard" w sidebarze
    // (AI_TOOLS_DASHBOARD_ITEM -> /ai-tools) zawsze kończyła się ekranem
    // "Brak dostępu", a zbiorczy grant `ai-tools` nie otwierał niczego pod
    // własnym adresem.
    expect(resolveRequiredTileId("/ai-tools")).toBe("ai-tools")
  })

  it("returns null for an unrecognized tool slug — no silent promotion to the hub", () => {
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

  describe("ai-tools hub", () => {
    it("allows the hub via the blanket grant", () => {
      expect(canAccessTile(["ai-tools"], "ai-tools")).toBe(true)
    })

    it("allows the hub for a user holding a single tool code", () => {
      // Ta sama reguła co AiToolGate wywołany bez toolId (hasAnyAiToolAccess):
      // kto ma cokolwiek w środku, ma po co wejść na hub.
      expect(canAccessTile(["linkedin-generator"], "ai-tools")).toBe(true)
    })

    it("denies the hub without any AI tool access", () => {
      expect(canAccessTile(["intrastat"], "ai-tools")).toBe(false)
      expect(canAccessTile([], "ai-tools")).toBe(false)
    })
  })
})
