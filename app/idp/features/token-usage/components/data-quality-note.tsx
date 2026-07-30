"use client"

import { Alert, AlertDescription, AlertTitle } from "@cortex/ui"
import { Info } from "lucide-react"

/**
 * Jawna nota o jakości danych (projekt 1.4). NIE jest ozdobą i nie wolno jej
 * chować za rozwijanym panelem: raport nazywa się "Raportowanie Tokenów"
 * i bez tej informacji łatwo wziąć te liczby za rozliczenie co do tokena.
 *
 * Fakty pochodzą z kodu cortex-proxy:
 *  - `logMiddleware` wpisuje RequestTokens: countTokensFallback(body) — regexowe
 *    liczenie "słów". Prawdziwymi wartościami nadpisuje je dopiero blok `usage`
 *    z odpowiedzi dostawcy (proxy.go:512-528). Gdy dostawca go nie przysłał,
 *    w bazie zostaje szacunek.
 *  - Raport obejmuje CAŁY ruch przez proxy, nie tylko Cortex360 — proxy obsługuje
 *    kilkanaście repozytoriów, a wymiary source_app/scope wypełnia wołający.
 */
export function DataQualityNote() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Jak czytać te liczby</AlertTitle>
      <AlertDescription className="space-y-1 text-sm">
        <p>
          Część wartości to szacunki, nie odczyt z API dostawcy. Gdy odpowiedź modelu nie zawiera
          bloku danych o zużyciu, cortex-proxy zapisuje liczbę tokenów przybliżoną na podstawie
          treści żądania. Raport pokazuje więc skalę zużycia, a nie rozliczenie co do tokena.
        </p>
        <p>
          Zestawienie obejmuje cały ruch przechodzący przez cortex-proxy, także z systemów spoza
          Cortex360. Kolumna &bdquo;Użytkownik&rdquo; zawiera identyfikator przysłany przez system
          wołający — najczęściej adres e-mail, ale nie jest to gwarantowane.
        </p>
      </AlertDescription>
    </Alert>
  )
}
