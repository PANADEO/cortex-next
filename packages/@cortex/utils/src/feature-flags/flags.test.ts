import { describe, expect, it } from "vitest"
import { BACKEND_FIELD, DEFAULTS, type FeatureFlag } from "./flags"

const KNOWN_FLAGS: FeatureFlag[] = [
  "idp.classification",
  "idp.customs-code",
  "idp.atr-processing",
  "idp.additional-ai-context",
  "idp.packaging-selection-mode",
  "idp.import-email-notifications",
]

describe("DEFAULTS", () => {
  it("contains every opt-in flag with a false default", () => {
    for (const flag of KNOWN_FLAGS.filter((value) => value !== "idp.import-email-notifications")) {
      expect(DEFAULTS[flag]).toBe(false)
    }
  })

  it("keeps import email notifications enabled for older backend responses", () => {
    expect(DEFAULTS["idp.import-email-notifications"]).toBe(true)
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

  it("maps idp.additional-ai-context to enable_additional_ai_context", () => {
    expect(BACKEND_FIELD["idp.additional-ai-context"]).toBe("enable_additional_ai_context")
  })

  it("maps idp.packaging-selection-mode to enable_packaging_selection_mode", () => {
    expect(BACKEND_FIELD["idp.packaging-selection-mode"]).toBe("enable_packaging_selection_mode")
  })

  it("maps idp.import-email-notifications to enable_import_email_notifications", () => {
    expect(BACKEND_FIELD["idp.import-email-notifications"]).toBe(
      "enable_import_email_notifications",
    )
  })
})

describe("DEFAULTS and BACKEND_FIELD", () => {
  it("share identical key sets", () => {
    expect(Object.keys(DEFAULTS).sort()).toEqual(Object.keys(BACKEND_FIELD).sort())
  })
})
