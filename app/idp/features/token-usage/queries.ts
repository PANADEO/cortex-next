import { ApiError, apiClient } from "@cortex/api"
import type { TokenUsageErrorCode, TokenUsageResponse, UsageDateRange } from "./types"

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

/**
 * Wyciąga własny kod błędu modułu z ciała odpowiedzi. `ApiError.errorCode`
 * niesie WYŁĄCZNIE kody ze słownika `ErrorCode` backendu IDP, a nasze route'y
 * odpowiadają kształtem `{ error, message }` — dlatego czytamy `details`.
 */
export function readUsageErrorCode(error: unknown): TokenUsageErrorCode | null {
  if (!(error instanceof ApiError)) return null
  const details = error.details
  if (typeof details !== "object" || details === null || !("error" in details)) return null
  const code = (details as { error: unknown }).error
  return typeof code === "string" ? (code as TokenUsageErrorCode) : null
}
