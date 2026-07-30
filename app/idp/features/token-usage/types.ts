// Typy modelu widoku są IMPORTOWANE z warstwy, która go produkuje
// (lib/token-usage/aggregate.ts), a nie przepisywane tutaj drugi raz.
//
// To bezpieczne i celowe: aggregate.ts nie ma ani jednego importu, żadnego
// dostępu do sieci/bazy i żadnego kodu server-only, a `import type` znika
// w czasie kompilacji — do bundla klienta nie trafia z niego nic. Zyskujemy
// gwarancję, że kontrakt klienta nie rozjedzie się z tym, co serwer faktycznie
// wysyła, bo to dosłownie ten sam typ.

import type { UsageDetailRow, UsageGroup, UsageReport, UsageTotals } from "@/lib/token-usage/aggregate"

export type { UsageDetailRow, UsageGroup, UsageReport, UsageTotals }

export interface UsageDateRange {
  start: string
  end: string
}

/** Odpowiedź GET /api/token-usage — raport plus echo zakresu, na który
 *  faktycznie odpowiedział serwer. */
export type TokenUsageResponse = UsageReport & { range: UsageDateRange }

/** Kody błędów zwracane przez route. Rozróżnienie ma znaczenie operacyjne:
 *  brak konfiguracji to zadanie dla devopsa, niedostępne proxy to awaria. */
export type TokenUsageErrorCode =
  | "cortex-proxy-not-configured"
  | "cortex-proxy-unauthorized"
  | "cortex-proxy-unreachable"
  | "cortex-proxy-error"
  | "invalid-format"
  | "invalid-date"
  | "reversed-range"
  | "range-too-long"
