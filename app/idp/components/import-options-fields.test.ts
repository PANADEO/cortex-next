import { describe, expect, it } from "vitest"
import {
  emptyImportOptions,
  serializeImportOptions,
  type ImportOptions,
} from "./import-options-fields"

function options(overrides: Partial<ImportOptions> = {}): ImportOptions {
  return { ...emptyImportOptions, ...overrides }
}

describe("serializeImportOptions", () => {
  it("defaults A.TR processing to on when the backend feature flag exposes the control", () => {
    expect(serializeImportOptions(options(), { atrProcessingAvailable: true })).toMatchObject({
      atr_processing_enabled: true,
    })
  })

  it("returns enabled=false and context=null when toggle is off, regardless of textarea content", () => {
    const result = serializeImportOptions(
      options({
        additional_ai_context_enabled: false,
        additional_ai_context: "ignored content",
      }),
    )

    expect(result).toEqual({
      fast_processing: false,
      atr_processing_enabled: false,
      additional_ai_context_enabled: false,
      additional_ai_context: null,
    })
  })

  it("sends the trimmed context when toggle is on and textarea has content", () => {
    const result = serializeImportOptions(
      options({
        additional_ai_context_enabled: true,
        additional_ai_context: "Batch is from DHL — invoice totals in EUR.",
      }),
    )

    expect(result).toEqual({
      fast_processing: false,
      atr_processing_enabled: false,
      additional_ai_context_enabled: true,
      additional_ai_context: "Batch is from DHL — invoice totals in EUR.",
    })
  })

  it("silently ignores empty textarea when toggle is on (enabled=false, context=null)", () => {
    const result = serializeImportOptions(
      options({
        additional_ai_context_enabled: true,
        additional_ai_context: "",
      }),
    )

    expect(result).toEqual({
      fast_processing: false,
      atr_processing_enabled: false,
      additional_ai_context_enabled: false,
      additional_ai_context: null,
    })
  })

  it("silently ignores whitespace-only textarea when toggle is on", () => {
    const result = serializeImportOptions(
      options({
        additional_ai_context_enabled: true,
        additional_ai_context: "   \n\t  \n",
      }),
    )

    expect(result).toEqual({
      fast_processing: false,
      atr_processing_enabled: false,
      additional_ai_context_enabled: false,
      additional_ai_context: null,
    })
  })

  it("trims leading and trailing whitespace before sending the context", () => {
    const result = serializeImportOptions(
      options({
        additional_ai_context_enabled: true,
        additional_ai_context: "   real content here   \n",
      }),
    )

    expect(result).toEqual({
      fast_processing: false,
      atr_processing_enabled: false,
      additional_ai_context_enabled: true,
      additional_ai_context: "real content here",
    })
  })

  it("preserves fast_processing flag independent of AI context state", () => {
    const withEmptyContext = serializeImportOptions(
      options({
        fast_processing: true,
        additional_ai_context_enabled: true,
        additional_ai_context: "",
      }),
    )
    expect(withEmptyContext.fast_processing).toBe(true)
    expect(withEmptyContext.additional_ai_context_enabled).toBe(false)

    const withFilledContext = serializeImportOptions(
      options({
        fast_processing: true,
        additional_ai_context_enabled: true,
        additional_ai_context: "hint",
      }),
    )
    expect(withFilledContext.fast_processing).toBe(true)
    expect(withFilledContext.additional_ai_context_enabled).toBe(true)
    expect(withFilledContext.additional_ai_context).toBe("hint")
  })

  it("sends A.TR processing only when the control is available", () => {
    const state = options({ atr_processing_enabled: true })

    expect(serializeImportOptions(state)).toMatchObject({
      atr_processing_enabled: false,
    })
    expect(serializeImportOptions(state, { atrProcessingAvailable: true })).toMatchObject({
      atr_processing_enabled: true,
    })
  })
})
