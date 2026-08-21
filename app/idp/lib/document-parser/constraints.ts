// Reguły wejścia dzielone MIĘDZY klientem i serwerem — jeden moduł, zero
// duplikacji (code-service SKILL.md regułą 4: "Nie duplikuj reguł dostępu
// między klientem a serwerem"; tu to reguła WALIDACJI, ten sam duch). Import
// działa po obu stronach (wzorem app/idp/lib/ilustromat/presets.ts, importowanego
// zarówno przez generation/page.tsx — klient — jak i api/ilustromat/generate/
// route.ts — serwer): zero zależności od Node/przeglądarki, czyste stałe i
// funkcje.
//
// D1 (design doc): "walidacja rozmiaru/typu PO STRONIE KLIENTA przed
// wysyłką, nie dopiero błąd z serwera" — ten plik jest jedynym źródłem
// prawdy o dozwolonych rozszerzeniach/rozmiarze dla OBU miejsc, które muszą
// się zgadzać (upload/page.tsx i api/document-parser/jobs/route.ts).
//
// Lista rozszerzeń 1:1 z legacy pipeline'em (services/document-parser/src/
// pipeline.py IMAGE_SUFFIXES + ".pdf" + branża Office) — 1.1 w design docu.
// MAX_UPLOAD_MB mirroruje domyślną wartość backendu (services/document-
// parser/src/config.py, MAX_UPLOAD_MB env, default 100) — jeśli instancja
// zmieni limit backendu przez env, BFF o tym nie wie; to świadomy,
// udokumentowany kompromis (walidacja klienta/BFF jest "fail fast", backend
// i tak egzekwuje własny limit niezależnie, patrz main.py `create_job`).

export const ALLOWED_EXTENSIONS = [
  // Obrazy
  "png",
  "jpg",
  "jpeg",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "gif",
  // PDF
  "pdf",
  // Office (konwertowane przez unoserver)
  "doc",
  "docx",
  "odt",
  "rtf",
  "txt",
  "xls",
  "xlsx",
  "ods",
  "csv",
  "ppt",
  "pptx",
  "odp",
] as const

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number]

/** Atrybut `accept` dla `<input type="file">` — kropka + rozszerzenie. */
export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")

export const MAX_UPLOAD_MB = 100
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

/**
 * Wynik walidacji niesie KLUCZ komunikatu, nie gotowy napis. Ten moduł działa
 * po obu stronach — na serwerze nie ma ani wybranego języka, ani `t()`, więc
 * zamrożenie tu napisu zamroziłoby polski dla wszystkich. Napis powstaje
 * dopiero na kliencie, w miejscu, które zna język użytkownika.
 */
export interface FileValidationError {
  ok: false
  error: "unsupported-format" | "file-too-large"
  /** Klucz w przestrzeni `document-parser`. */
  messageKey: string
  /** Wartości do interpolacji `{{...}}` w tym kluczu. */
  messageParams?: Record<string, string | number>
}

export type FileValidationResult = { ok: true } | FileValidationError

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".")
  return idx === -1 ? "" : fileName.slice(idx + 1).toLowerCase()
}

/** Wołane zarówno z klienta (przed submitem, D1) jak i z BFF (nigdy nie ufaj
 *  wyłącznie walidacji klienta — code-api regułą "auth zawsze pierwsza", tu
 *  analogicznie: walidacja zawsze na serwerze niezależnie od klienta). */
export function validateDocumentFile(file: { name: string; size: number }): FileValidationResult {
  const extension = extensionOf(file.name)
  if (!ALLOWED_EXTENSIONS.includes(extension as AllowedExtension)) {
    return extension
      ? {
          ok: false,
          error: "unsupported-format",
          messageKey: "validation.unsupportedFormat",
          messageParams: { extension, allowed: ALLOWED_EXTENSIONS.join(", ") },
        }
      : { ok: false, error: "unsupported-format", messageKey: "validation.missingExtension" }
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: "file-too-large",
      messageKey: "validation.fileTooLarge",
      messageParams: { maxMb: MAX_UPLOAD_MB },
    }
  }

  return { ok: true }
}
