import { ApiError, apiClient } from "@cortex/api"
import type { TokenUsageErrorCode, TokenUsageResponse, UsageDateRange } from "./types"
import { TOKEN_USAGE_ERROR_CODES } from "./types"

const BASE = "/api/token-usage"

export const queryKeys = {
  all: ["token-usage"] as const,
  report: (range: UsageDateRange) => [...queryKeys.all, "report", range.start, range.end] as const,
}

export const endpoints = {
  report: (range: UsageDateRange) =>
    apiClient.get<TokenUsageResponse>(BASE, {
      params: { start: range.start, end: range.end },
    }),
}

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set(TOKEN_USAGE_ERROR_CODES)

/**
 * Wyciąga własny kod błędu modułu z ciała odpowiedzi. `ApiError.errorCode`
 * niesie WYŁĄCZNIE kody ze słownika `ErrorCode` backendu IDP, a nasze route'y
 * odpowiadają kształtem `{ error, message }` — dlatego czytamy `details`.
 *
 * Kod jest SPRAWDZANY wobec znanego zbioru, a nie rzutowany na typ. Rzutowanie
 * przepuszczało dowolny napis z sieci prosto do klucza „errors.<kod>.title",
 * a i18next dla nieistniejącego klucza zwraca ten klucz — więc na ekranie
 * lądowało dosłowne „errors.forbidden.title", i to bez szansy na zapas `??`,
 * bo zwrócona wartość nie jest ani `null`, ani `undefined`. Nieznany kod
 * (np. dołożony w przyszłości po stronie route'u) daje `null`, czyli komunikat
 * ogólny — jedyny bezpieczny wynik.
 */
export function readUsageErrorCode(error: unknown): TokenUsageErrorCode | null {
  if (!(error instanceof ApiError)) return null
  const details = error.details
  if (typeof details !== "object" || details === null || !("error" in details)) return null
  const code = (details as { error: unknown }).error
  if (typeof code !== "string" || !KNOWN_ERROR_CODES.has(code)) return null
  return code as TokenUsageErrorCode
}
