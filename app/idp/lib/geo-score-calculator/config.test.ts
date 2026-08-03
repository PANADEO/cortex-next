import { afterEach, describe, expect, it, vi } from "vitest"
import { geoScoreCalculatorConfig } from "./config"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("geoScoreCalculatorConfig", () => {
  it("bierze domyślny adres Docker DNS, gdy zmienna nie jest ustawiona", () => {
    vi.stubEnv("GEO_SCORE_SERVICE_URL", undefined as unknown as string)

    expect(geoScoreCalculatorConfig()).toEqual({
      serviceUrl: "http://geo-score-calculator:8000",
    })
  })

  it("PUSTA zmienna też oznacza wartość domyślną", () => {
    // docker-compose wstawia `VAR: ${VAR:-}`, więc nieustawiona zmienna dociera
    // jako "". Bez normalizacji `z.string().url()` wywracałby start kontenera.
    vi.stubEnv("GEO_SCORE_SERVICE_URL", "")

    expect(geoScoreCalculatorConfig()).toEqual({
      serviceUrl: "http://geo-score-calculator:8000",
    })
  })

  it("pozwala nadpisać adres — inna topologia deployu", () => {
    vi.stubEnv("GEO_SCORE_SERVICE_URL", "http://geo-score.internal:9000")

    expect(geoScoreCalculatorConfig()).toEqual({
      serviceUrl: "http://geo-score.internal:9000",
    })
  })

  it("rzuca na nieprawidłowy URL zamiast cicho przepuścić", () => {
    vi.stubEnv("GEO_SCORE_SERVICE_URL", "not-a-url")

    expect(() => geoScoreCalculatorConfig()).toThrow()
  })
})
