// Walidacja zakresu dat — czysta, bez HTTP i bez Date.now() w ścieżce
// decyzyjnej, więc w pełni testowalna.
//
// PO CO TO ISTNIEJE: nic po stronie cortex-proxy nie broni przed
// `start=2020-01-01`. Liczba wierszy w odpowiedzi rośnie z iloczynem
// kardynalności czterech wymiarów (user × source_app × scope × model), a to
// CUDZY serwis produkcyjny z kilkunastoma konsumentami. Twardy limit długości
// zakresu jest tu po to, żeby nasze UI nie mogło go zadeptać.
//
// STREFY CZASOWE: zero konwersji. Proxy parsuje gołe YYYY-MM-DD we własnej
// TIMEZONE (domyślnie Europe/Warsaw) i traktuje `end` jako INKLUZYWNY
// (+23:59:59). Przekazujemy string dokładnie taki, jaki dostaliśmy. Arytmetyka
// niżej idzie przez Date.UTC() wyłącznie po to, żeby policzyć różnicę dni bez
// wpływu strefy serwera — nigdy po to, żeby przesunąć samą datę.

/** Kwartał. Design 4.4 proponuje dokładnie tę wartość jako granicę zdrowego
 *  rozsądku dla raportu bez osi czasu. */
export const MAX_RANGE_DAYS = 92

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 86_400_000

export type DateRangeErrorCode =
  "invalid-format" | "invalid-date" | "reversed-range" | "range-too-long"

export interface DateRange {
  start: string
  end: string
}

export type DateRangeResult =
  { ok: true; range: DateRange } | { ok: false; code: DateRangeErrorCode; message: string }

/**
 * `new Date("2026-02-30")` cicho daje 2 marca, więc sam parser nie wystarcza —
 * po zbudowaniu daty sprawdzamy, czy jej składowe wróciły identyczne. Bez tego
 * "31 lutego" przeszłoby dalej i rozjechało się z tym, co policzy proxy.
 */
function toUtcTimestamp(value: string): number | null {
  if (!DATE_PATTERN.test(value)) return null

  const [year, month, day] = value.split("-").map(Number) as [number, number, number]
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)

  const roundTrips =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day

  return roundTrips ? timestamp : null
}

export function parseDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): DateRangeResult {
  if (typeof start !== "string" || typeof end !== "string") {
    return {
      ok: false,
      code: "invalid-format",
      message: "Wymagane parametry start i end w formacie RRRR-MM-DD.",
    }
  }

  if (!DATE_PATTERN.test(start) || !DATE_PATTERN.test(end)) {
    return {
      ok: false,
      code: "invalid-format",
      message: "Daty muszą mieć format RRRR-MM-DD.",
    }
  }

  const startTs = toUtcTimestamp(start)
  const endTs = toUtcTimestamp(end)
  if (startTs === null || endTs === null) {
    return {
      ok: false,
      code: "invalid-date",
      message: "Podana data nie istnieje w kalendarzu.",
    }
  }

  if (startTs > endTs) {
    return {
      ok: false,
      code: "reversed-range",
      message: "Data początkowa nie może być późniejsza niż końcowa.",
    }
  }

  // Zakres jest obustronnie domknięty — 1 stycznia do 1 stycznia to jeden dzień,
  // nie zero. Ta sama semantyka co inkluzywny `end` po stronie proxy.
  const days = (endTs - startTs) / MS_PER_DAY + 1
  if (days > MAX_RANGE_DAYS) {
    return {
      ok: false,
      code: "range-too-long",
      message: `Zakres nie może przekraczać ${MAX_RANGE_DAYS} dni (wybrano ${days}).`,
    }
  }

  return { ok: true, range: { start, end } }
}
