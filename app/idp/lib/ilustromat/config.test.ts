import { afterEach, describe, expect, it, vi } from "vitest"
import { ilustromatConfig } from "./config"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("ilustromatConfig", () => {
  it("bierze wartości domyślne, gdy zmiennych nie ma", () => {
    vi.stubEnv("ILUSTROMAT_TEXT_MODEL", undefined as unknown as string)
    vi.stubEnv("ILUSTROMAT_IMAGE_MODEL", undefined as unknown as string)

    expect(ilustromatConfig()).toEqual({
      textModel: "openai/gpt-4o-mini",
      imageModel: "google/gemini-3.1-flash-lite-image",
    })
  })

  it("PUSTA zmienna też oznacza wartość domyślną", () => {
    // docker-compose wstawia `VAR: ${VAR:-}`, więc nieustawiona zmienna dociera
    // jako "". Bez normalizacji `min(1)` wywracałby start kontenera.
    vi.stubEnv("ILUSTROMAT_TEXT_MODEL", "")
    vi.stubEnv("ILUSTROMAT_IMAGE_MODEL", "   ")

    expect(ilustromatConfig()).toEqual({
      textModel: "openai/gpt-4o-mini",
      imageModel: "google/gemini-3.1-flash-lite-image",
    })
  })

  it("pozwala nadpisać modele per instancja klienta", () => {
    vi.stubEnv("ILUSTROMAT_TEXT_MODEL", "anthropic/claude-haiku-4.5")
    vi.stubEnv("ILUSTROMAT_IMAGE_MODEL", "openai/gpt-image-1")

    expect(ilustromatConfig()).toEqual({
      textModel: "anthropic/claude-haiku-4.5",
      imageModel: "openai/gpt-image-1",
    })
  })
})
