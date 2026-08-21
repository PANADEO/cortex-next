// Zod schemat formularza Ustawień (design doc §4.4) — LUSTRO walidacji
// serwera (app/api/geo-score-calculator/config/route.ts), nie jej
// zastępstwo: klient blokuje submit wcześniej (UX), serwer nigdy nie ufa mu
// na słowo (Zod tam też, patrz komentarz w route.ts).
//
// Jedna świadoma różnica względem kontraktu sieciowego: wagi tu są w
// PROCENTACH (0-100, liczby całkowite — pasuje do <Slider step={1}>), nie
// ułamkami (0-1) jak w GeoScoreConfigDto/API. Konwersja żyje wyłącznie w
// dwóch funkcjach na dole tego pliku — nigdzie indziej w warstwie klienta.

import { z } from "zod"
import type { GeoScoreConfigDto, UpdateGeoScoreConfigRequestDto } from "./types"

// Komunikat walidacji jest KLUCZEM i18n, nie gotowym zdaniem — schemat żyje na
// poziomie modułu, więc `t` jeszcze nie istnieje, a napis wpisany tutaj
// zamroziłby jeden język dla wszystkich (wzorem
// components/invoice-supervisor/policy-form-dialog.tsx). Wartości do wstawienia
// w `{{...}}` dokłada RENDER (components/settings-form.tsx) — zodResolver
// przepuszcza z issue wyłącznie `message` i `code`, więc parametr wklejony tu
// w napis nie dałby się już od niego oddzielić.
const percentWeight = z.number().min(0).max(100)
const benchmark = z.number().min(0)
const gradeThreshold = z.number().int().min(0).max(100)
const wordList = z.array(z.string().trim().min(1, "settings.validation.emptyEntry"))

/** Wzorce, których `RegExp` nie przyjmuje. Jedno źródło reguły dla walidacji
 *  niżej i dla ekranu, który musi WYMIENIĆ je w komunikacie — inaczej render
 *  nie miałby czym wypełnić `{{pattern}}`. */
export function invalidBulletPatterns(patterns: readonly string[]): string[] {
  return patterns.filter((pattern) => {
    try {
      new RegExp(pattern)
      return false
    } catch {
      return true
    }
  })
}

export const geoScoreSettingsSchema = z
  .object({
    weightStatistics: percentWeight,
    weightActionVerbs: percentWeight,
    weightStructure: percentWeight,
    weightObjectivity: percentWeight,
    benchmarkStats: benchmark,
    benchmarkVerbs: benchmark,
    benchmarkStructure: benchmark,
    benchmarkObjectivity: benchmark,
    gradeAMin: gradeThreshold,
    gradeBMin: gradeThreshold,
    gradeCMin: gradeThreshold,
    gradeDMin: gradeThreshold,
    actionVerbs: wordList.min(1, "settings.validation.listNotEmpty"),
    subjectiveWords: wordList.min(1, "settings.validation.listNotEmpty"),
    falsePositives: wordList,
    bulletPatterns: wordList,
  })
  .superRefine((data, ctx) => {
    const sum =
      data.weightStatistics + data.weightActionVerbs + data.weightStructure + data.weightObjectivity
    if (sum !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["weightStatistics"],
        message: "settings.validation.weightSum",
      })
    }
    // Jedno zgłoszenie na CAŁE pole, nie po jednym na wzorzec: react-hook-form
    // i tak trzyma pierwszy błąd na ścieżce, a wszystkie wadliwe wzorce render
    // wymienia z `invalidBulletPatterns` w parametrze `{{pattern}}`.
    if (invalidBulletPatterns(data.bulletPatterns).length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bulletPatterns"],
        message: "settings.validation.invalidRegex",
      })
    }
  })

export type GeoScoreSettingsFormValues = z.infer<typeof geoScoreSettingsSchema>

export function configDtoToFormValues(dto: GeoScoreConfigDto): GeoScoreSettingsFormValues {
  return {
    weightStatistics: Math.round(dto.weightStatistics * 100),
    weightActionVerbs: Math.round(dto.weightActionVerbs * 100),
    weightStructure: Math.round(dto.weightStructure * 100),
    weightObjectivity: Math.round(dto.weightObjectivity * 100),
    benchmarkStats: dto.benchmarkStats,
    benchmarkVerbs: dto.benchmarkVerbs,
    benchmarkStructure: dto.benchmarkStructure,
    benchmarkObjectivity: dto.benchmarkObjectivity,
    gradeAMin: dto.gradeAMin,
    gradeBMin: dto.gradeBMin,
    gradeCMin: dto.gradeCMin,
    gradeDMin: dto.gradeDMin,
    actionVerbs: dto.actionVerbs,
    subjectiveWords: dto.subjectiveWords,
    falsePositives: dto.falsePositives,
    bulletPatterns: dto.bulletPatterns,
  }
}

export function formValuesToUpdateRequest(
  values: GeoScoreSettingsFormValues,
): UpdateGeoScoreConfigRequestDto {
  return {
    weightStatistics: values.weightStatistics / 100,
    weightActionVerbs: values.weightActionVerbs / 100,
    weightStructure: values.weightStructure / 100,
    weightObjectivity: values.weightObjectivity / 100,
    benchmarkStats: values.benchmarkStats,
    benchmarkVerbs: values.benchmarkVerbs,
    benchmarkStructure: values.benchmarkStructure,
    benchmarkObjectivity: values.benchmarkObjectivity,
    gradeAMin: values.gradeAMin,
    gradeBMin: values.gradeBMin,
    gradeCMin: values.gradeCMin,
    gradeDMin: values.gradeDMin,
    actionVerbs: values.actionVerbs,
    subjectiveWords: values.subjectiveWords,
    falsePositives: values.falsePositives,
    bulletPatterns: values.bulletPatterns,
  }
}
