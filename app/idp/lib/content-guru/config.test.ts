import { afterEach, describe, expect, it, vi } from "vitest"
import { contentGuruConfig, isAllowedContentGuruModel } from "./config"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("contentGuruConfig", () => {
  it("bierze listę domyślną, gdy zmienna nie jest ustawiona", () => {
    vi.stubEnv("CONTENT_GURU_MODELS", undefined as unknown as string)

    expect(contentGuruConfig()).toEqual({
      models: ["anthropic/claude-sonnet-4.6", "openai/gpt-4o-mini"],
    })
  })

  it("PUSTA zmienna też oznacza wartość domyślną", () => {
    // docker-compose wstawia `VAR: ${VAR:-}`, więc nieustawiona zmienna dociera
    // jako "" — bez normalizacji `min(1)` wywracałby start kontenera.
    vi.stubEnv("CONTENT_GURU_MODELS", "")

    expect(contentGuruConfig()).toEqual({
      models: ["anthropic/claude-sonnet-4.6", "openai/gpt-4o-mini"],
    })
  })

  it("parsuje comma-separated listę, przycina spacje i pomija puste elementy", () => {
    vi.stubEnv("CONTENT_GURU_MODELS", " anthropic/claude-opus-4.8 ,openai/gpt-5.4-nano,,  ")

    expect(contentGuruConfig()).toEqual({
      models: ["anthropic/claude-opus-4.8", "openai/gpt-5.4-nano"],
    })
  })

  it("sama lista przecinków liczy się jak brak wartości — bierze domyślną", () => {
    vi.stubEnv("CONTENT_GURU_MODELS", " , , ")

    expect(contentGuruConfig()).toEqual({
      models: ["anthropic/claude-sonnet-4.6", "openai/gpt-4o-mini"],
    })
  })
})

describe("isAllowedContentGuruModel", () => {
  it("zwraca true dla modelu z listy", () => {
    vi.stubEnv("CONTENT_GURU_MODELS", "anthropic/claude-opus-4.8,openai/gpt-5.4-nano")

    expect(isAllowedContentGuruModel("anthropic/claude-opus-4.8")).toBe(true)
  })

  it("zwraca false dla modelu spoza listy — fail-closed, nie dowolny string jak w legacy", () => {
    vi.stubEnv("CONTENT_GURU_MODELS", "anthropic/claude-opus-4.8")

    expect(isAllowedContentGuruModel("nieznany-model")).toBe(false)
  })
})
