// Testy czystej logiki config-schema.ts — walidacja (w tym suma wag = 100%,
// LUSTRO serwerowego Zod w app/api/geo-score-calculator/config/route.ts) i
// konwersje ułamek<->procent między DTO sieciowym a formularzem.

import { describe, expect, it } from "vitest"
import {
  configDtoToFormValues,
  formValuesToUpdateRequest,
  geoScoreSettingsSchema,
} from "./config-schema"
import type { GeoScoreConfigDto } from "./types"

const CONFIG: GeoScoreConfigDto = {
  weightStatistics: 0.3,
  weightActionVerbs: 0.25,
  weightStructure: 0.2,
  weightObjectivity: 0.25,
  benchmarkStats: 4,
  benchmarkVerbs: 0.15,
  benchmarkStructure: 3,
  benchmarkObjectivity: 0.05,
  gradeAMin: 90,
  gradeBMin: 75,
  gradeCMin: 60,
  gradeDMin: 40,
  actionVerbs: ["wdrożył"],
  subjectiveWords: ["najlepszy"],
  falsePositives: [],
  bulletPatterns: ["^[\\s]*-\\s+"],
  updatedAt: "2026-08-01T10:00:00Z",
  updatedBy: "admin@firma.pl",
}

describe("configDtoToFormValues / formValuesToUpdateRequest", () => {
  it("konwertuje wagi ułamek(0-1) <-> procent(0-100) w obie strony bez utraty", () => {
    const formValues = configDtoToFormValues(CONFIG)
    expect(formValues.weightStatistics).toBe(30)
    expect(formValues.weightActionVerbs).toBe(25)

    const requestBody = formValuesToUpdateRequest(formValues)
    expect(requestBody.weightStatistics).toBe(0.3)
    expect(requestBody.weightActionVerbs).toBe(0.25)
  })

  it("nie dotyka list słów i benchmarków przy konwersji", () => {
    const formValues = configDtoToFormValues(CONFIG)
    expect(formValues.actionVerbs).toEqual(["wdrożył"])
    expect(formValues.benchmarkStats).toBe(4)
    expect(formValues.gradeAMin).toBe(90)
  })
})

describe("geoScoreSettingsSchema", () => {
  const VALID = configDtoToFormValues(CONFIG)

  it("przyjmuje wagi sumujące się do dokładnie 100%", () => {
    const result = geoScoreSettingsSchema.safeParse(VALID)
    expect(result.success).toBe(true)
  })

  it("odrzuca sumę wag > 100%, błąd na weightStatistics", () => {
    const invalid = { ...VALID, weightStatistics: 31 } // suma = 101
    const result = geoScoreSettingsSchema.safeParse(invalid)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "weightStatistics")).toBe(true)
      expect(result.error.issues[0]?.message).toMatch(/100%/)
    }
  })

  it("odrzuca sumę wag < 100%", () => {
    const invalid = { ...VALID, weightObjectivity: 24 } // suma = 99
    const result = geoScoreSettingsSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it("odrzuca pustą listę czasowników akcji", () => {
    const invalid = { ...VALID, actionVerbs: [] }
    const result = geoScoreSettingsSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it("odrzuca niepoprawny regex we wzorcach bulletów", () => {
    const invalid = { ...VALID, bulletPatterns: ["(unclosed"] }
    const result = geoScoreSettingsSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it("akceptuje pustą listę wyjątków (false positives) — to jedyna lista, która może być pusta", () => {
    const valid = { ...VALID, falsePositives: [] }
    const result = geoScoreSettingsSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })
})
