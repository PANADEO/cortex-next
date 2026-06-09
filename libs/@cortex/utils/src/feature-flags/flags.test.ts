import { describe, expect, it } from "vitest"
import { BACKEND_FIELD, DEFAULTS, type FeatureFlag } from "./flags"

const KNOWN_FLAGS: FeatureFlag[] = ["idp.classification", "idp.customs-code", "idp.atr-processing"]

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

  it("maps idp.customs-code to enable_customs_code", () => {
    expect(BACKEND_FIELD["idp.customs-code"]).toBe("enable_customs_code")
  })

  it("maps idp.atr-processing to enable_atr_processing", () => {
    expect(BACKEND_FIELD["idp.atr-processing"]).toBe("enable_atr_processing")
  })
})

describe("DEFAULTS and BACKEND_FIELD", () => {
  it("share identical key sets", () => {
    expect(Object.keys(DEFAULTS).sort()).toEqual(Object.keys(BACKEND_FIELD).sort())
  })
})
