// Prezentacja stanu — etykiety statusów i, kluczowo, ROZRÓŻNIALNE komunikaty
// błędu per errorCode (D1 design doc: "czytelny komunikat, rozróżnienie:
// nieobsługiwany format / plik uszkodzony / limit stron przekroczony / błąd
// modelu wizyjnego — nie jeden ogólny 'processing failed'"). Import wyłącznie
// przez komponenty klienckie (upload/history/[id] page.tsx) — nie dotyka API.

import type { JobErrorCode, JobStatus } from "./types"

export const STATUS_LABELS: Record<JobStatus, string> = {
  queued: "W kolejce",
  processing: "Przetwarzanie",
  done: "Gotowe",
  error: "Błąd",
}

export type StatusBadgeVariant = "default" | "secondary" | "destructive" | "outline"

export const STATUS_BADGE_VARIANT: Record<JobStatus, StatusBadgeVariant> = {
  queued: "outline",
  processing: "secondary",
  done: "default",
  error: "destructive",
}

/** Tytuł + wyjaśnienie per errorCode — dokładnie cztery rozróżnialne
 *  kategorie z D1 (piąta, page-limit-exceeded, jest rezerwą na przyszłość,
 *  patrz backend-client.ts mapBackendErrorToCode — backend dziś nigdy jej
 *  nie zwraca, więc UI ma dla niej też własny, gotowy komunikat). */
export const ERROR_CODE_MESSAGES: Record<JobErrorCode, { title: string; hint: string }> = {
  "unsupported-format": {
    title: "Nieobsługiwany format pliku",
    hint: "Ten typ pliku nie jest wspierany. Sprawdź listę dozwolonych rozszerzeń i spróbuj ponownie.",
  },
  "file-too-large": {
    title: "Plik jest za duży",
    hint: "Zmniejsz rozmiar dokumentu albo podziel go na mniejsze części i spróbuj ponownie.",
  },
  "conversion-failed": {
    title: "Nie udało się przetworzyć dokumentu",
    hint: "Plik może być uszkodzony albo usługa konwersji jest chwilowo niedostępna. Spróbuj wgrać dokument ponownie.",
  },
  "vision-call-failed": {
    title: "Błąd modelu wizyjnego",
    hint: "Ekstrakcja treści dokumentu przez model AI nie powiodła się. Spróbuj ponownie za chwilę.",
  },
  "page-limit-exceeded": {
    title: "Przekroczony limit stron",
    hint: "Dokument ma więcej stron niż dozwolony limit. Skróć dokument i spróbuj ponownie.",
  },
}

export function errorMessageFor(
  errorCode: JobErrorCode | null,
  fallback: string | null,
): {
  title: string
  hint: string
} {
  if (errorCode) return ERROR_CODE_MESSAGES[errorCode]
  return {
    title: "Przetwarzanie nie powiodło się",
    hint: fallback ?? "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
  }
}
