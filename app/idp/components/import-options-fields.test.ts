/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react"
import { createElement } from "react"
import { describe, expect, it } from "vitest"
import {
  emptyImportOptions,
  ImportOptionsFields,
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
      packaging_selection_mode: null,
    })
  })

  it("does not send additional context when the backend feature flag hides the control", () => {
    const result = serializeImportOptions(
      options({
        additional_ai_context_enabled: true,
        additional_ai_context: "Batch is from DHL — invoice totals in EUR.",
      }),
    )

    expect(result).toEqual({
      fast_processing: false,
      atr_processing_enabled: false,
      additional_ai_context_enabled: false,
      additional_ai_context: null,
      packaging_selection_mode: null,
    })
  })

  it("sends the trimmed context when the control is available and textarea has content", () => {
    const result = serializeImportOptions(
      options({
        additional_ai_context_enabled: true,
        additional_ai_context: "Batch is from DHL — invoice totals in EUR.",
      }),
      { additionalAiContextAvailable: true },
    )

    expect(result).toEqual({
      fast_processing: false,
      atr_processing_enabled: false,
      additional_ai_context_enabled: true,
      additional_ai_context: "Batch is from DHL — invoice totals in EUR.",
      packaging_selection_mode: null,
    })
  })

  it("silently ignores empty textarea when toggle is on (enabled=false, context=null)", () => {
    const result = serializeImportOptions(
      options({
        additional_ai_context_enabled: true,
        additional_ai_context: "",
      }),
      { additionalAiContextAvailable: true },
    )

    expect(result).toEqual({
      fast_processing: false,
      atr_processing_enabled: false,
      additional_ai_context_enabled: false,
      additional_ai_context: null,
      packaging_selection_mode: null,
    })
  })

  it("silently ignores whitespace-only textarea when toggle is on", () => {
    const result = serializeImportOptions(
      options({
        additional_ai_context_enabled: true,
        additional_ai_context: "   \n\t  \n",
      }),
      { additionalAiContextAvailable: true },
    )

    expect(result).toEqual({
      fast_processing: false,
      atr_processing_enabled: false,
      additional_ai_context_enabled: false,
      additional_ai_context: null,
      packaging_selection_mode: null,
    })
  })

  it("trims leading and trailing whitespace before sending the context", () => {
    const result = serializeImportOptions(
      options({
        additional_ai_context_enabled: true,
        additional_ai_context: "   real content here   \n",
      }),
      { additionalAiContextAvailable: true },
    )

    expect(result).toEqual({
      fast_processing: false,
      atr_processing_enabled: false,
      additional_ai_context_enabled: true,
      additional_ai_context: "real content here",
      packaging_selection_mode: null,
    })
  })

  it("preserves fast_processing flag independent of AI context state", () => {
    const withEmptyContext = serializeImportOptions(
      options({
        fast_processing: true,
        additional_ai_context_enabled: true,
        additional_ai_context: "",
      }),
      { additionalAiContextAvailable: true },
    )
    expect(withEmptyContext.fast_processing).toBe(true)
    expect(withEmptyContext.additional_ai_context_enabled).toBe(false)

    const withFilledContext = serializeImportOptions(
      options({
        fast_processing: true,
        additional_ai_context_enabled: true,
        additional_ai_context: "hint",
      }),
      { additionalAiContextAvailable: true },
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

  it("sends packaging mode only when the control is available", () => {
    const state = options({ packaging_selection_mode: "force_pallets" })

    expect(serializeImportOptions(state)).toMatchObject({
      packaging_selection_mode: null,
    })
    expect(serializeImportOptions(state, { packagingSelectionModeAvailable: true })).toMatchObject({
      packaging_selection_mode: "force_pallets",
    })
    expect(
      serializeImportOptions(options(), { packagingSelectionModeAvailable: true }),
    ).toMatchObject({
      packaging_selection_mode: "auto_by_bill_of_lading",
    })
  })
})

describe("ImportOptionsFields", () => {
  it("hides Additional AI context when the feature flag does not expose it", () => {
    render(
      createElement(ImportOptionsFields, {
        idPrefix: "test",
        state: options(),
        onChange: () => undefined,
      }),
    )

    expect(screen.queryByText("Dodatkowy kontekst dla AI")).toBeNull()
  })

  it("renders Additional AI context when the feature flag exposes it", () => {
    render(
      createElement(ImportOptionsFields, {
        idPrefix: "test",
        state: options(),
        onChange: () => undefined,
        showAdditionalAiContext: true,
      }),
    )

    expect(screen.getByText("Dodatkowy kontekst dla AI")).not.toBeNull()
  })

  it("renders Packaging mode when the feature flag exposes it", () => {
    render(
      createElement(ImportOptionsFields, {
        idPrefix: "test",
        state: options(),
        onChange: () => undefined,
        showPackagingSelectionMode: true,
      }),
    )

    expect(screen.getByText("Tryb liczenia opakowań")).not.toBeNull()
    expect(screen.getByText("Automatycznie wg B/L")).not.toBeNull()
  })
})
