import { afterEach, describe, expect, it, vi } from "vitest"
import { visualGuruConfig } from "./config"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("visualGuruConfig", () => {
  it("bierze wartość domyślną, gdy zmiennej nie ma", () => {
    vi.stubEnv("VISUAL_GURU_IMAGE_MODEL", undefined as unknown as string)

    expect(visualGuruConfig()).toEqual({
      imageModel: "google/gemini-3.1-flash-lite-image",
    })
  })

  it("PUSTA zmienna też oznacza wartość domyślną", () => {
    // docker-compose wstawia `VAR: ${VAR:-}`, więc nieustawiona zmienna dociera
    // jako "". Bez normalizacji `min(1)` wywracałby start kontenera.
    vi.stubEnv("VISUAL_GURU_IMAGE_MODEL", "   ")

    expect(visualGuruConfig()).toEqual({
      imageModel: "google/gemini-3.1-flash-lite-image",
    })
  })

  it("pozwala nadpisać model per instancja klienta", () => {
    vi.stubEnv("VISUAL_GURU_IMAGE_MODEL", "openai/gpt-image-1")

    expect(visualGuruConfig()).toEqual({
      imageModel: "openai/gpt-image-1",
    })
  })
})
