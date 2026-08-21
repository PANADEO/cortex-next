// Prezentacja stanu — etykiety statusów i, kluczowo, ROZRÓŻNIALNE komunikaty
// błędu per errorCode (D1 design doc: "czytelny komunikat, rozróżnienie:
// nieobsługiwany format / plik uszkodzony / limit stron przekroczony / błąd
// modelu wizyjnego — nie jeden ogólny 'processing failed'"). Import wyłącznie
// przez komponenty klienckie (upload/history/[id] page.tsx) — nie dotyka API.
//
// Stałe trzymają KLUCZE przestrzeni `document-parser`, nie napisy: ten plik
// nie jest komponentem, więc nie ma własnego `t()` i nie ma prawa zamrażać
// języka. Napis powstaje w miejscu renderu.

import type { TFunction } from "i18next"
import type { JobErrorCode, JobStatus } from "./types"

export const STATUS_LABEL_KEYS: Record<JobStatus, string> = {
  queued: "status.queued",
  processing: "status.processing",
  done: "status.done",
  error: "status.error",
}

export type StatusBadgeVariant = "default" | "secondary" | "destructive" | "outline"

export const STATUS_BADGE_VARIANT: Record<JobStatus, StatusBadgeVariant> = {
  queued: "outline",
  processing: "secondary",
  done: "default",
  error: "destructive",
}

/** Klucze tytułu + wyjaśnienia per errorCode — dokładnie cztery rozróżnialne
 *  kategorie z D1 (piąta, page-limit-exceeded, jest rezerwą na przyszłość,
 *  patrz backend-client.ts mapBackendErrorToCode — backend dziś nigdy jej
 *  nie zwraca, więc UI ma dla niej też własny, gotowy komunikat).
 *
 *  Jawny `Record<JobErrorCode, …>` zamiast sklejania klucza z kodu w locie:
 *  dołożenie nowego kodu błędu przestaje wtedy kompilować się po cichu i
 *  wymusza dopisanie komunikatu, zamiast pokazać użytkownikowi surowy klucz. */
export const ERROR_CODE_MESSAGE_KEYS: Record<JobErrorCode, { titleKey: string; hintKey: string }> =
  {
    "unsupported-format": {
      titleKey: "errors.unsupported-format.title",
      hintKey: "errors.unsupported-format.hint",
    },
    "file-too-large": {
      titleKey: "errors.file-too-large.title",
      hintKey: "errors.file-too-large.hint",
    },
    "conversion-failed": {
      titleKey: "errors.conversion-failed.title",
      hintKey: "errors.conversion-failed.hint",
    },
    "vision-call-failed": {
      titleKey: "errors.vision-call-failed.title",
      hintKey: "errors.vision-call-failed.hint",
    },
    "page-limit-exceeded": {
      titleKey: "errors.page-limit-exceeded.title",
      hintKey: "errors.page-limit-exceeded.hint",
    },
  }

export function errorMessageFor(
  t: TFunction<"document-parser">,
  errorCode: JobErrorCode | null,
  fallback: string | null,
): {
  title: string
  hint: string
} {
  if (errorCode) {
    const { titleKey, hintKey } = ERROR_CODE_MESSAGE_KEYS[errorCode]
    return { title: t(titleKey), hint: t(hintKey) }
  }
  return {
    title: t("errors.unknown.title"),
    hint: fallback ?? t("errors.unknown.hint"),
  }
}
