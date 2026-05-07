import { describe, expect, it } from "vitest"
import { BACKEND_FIELD, DEFAULTS, type FeatureFlag } from "./flags"

const KNOWN_FLAGS: FeatureFlag[] = ["idp.classification"]

describe("DEFAULTS", () => {
  it("contains every known flag with a false default (safe-by-default)", () => {
    for (const flag of KNOWN_FLAGS) {
      expect(DEFAULTS[flag]).toBe(false)
    }
  })

  it("has the same key set as KNOWN_FLAGS", () => {
    expect(Object.keys(DEFAULTS).sort()).toEqual([...KNOWN_FLAGS].sort())
  })
})

describe("BACKEND_FIELD", () => {
  it("maps every known flag to a string field name", () => {
    for (const flag of KNOWN_FLAGS) {
      expect(typeof BACKEND_FIELD[flag]).toBe("string")
      expect(BACKEND_FIELD[flag].length).toBeGreaterThan(0)
    }
  })

  it("maps idp.classification to enable_classification", () => {
    expect(BACKEND_FIELD["idp.classification"]).toBe("enable_classification")
  })
})

describe("DEFAULTS and BACKEND_FIELD", () => {
  it("share identical key sets", () => {
    expect(Object.keys(DEFAULTS).sort()).toEqual(Object.keys(BACKEND_FIELD).sort())
  })
})
